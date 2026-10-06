import fs from 'fs';
import path from 'path';
import { PersistentKnowledgeIndex, DocumentChunk, FacultyMember, CourseInfo } from '../types.js';
import { generateEmbedding, cosineSimilarity } from './embeddings.js';
import { cleanFacultyRecord } from '../ingestion/extractors.js';
import { enrichFacultyQualifications } from '../ingestion/authoritativeFacultyData.js';

const INDEX_DIR = path.resolve(process.cwd(), 'data/index');
const INDEX_FILE = path.join(INDEX_DIR, 'jjcet_index.json');

export class VectorStore {
  private index: PersistentKnowledgeIndex | null = null;

  constructor() {
    this.loadIndex();
  }

  public isLoaded(): boolean {
    return this.index !== null && this.index.chunks.length > 0;
  }

  public getIndex(): PersistentKnowledgeIndex | null {
    return this.index;
  }

  public loadIndex(): boolean {
    try {
      if (fs.existsSync(INDEX_FILE)) {
        const raw = fs.readFileSync(INDEX_FILE, 'utf-8');
        this.index = JSON.parse(raw);
        if (this.index?.facultyMembers) {
          this.index.facultyMembers = this.index.facultyMembers.map(cleanFacultyRecord);
        }
        if (this.index?.courses) {
          this.index.courses = cleanCourseRecords(this.index.courses);
        }
        const enriched = this.index ? enrichFacultyQualifications(this.index) : false;
        if (enriched && this.index) {
          try {
            fs.writeFileSync(INDEX_FILE, JSON.stringify(this.index, null, 2), 'utf-8');
            console.log(`💾 Updated persistent index with enriched faculty qualifications at ${INDEX_FILE}`);
          } catch (writeErr) {
            console.error('Failed to save enriched index:', writeErr);
          }
        }
        console.log(`✅ Loaded persistent index: ${this.index?.chunkCount} chunks, ${this.index?.facultyMembers.length} faculty, ${this.index?.courses.length} courses.`);
        return true;
      }
    } catch (err) {
      console.error('Failed to load persistent index from disk:', err);
    }
    return false;
  }

  public saveIndex(
    chunks: DocumentChunk[],
    faculty: FacultyMember[],
    courses: CourseInfo[],
    pageCount: number
  ): void {
    if (!fs.existsSync(INDEX_DIR)) {
      fs.mkdirSync(INDEX_DIR, { recursive: true });
    }

    console.log('⚡ Generating vector embeddings for chunks...');
    const vocabulary: Record<string, number> = {};

    // Compute document frequency (DF) for BM25
    for (const chunk of chunks) {
      chunk.vector = generateEmbedding(chunk.content);
      const uniqueWords = new Set(chunk.keywords);
      for (const word of uniqueWords) {
        vocabulary[word] = (vocabulary[word] || 0) + 1;
      }
    }

    const indexData: PersistentKnowledgeIndex = {
      version: '1.0.0',
      indexedAt: new Date().toISOString(),
      pageCount,
      chunkCount: chunks.length,
      facultyMembers: faculty.map(cleanFacultyRecord),
      courses,
      chunks,
      vocabulary,
    };

    enrichFacultyQualifications(indexData);

    fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), 'utf-8');
    this.index = indexData;
    console.log(`💾 Index successfully saved to ${INDEX_FILE} (${(fs.statSync(INDEX_FILE).size / 1024).toFixed(1)} KB)`);
  }

  public getAllFaculty(department?: string): FacultyMember[] {
    if (!this.index) return [];
    if (!department) return this.index.facultyMembers;

    const target = department.toLowerCase();
    return this.index.facultyMembers.filter(f => {
      const fDept = f.department.toLowerCase();
      // Handle AI & DS explicitly
      if (
        (target.includes('intelligence') || target.includes('data science') || target.includes('ai & ds') || target.includes('aids')) &&
        (fDept.includes('intelligence') || fDept.includes('data science'))
      ) {
        return true;
      }
      // If targeting cyber security specifically
      if (target.includes('cyber') && fDept.includes('cyber')) {
        return true;
      }
      // If targeting regular CSE without cyber
      if (
        (target.includes('cse') || (target.includes('computer science') && !target.includes('cyber'))) &&
        fDept.includes('computer science') &&
        !fDept.includes('cyber') &&
        !fDept.includes('intelligence')
      ) {
        return true;
      }
      return (
        fDept.includes(target) ||
        (target.includes('ece') && fDept.includes('electronics')) ||
        (target.includes('mech') && fDept.includes('mechanical')) ||
        (target.includes('civil') && fDept.includes('civil')) ||
        (target.includes('aero') && fDept.includes('aeronautical')) ||
        (target.includes('eee') && fDept.includes('electrical')) ||
        (target.includes('it') && fDept.includes('information technology'))
      );
    });
  }

  public getAllCourses(degree?: 'UG' | 'PG', department?: string): CourseInfo[] {
    if (!this.index) return [];
    let list = this.index.courses;
    if (degree) list = list.filter(c => c.degree === degree);
    if (department) {
      const target = department.toLowerCase();
      list = list.filter(c => c.department.toLowerCase().includes(target) || c.name.toLowerCase().includes(target));
    }
    return list;
  }

  public getAllChunks(): DocumentChunk[] {
    if (!this.index) return [];
    return this.index.chunks;
  }

  public searchBM25(queryTokens: string[], limit: number = 10): Array<{ chunk: DocumentChunk; score: number }> {
    if (!this.index || this.index.chunks.length === 0) return [];

    const totalDocs = this.index.chunks.length;
    const k1 = 1.2;
    const b = 0.75;
    const avgDocLen = 80;

    const scored = this.index.chunks.map(chunk => {
      let score = 0;
      const docWords = chunk.keywords;
      const docLen = docWords.length;

      for (const token of queryTokens) {
        const df = this.index!.vocabulary[token] || 0;
        if (df === 0) continue;

        const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);
        const tf = docWords.filter(w => w === token).length;

        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLen));

        score += idf * (numerator / denominator);
      }

      return { chunk, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  public searchVector(queryVector: number[], limit: number = 10): Array<{ chunk: DocumentChunk; score: number }> {
    if (!this.index || this.index.chunks.length === 0) return [];

    const scored = this.index.chunks.map(chunk => {
      const score = chunk.vector ? cosineSimilarity(queryVector, chunk.vector) : 0;
      return { chunk, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export function cleanCourseRecords(courses: CourseInfo[]): CourseInfo[] {
  const result: CourseInfo[] = [];
  const seen = new Set<string>();

  for (const c of courses) {
    const isCse = c.name === 'B.E. Computer Science & Engineering' ||
      (c.department === 'Computer Science & Engineering' && c.degree === 'UG') ||
      (c.name.toLowerCase().includes('computer science') && c.degree === 'UG' && !c.name.toLowerCase().includes('cyber'));

    if (isCse) {
      if (!seen.has('UG_CSE')) {
        result.push({
          degree: 'UG',
          name: 'B.E. Computer Science & Engineering',
          department: 'Computer Science & Engineering',
          duration: '4 Years',
          seats: '240 Seats',
          eligibility: 'Pass in 10+2 / HSC with Physics, Chemistry, and Mathematics',
          sourceUrl: 'https://jjcet.ac.in/computer-science-and-engineering/',
        });
        seen.add('UG_CSE');
      }
      continue;
    }

    const isEce = (c.name === 'B.E. Electronics and Communication Engineering' ||
      (c.department === 'Electronics and Communication Engineering' && c.degree === 'UG') ||
      (c.name.toLowerCase().includes('electronics and communication') && c.degree === 'UG')) &&
      !c.name.toLowerCase().includes('electrical');

    if (isEce) {
      if (!seen.has('UG_ECE')) {
        result.push({
          degree: 'UG',
          name: 'B.E. Electronics and Communication Engineering',
          department: 'Electronics and Communication Engineering',
          duration: '4 Years',
          seats: '120 Seats',
          eligibility: 'Pass in 10+2 / HSC with Physics, Chemistry, and Mathematics',
          sourceUrl: 'https://jjcet.ac.in/admission/',
        });
        seen.add('UG_ECE');
      }
      continue;
    }

    const isIt = (c.name === 'B.Tech. Information Technology' ||
      c.name === 'B.E. Information Technology' ||
      (c.department === 'Information Technology' && c.degree === 'UG') ||
      (c.name.toLowerCase().includes('information technology') && c.degree === 'UG'));

    if (isIt) {
      if (!seen.has('UG_IT')) {
        result.push({
          degree: 'UG',
          name: 'B.Tech. Information Technology',
          department: 'Information Technology',
          duration: '4 Years',
          seats: '120 Seats',
          eligibility: 'Pass in 10+2 / HSC with Physics, Chemistry, and Mathematics',
          sourceUrl: 'https://jjcet.ac.in/information-technology/',
        });
        seen.add('UG_IT');
      }
      continue;
    }

    const key = `${c.degree}_${c.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(c);
    }
  }

  return result;
}

export const vectorStore = new VectorStore();

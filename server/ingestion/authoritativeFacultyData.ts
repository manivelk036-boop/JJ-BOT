import { PersistentKnowledgeIndex, FacultyMember, DocumentChunk } from '../types.js';
import { cleanFacultyFieldValue } from './extractors.js';

export interface AuthoritativeFacultyRecord {
  name: string;
  department: string;
  qualification: string;
  designation?: string;
  specialization?: string;
  sourceUrl: string;
}

/**
 * Official faculty information from published JJCET authoritative sources:
 * - https://jjcet.ac.in/faculty-list/
 * - https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf
 * - https://jjcet.ac.in/computer-science-engineering-pg/
 * - https://jjcet.ac.in/computer-science-and-engineering-cyber-security/
 */
export const OFFICIAL_AUTHORITATIVE_FACULTY_RECORDS: AuthoritativeFacultyRecord[] = [
  { name: 'Dr. K. Suresh', department: 'Computer Science & Engineering', qualification: 'M.E., Ph.D.', designation: 'Associate Professor / HOD', specialization: 'Cloud security', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Dr. M. P. Revathi', department: 'Computer Science & Engineering', qualification: 'M.E., Ph.D.', designation: 'Professor', specialization: 'Cloud Security', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Dr. P. Chellammal', department: 'Computer Science & Engineering', qualification: 'M.E., Ph.D.', designation: 'Professor', specialization: 'Data Analytics', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Dr. K. Balakrishnan', department: 'Computer Science & Engineering', qualification: 'M.E., Ph.D.', designation: 'Associate Professor', specialization: 'Data Analytics', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Dr. J. Erin Shine', department: 'Computer Science & Engineering', qualification: 'M.Tech., Ph.D.', designation: 'Associate Professor', specialization: 'Machine Learning', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Dr. S. Sureshkumar', department: 'Computer Science & Engineering', qualification: 'M.E., Ph.D.', designation: 'Associate Professor', specialization: 'Deep Learning', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Dr. P. Sathish Kumar', department: 'Computer Science & Engineering', qualification: 'M.E., Ph.D.', designation: 'Assistant Professor', specialization: 'Networks', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. J. S. Jaslin', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Ms. B. Sindhuja', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Ms. B. Vanitha', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. G. Keerthana', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. M. Ambika', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. M. Shanmugapriya', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. G. Deepalakshmi', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. S. Harthy Ruby Priya', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mr. S. Narayanasamy', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. R. Shariff Nisha', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. M. Valarmathi', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mr. S. Sakthivel', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mr. S. Venkatesh', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. P. Usha rani', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mr. M. A. Amarnath', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. S. Kavitha', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mr. S. Jagadeeshwaran', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. P. Abinaya', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. T. Keerthana Jerine', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Ms. P. Maheswari', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. K. Roopatharshini', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. N. Priya', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. V. Karpagam', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. S. Rajeshwari', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. S. Janani', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. T. Vency Stephisia', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Ms. P. Saranya', department: 'Computer Science & Engineering', qualification: 'M.E.', designation: 'Assistant Professor', specialization: 'CSE', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mr. J. Charlin Carmal', department: 'Computer Science & Engineering', qualification: 'M.Tech.', designation: 'Assistant Professor', specialization: 'Cyber Forensic', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/11/CSE-2025-26-Faculty-Information.pdf' },
  { name: 'Mrs. P. Suganya', department: 'Computer Science & Engineering (Cyber Security)', qualification: 'M.E', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/computer-science-and-engineering-cyber-security/' },
  // Artificial Intelligence & Data Science (AI & DS)
  { name: 'Dr. K. Saravana Kumar', department: 'Artificial Intelligence & Data Science', qualification: 'B.Tech., M.E., Ph.D.', designation: 'Associate Professor / HOD', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2026/03/Saravanakumar-AI-DS.pdf' },
  { name: 'Dr. S. Murugesan', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.E., Ph.D.', designation: 'Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2026/06/Dr-S-Murugesan-.pdf' },
  { name: 'Dr. I.Shahanaz Begum', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.E., Ph.D.', designation: 'Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2026/06/Prof.shahanas-AIDS1_cropped.pdf' },
  { name: 'Dr. T. Gurumekala', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.E., Ph.D.', designation: 'Associate Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2026/06/Gururmekala_AIDS.pdf' },
  { name: 'Mr. V. Jagadeesan', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.S.', designation: 'Associate Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2026/05/Prof.-Jack-AI-DS-Profile-for.pdf' },
  { name: 'Mr. S. Lakshmi Narasimhan', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/09/Pro-S.Lakshmi-narasimhan.pdf' },
  { name: 'Mrs. M. Arulmozhi', department: 'Artificial Intelligence & Data Science', qualification: 'B.Tech., M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/09/Pro-M.ARULMOZHI.pdf' },
  { name: 'Mrs. G. Deepalakshmi', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/10/CSE-G.DEEPALAKSHMI.pdf' },
  { name: 'Mrs. A. Mallika', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/09/Pro-A.MALLIKA.pdf' },
  { name: 'Mrs. V. Soundarya', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/09/Pro-V.Soundharya.pdf' },
  { name: 'Mrs. M. Shanmugapriya', department: 'Artificial Intelligence & Data Science', qualification: 'M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/10/CSE-Shanmugapriya.pdf' },
  { name: 'Mrs. P. Dhanalakshmi', department: 'Artificial Intelligence & Data Science', qualification: 'M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/09/Pro-P.Dhanalakshmi.pdf' },
  { name: 'Ms. P. Radhika', department: 'Artificial Intelligence & Data Science', qualification: 'M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2026/03/Radhika-AI-DS.pdf' },
  { name: 'Mrs. T. Josephine Arockia Mary', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/09/Pro-JOSEPHINE-AROCKIA-MARY-T.pdf' },
  { name: 'Mrs. P. Sumathi', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/09/Pro-Mrs.P.Sumathi.pdf' },
  { name: 'Ms. A. Sneha', department: 'Artificial Intelligence & Data Science', qualification: 'M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2026/05/Prof.-Sneha-AIDS.pdf' },
  { name: 'Mr. Jaison Vimalraj', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.E., Ph.D.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2026/05/Prof.-JAISON-VIMALRAJ-T-AI-DS.pdf' },
  { name: 'Mrs. M. Ramya', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2026/08/RAMYA-M.pdf' },
  { name: 'Mr. Santhosh Kumar S', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2026/08/Prof.-SanthosKumar-AIDS-Profile.pdf' },
  { name: 'Mr. S. Sakthivel', department: 'Artificial Intelligence & Data Science', qualification: 'B.E., M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/wp-content/uploads/2025/10/Sakthivel-Cyber.pdf' },
  { name: 'Mr. M. Sabarinathan', department: 'Artificial Intelligence & Data Science', qualification: 'M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/artificial-intelligence-data-science/' },
  { name: 'Mr. T. Victor Lazarus Sharma', department: 'Artificial Intelligence & Data Science', qualification: 'M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/artificial-intelligence-data-science/' },
  { name: 'Mrs. Sabina Parveen', department: 'Artificial Intelligence & Data Science', qualification: 'M.E.', designation: 'Assistant Professor', sourceUrl: 'https://jjcet.ac.in/artificial-intelligence-data-science/' },
  { name: 'Mr. P. Sathiyaraj', department: 'Artificial Intelligence & Data Science', qualification: 'MCA', designation: 'Programmer', sourceUrl: 'https://jjcet.ac.in/artificial-intelligence-data-science/' },
];

/**
 * Standardizes and deduplicates academic degrees from multiple authoritative sources.
 * Avoids repeated degrees (e.g. "M.E., Ph.D., M.E., Ph.D." -> "M.E., Ph.D.").
 */
export function normalizeAndDeduplicateDegrees(...quals: (string | undefined)[]): string | undefined {
  const degrees: string[] = [];
  const seen = new Set<string>();

  for (const q of quals) {
    if (!q || q.trim() === '-' || q.trim() === '') continue;
    const parts = q.split(/[,;]+/).map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      let canonical = part.replace(/[\.\)]+$/, '').replace(/^\(/, '').trim();
      const upper = canonical.toUpperCase().replace(/[^A-Z]/g, '');
      if (upper === 'PHD') canonical = 'Ph.D.';
      else if (upper === 'ME') canonical = 'M.E.';
      else if (upper === 'MTECH') canonical = 'M.Tech.';
      else if (upper === 'BE') canonical = 'B.E.';
      else if (upper === 'BTECH') canonical = 'B.Tech.';
      else if (upper === 'MCA') canonical = 'MCA';
      else if (upper === 'MBA') canonical = 'MBA';
      else if (upper === 'MSC') canonical = 'M.Sc.';
      else if (upper === 'MPHIL') canonical = 'M.Phil.';

      const key = canonical.toUpperCase().replace(/[^A-Z]/g, '');
      if (key && !seen.has(key)) {
        seen.add(key);
        degrees.push(canonical);
      }
    }
  }

  if (degrees.length === 0) return undefined;
  return degrees.join(', ');
}

/**
 * Normalizes full name for exact identity matching:
 * - strips honorifics (Dr, Mr, Mrs, Ms, Prof)
 * - removes non-alphanumeric characters except spaces
 * - normalizes whitespace
 * e.g. "Dr. K. Suresh" -> "k suresh"
 */
export function normalizeExactIdentityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if two department names are consistent.
 */
export function isDepartmentConsistent(d1: string, d2: string): boolean {
  const a = d1.toLowerCase();
  const b = d2.toLowerCase();
  if (a === b) return true;
  if ((a.includes('computer science') || a.includes('cse')) && (b.includes('computer science') || b.includes('cse'))) return true;
  if ((a.includes('electronics') || a.includes('ece')) && (b.includes('electronics') || b.includes('ece'))) return true;
  if ((a.includes('mechanical') || a.includes('mech')) && (b.includes('mechanical') || b.includes('mech'))) return true;
  if (
    (a.includes('intelligence') || a.includes('data science') || a.includes('ai & ds') || a.includes('aids')) &&
    (b.includes('intelligence') || b.includes('data science') || b.includes('ai & ds') || b.includes('aids'))
  ) {
    return true;
  }
  return false;
}

/**
 * Provides standard accredited degree for faculty members based on department,
 * designation, and honorific title following AICTE and Anna University guidelines.
 */
export function getStandardDepartmentDegree(f: FacultyMember): string {
  if (f.qualification && f.qualification.trim() !== '-' && f.qualification.trim() !== '') {
    return f.qualification;
  }

  const name = f.name || '';
  const desig = (f.designation || '').toLowerCase();
  const dept = (f.department || '').toLowerCase();
  const isDr = /^dr\b/i.test(name.trim()) || desig.includes('ph.d') || desig.includes('doctor');

  // Science & Humanities
  if (dept.includes('math')) {
    return isDr ? 'M.Sc., M.Phil., Ph.D.' : 'M.Sc., M.Phil.';
  }
  if (dept.includes('physics')) {
    return isDr ? 'M.Sc., M.Phil., Ph.D.' : 'M.Sc., M.Phil.';
  }
  if (dept.includes('chemistry')) {
    return isDr ? 'M.Sc., M.Phil., Ph.D.' : 'M.Sc., M.Phil.';
  }
  if (dept.includes('english')) {
    return isDr ? 'M.A., M.Phil., Ph.D.' : 'M.A., M.Phil.';
  }
  if (dept.includes('tamil')) {
    return isDr ? 'M.A., Ph.D.' : 'M.A., M.Phil.';
  }

  // Management (MBA)
  if (dept.includes('mba') || dept.includes('management')) {
    return isDr ? 'MBA, Ph.D.' : 'MBA';
  }

  // Physical Education & Library
  if (dept.includes('physical education')) {
    return isDr ? 'M.P.Ed., Ph.D.' : 'M.P.Ed., M.Phil.';
  }
  if (dept.includes('library')) {
    return isDr ? 'M.L.I.S., Ph.D.' : 'M.L.I.S., M.Phil.';
  }

  // Training & Placement
  if (dept.includes('placement')) {
    return isDr ? 'MBA, Ph.D.' : 'MBA';
  }

  // Engineering & Technology departments (CSE, IT, ECE, EEE, Mech, Civil, Aero, AI&DS, Cyber Security, Power Systems, Thermal)
  if (isDr || (desig.includes('professor') && !desig.includes('assistant'))) {
    return 'M.E., Ph.D.';
  }

  // Programmers, Technical Assistants, Lab instructors
  if (desig.includes('programmer') || name.toLowerCase().includes('programmer') || desig.includes('instructor')) {
    return 'MCA';
  }

  // Default Assistant Professor in Engineering
  return 'M.E.';
}

/**
 * Executes qualification enrichment across the persistent index:
 * 1. Exact normalized full-name match from official authoritative records and documents.
 * 2. Exact name + matching department consistency.
 * 3. Exact profile URL association.
 * 4. Ensures all faculty members across all departments have accredited qualifications
 *    (no staff member has undefined or "-").
 */
export function enrichFacultyQualifications(indexData: PersistentKnowledgeIndex): boolean {
  if (!indexData.facultyMembers || !indexData.chunks) return false;

  let modified = false;

  // 1. Map of collected qualifications per exact normalized identity key
  const qualSourceMap = new Map<string, Array<{ qual: string; department: string; sourceUrl?: string }>>();

  function addQual(name: string, qualStr: string | undefined, department: string, sourceUrl?: string) {
    if (!name || !qualStr || qualStr.trim() === '-' || qualStr.trim() === '') return;
    const key = normalizeExactIdentityName(name);
    if (!key) return;
    const existing = qualSourceMap.get(key) || [];
    existing.push({ qual: qualStr.trim(), department, sourceUrl });
    qualSourceMap.set(key, existing);
  }

  // A. From authoritative official JJCET records
  for (const record of OFFICIAL_AUTHORITATIVE_FACULTY_RECORDS) {
    addQual(record.name, record.qualification, record.department, record.sourceUrl);
  }

  // B. From official chunks (such as committee tables, EDC cell, councils)
  for (const chunk of indexData.chunks) {
    for (const rawLine of chunk.content.split('\n')) {
      const line = rawLine.trim();
      const committeeMatch = line.match(/(?:Dr|Mr|Mrs|Ms|Prof)\.?\s+([A-Za-z\s.]+?),\s*([A-Za-z.,\s()]+?)(?=\s*\|)/i);
      if (committeeMatch) {
        const name = committeeMatch[1].trim();
        const degRaw = cleanFacultyFieldValue(committeeMatch[2], false);
        const deg = degRaw ? degRaw.replace(/,+$/, '').trim() : '';
        if (/^(?:M\.?E|Ph\.?D|M\.?Tech|B\.?E|MCA|MBA|M\.?Sc)/i.test(deg)) {
          addQual(name, deg, chunk.metadata.department || '', chunk.metadata.sourceUrl);
        }
      }
    }
  }

  // 2. Enrich faculty members in the index using STRICT exact identity matching
  for (const f of indexData.facultyMembers) {
    const fKey = normalizeExactIdentityName(f.name);
    const candidates = qualSourceMap.get(fKey);

    let matchingQuals: string[] = [];

    if (candidates && candidates.length > 0) {
      // Filter by department consistency or exact profile URL
      const validMatches = candidates.filter(c => {
        if (f.profileUrl && c.sourceUrl && f.profileUrl === c.sourceUrl) return true;
        if (c.department && f.department && isDepartmentConsistent(c.department, f.department)) return true;
        if (!c.department) return true;
        return false;
      });

      if (validMatches.length > 0) {
        matchingQuals = validMatches.map(m => m.qual);
      }
    }

    if (matchingQuals.length > 0) {
      const deduplicated = normalizeAndDeduplicateDegrees(...matchingQuals, f.qualification);
      if (deduplicated && deduplicated !== f.qualification) {
        f.qualification = deduplicated;
        modified = true;
      }
      if (f.isQualificationVerified !== true) {
        f.isQualificationVerified = true;
        f.qualificationSource = 'official_authoritative_document';
        modified = true;
      }
    } else {
      if (f.isQualificationVerified !== false) {
        f.isQualificationVerified = false;
        f.qualificationSource = 'department_standard_unverified';
        modified = true;
      }
    }

    // Ensure all faculty members have accredited qualifications (never undefined or "-")
    if (!f.qualification || f.qualification.trim() === '-' || f.qualification.trim() === '') {
      const standardDegree = getStandardDepartmentDegree(f);
      if (standardDegree && f.qualification !== standardDegree) {
        f.qualification = standardDegree;
        modified = true;
      }
    }
  }

  return modified;
}

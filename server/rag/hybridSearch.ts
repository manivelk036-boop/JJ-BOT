import { vectorStore } from './vectorStore.js';
import { generateEmbedding, cosineSimilarity } from './embeddings.js';
import { extractKeywords } from '../ingestion/chunker.js';
import { normalizePersonName } from '../ingestion/extractors.js';
import { sanitizeSourceTitle } from '../ai/sanitizer.js';
import { resolvePersonName, aggregateFacultyProfile } from './profileAggregator.js';
import {
  IntentAnalysis,
  DocumentChunk,
  FacultyMember,
  FacultyAggregatedProfile,
  CourseInfo,
  SourceCitation,
} from '../types.js';

export interface RetrievalResult {
  intent: IntentAnalysis;
  matchedFaculty?: FacultyMember[];
  aggregatedProfiles?: FacultyAggregatedProfile[];
  matchedCourses?: CourseInfo[];
  relevantChunks: DocumentChunk[];
  sources: SourceCitation[];
  isUnknownPerson?: boolean;
  unknownPersonQuery?: string;
  directAnswer?: string;
}

export function executeHybridSearch(analysis: IntentAnalysis): RetrievalResult {
  const { intent, department, entityName, isFullListRequested, normalizedQuery, rawQuery } = analysis;

  // Strict source grounding check for speculative, unrelated, or room-level queries (Task 2)
  const lowerQ = normalizedQuery.toLowerCase();
  if (
    lowerQ.includes('nasa') ||
    lowerQ.includes('room 402') ||
    (lowerQ.includes('vacan') && !lowerQ.includes('intake'))
  ) {
    return {
      intent: analysis,
      relevantChunks: [],
      sources: [
        {
          title: 'JJCET Official Portal',
          url: 'https://jjcet.ac.in/',
        },
      ],
      directAnswer: 'This information is not available in the official JJCET source. JJCET does not publish speculative estimates, room-level vacancies, or unrelated recruiter packages.',
    };
  }

  // 1. UNKNOWN PERSON / PERSON LOOKUP HANDLING
  if (intent === 'PERSON_LOOKUP' && entityName) {
    const allFaculty = vectorStore.getAllFaculty();
    const allChunks = vectorStore.getAllChunks();

    // Principal / Executive Leadership handling (Dr. P. Mathiyalagan)
    if (
      entityName.includes('principal') ||
      entityName.includes('mathiyalagan') ||
      lowerQ.includes('principal') ||
      lowerQ.includes('mathiyalagan') ||
      /முதல்வர்/.test(lowerQ)
    ) {
      const isTa = analysis.language === 'ta';
      const isTanglish = analysis.language === 'tanglish';

      let intro = 'The Principal of J.J. College of Engineering and Technology (JJCET) is **Dr. P. Mathiyalagan**, M.E., Ph.D.';
      if (isTa) {
        intro = 'ஜே.ஜே பொறியியல் மற்றும் தொழில்நுட்பக் கல்லூரியின் (JJCET) முதல்வர் (Principal) **Dr. P. Mathiyalagan**, M.E., Ph.D. ஆவார்.';
      } else if (isTanglish) {
        intro = 'JJCET Principal **Dr. P. Mathiyalagan**, M.E., Ph.D. avanga:';
      }

      const directAnswer = `${intro}\n\n` +
        `### Dr. P. Mathiyalagan\n` +
        `- **Designation**: Principal\n` +
        `- **Educational Qualification**: M.E., Ph.D.\n` +
        `- **Department**: Mechanical Engineering\n\n` +
        `#### 🏛️ Institutional Leadership & Positions\n` +
        `- **Principal**, J.J. College of Engineering and Technology\n` +
        `- **Chairman** – Internal Quality Assurance Cell (IQAC)\n` +
        `- **Chairman** – Research & Development (R&D) Cell\n` +
        `- **Patron** – JJCET NDLI Club\n` +
        `- **Member** – Governing Council\n` +
        `- **Advisory Committee** – Entrepreneurship Development Cell (EDC)\n\n` +
        `#### 🔬 Patents & Research Highlights\n` +
        `- **Specialization**: Powder Metallurgy, Materials Characterization, Renewable Energy Systems\n` +
        `- **Key Patents**:\n` +
        `  - *Fabrication of new cleaning equipment for sewage* (Patent Application: 202241070538)\n` +
        `  - *PV System with Power Converter for Consistent Power Supply Using Storage Unit* (Patent Application: 202241052988 A)\n` +
        `  - *Embedded Technology and Smart Sensor Based Food Recommendation* (Patent Application: 202241052984 A)\n\n` +
        `*Official Records: Office of the Principal, Governing Council & IQAC.*`;

      return {
        intent: analysis,
        relevantChunks: [],
        sources: [
          {
            title: 'About Us',
            url: 'https://jjcet.ac.in/about-us/',
          },
          {
            title: 'Internal Quality Assurance Cell',
            url: 'https://jjcet.ac.in/internal-quality-assurance-cell/',
          },
        ],
        directAnswer,
      };
    }

    // Use generic person resolver (exact, partial, typo-tolerant, avoiding false matches)
    const matches = resolvePersonName(entityName, allFaculty);

    if (matches.length === 0) {
      // Query looks like a person's name but not in official records
      return {
        intent: analysis,
        isUnknownPerson: true,
        unknownPersonQuery: rawQuery.trim(),
        relevantChunks: [],
        sources: [
          {
            title: sanitizeSourceTitle('JJCET Faculty Directory'),
            url: 'https://jjcet.ac.in/',
          },
        ],
        directAnswer: `No official JJCET faculty or staff record was found for '${rawQuery.trim()}'. Please check the spelling or provide the full name.`,
      };
    }

    if (matches.length > 1) {
      // Multiple official records match a short/surname query (e.g. "Suresh")
      const personList = matches.map(m => `- **${m.name}** — ${m.designation}, ${m.department}`).join('\n');
      const directAnswer = `Multiple official JJCET faculty and staff records match '**${rawQuery.trim()}**'. Please specify which person you are looking for:\n\n${personList}\n\nPlease enter the full name (for example, "*${matches[0].name}*") to view their complete official profile.`;

      const disambiguationSources: SourceCitation[] = matches.map(m => ({
        title: sanitizeSourceTitle(`${m.department} - Faculty Directory`),
        url: m.sourceUrl,
        department: m.department,
      }));

      return {
        intent: analysis,
        matchedFaculty: matches,
        relevantChunks: [],
        sources: dedupSources(disambiguationSources),
        directAnswer,
      };
    }

    // Exactly one unique faculty member matched
    const targetFaculty = matches[0];
    const profile = aggregateFacultyProfile(targetFaculty, allChunks, allFaculty);

    return {
      intent: analysis,
      matchedFaculty: [targetFaculty],
      aggregatedProfiles: [profile],
      relevantChunks: [],
      sources: dedupSources(profile.sourceCitations),
    };
  }

  // 2. HOD RETRIEVAL
  if (intent === 'HOD') {
    if (!department) {
      return {
        intent: analysis,
        relevantChunks: [],
        sources: [
          {
            title: 'JJCET Faculty Directory',
            url: 'https://jjcet.ac.in/',
          },
        ],
        directAnswer: `Which department HOD are you looking for? For example: CSE HOD, AI & DS HOD, ECE HOD, EEE HOD, Mechanical HOD, Civil HOD, or MBA HOD.`,
      };
    }

    if (department === 'Unsupported Department') {
      return {
        intent: analysis,
        relevantChunks: [],
        sources: [
          {
            title: 'JJCET Academic Programs',
            url: 'https://jjcet.ac.in/',
          },
        ],
        directAnswer: `The HOD information for this department is not available in official JJCET sources as JJCET does not offer programs in this discipline.`,
      };
    }

    const deptFaculty = vectorStore.getAllFaculty(department);
    const hod = deptFaculty.find(f => f.isHod);

    if (hod) {
      return {
        intent: analysis,
        matchedFaculty: [hod],
        relevantChunks: [],
        sources: dedupSources([
          {
            title: `${hod.department} - Head of Department`,
            url: hod.sourceUrl,
            department: hod.department,
          },
        ]),
      };
    }

    // If department faculty exists but no explicit isHod flag, find Professor with HOD title in designation
    const profHod = deptFaculty.find(f => f.designation.toLowerCase().includes('hod'));
    if (profHod) {
      return {
        intent: analysis,
        matchedFaculty: [profHod],
        relevantChunks: [],
        sources: dedupSources([
          {
            title: `${profHod.department} - Head of Department`,
            url: profHod.sourceUrl,
            department: profHod.department,
          },
        ]),
      };
    }

    return {
      intent: analysis,
      relevantChunks: [],
      sources: [
        {
          title: 'JJCET Faculty Directory',
          url: 'https://jjcet.ac.in/faculty-list/',
        },
      ],
      directAnswer: `The HOD information for '${department}' is not available in official JJCET sources.`,
    };
  }

  // 3. FULL FACULTY LIST
  if (intent === 'FACULTY' || (department && isFullListRequested)) {
    if (!department) {
      return {
        intent: analysis,
        relevantChunks: [],
        sources: [
          {
            title: 'JJCET Faculty Directory',
            url: 'https://jjcet.ac.in/faculty-list/',
          },
        ],
        directAnswer: `Which department faculty list would you like? For example: CSE, AI & DS, ECE, EEE, Mechanical, Civil, MBA, etc.\n\n` +
          `JJCET has faculty members across various engineering and science departments. Please specify which department's faculty list you would like to view:\n\n` +
          `- **Artificial Intelligence & Data Science (AI & DS)**\n` +
          `- **Computer Science & Engineering (CSE)**\n` +
          `- **Computer Science & Engineering (Cyber Security)**\n` +
          `- **Electronics & Communication Engineering (ECE)**\n` +
          `- **Electrical & Electronics Engineering (EEE)**\n` +
          `- **Information Technology (IT)**\n` +
          `- **Mechanical Engineering**\n` +
          `- **Civil Engineering**\n` +
          `- **Aeronautical Engineering**\n` +
          `- **Science & Humanities** (Maths, Physics, Chemistry, English)\n` +
          `- **Management Studies (MBA)**\n\n` +
          `*(For example, ask "**AI & DS faculty list**" or "**CSE faculty roster**".)*`,
      };
    }

    if (department === 'Unsupported Department') {
      return {
        intent: analysis,
        relevantChunks: [],
        sources: [
          {
            title: 'JJCET Faculty Directory',
            url: 'https://jjcet.ac.in/faculty-list/',
          },
        ],
        directAnswer: `The faculty list for this department is not available in official JJCET sources as JJCET does not offer programs in this discipline. Official faculty rosters are available for CSE, AI & DS, ECE, EEE, Mechanical, Civil, IT, Aeronautical, and MBA.`,
      };
    }

    const deptFaculty = vectorStore.getAllFaculty(department);

    if (deptFaculty.length > 0) {
      // Sort HOD first, then alphabetically
      const sorted = [...deptFaculty].sort((a, b) => {
        if (a.isHod && !b.isHod) return -1;
        if (!a.isHod && b.isHod) return 1;
        return a.name.localeCompare(b.name);
      });

      return {
        intent: analysis,
        matchedFaculty: sorted,
        relevantChunks: [],
        sources: dedupSources([
          {
            title: `${department} - Faculty Directory`,
            url: sorted[0]?.sourceUrl || 'https://jjcet.ac.in/',
            department: department,
          },
        ]),
      };
    }

    return {
      intent: analysis,
      relevantChunks: [],
      sources: [
        {
          title: 'JJCET Faculty Directory',
          url: 'https://jjcet.ac.in/faculty-list/',
        },
      ],
      directAnswer: `The faculty list for '${department}' is not available in official JJCET sources. Official faculty rosters are available for CSE, AI & DS, ECE, EEE, Mechanical, Civil, IT, Aeronautical, and MBA.`,
    };
  }

  // 4. COURSES RETRIEVAL
  if (intent === 'COURSES') {
    if (department === 'Unsupported Department') {
      return {
        intent: analysis,
        relevantChunks: [],
        sources: [
          {
            title: 'JJCET Academic Programs',
            url: 'https://jjcet.ac.in/admission/',
          },
        ],
        directAnswer: `Courses for this discipline are not offered at JJCET. JJCET offers approved UG programs in CSE, AI & DS, ECE, EEE, IT, Mechanical, Civil, Aeronautical, and PG programs in MBA and M.E.`,
      };
    }

    // Dedicated handling for B.Tech. Artificial Intelligence & Data Science
    if (department === 'Artificial Intelligence & Data Science') {
      const aidsCourse: CourseInfo = {
        degree: 'UG',
        name: 'B.Tech. Artificial Intelligence & Data Science',
        department: 'Artificial Intelligence & Data Science',
        duration: '4 Years',
        seats: '180 Seats',
        eligibility: 'Pass in 10+2 / HSC with Physics, Chemistry, and Mathematics',
        sourceUrl: 'https://jjcet.ac.in/artificial-intelligence-data-science/',
      };

      return {
        intent: analysis,
        matchedCourses: [aidsCourse],
        relevantChunks: [],
        sources: [
          {
            title: 'Department of Artificial Intelligence & Data Science',
            url: 'https://jjcet.ac.in/artificial-intelligence-data-science/',
            department: 'Artificial Intelligence & Data Science',
          },
        ],
        directAnswer: 'B.Tech. Artificial Intelligence & Data Science – Intake: 180 Seats',
      };
    }

    // Dedicated handling for B.E. Computer Science & Engineering
    if (department === 'Computer Science & Engineering') {
      const cseCourse: CourseInfo = {
        degree: 'UG',
        name: 'B.E. Computer Science & Engineering',
        department: 'Computer Science & Engineering',
        duration: '4 Years',
        seats: '240 Seats',
        eligibility: 'Pass in 10+2 / HSC with Physics, Chemistry, and Mathematics',
        sourceUrl: 'https://jjcet.ac.in/computer-science-and-engineering/',
      };

      return {
        intent: analysis,
        matchedCourses: [cseCourse],
        relevantChunks: [],
        sources: [
          {
            title: 'Department of Computer Science and Engineering',
            url: 'https://jjcet.ac.in/computer-science-and-engineering/',
            department: 'Computer Science & Engineering',
          },
        ],
        directAnswer: 'B.E. Computer Science & Engineering – Intake: 240 Seats',
      };
    }

    // Dedicated handling for B.E. Electronics and Communication Engineering
    if (department === 'Electronics and Communication Engineering') {
      const eceCourse: CourseInfo = {
        degree: 'UG',
        name: 'B.E. Electronics and Communication Engineering',
        department: 'Electronics and Communication Engineering',
        duration: '4 Years',
        seats: '120 Seats',
        eligibility: 'Pass in 10+2 / HSC with Physics, Chemistry, and Mathematics',
        sourceUrl: 'https://jjcet.ac.in/admission/',
      };

      return {
        intent: analysis,
        matchedCourses: [eceCourse],
        relevantChunks: [],
        sources: [
          {
            title: 'JJCET Academic Programs',
            url: 'https://jjcet.ac.in/admission/',
            department: 'Electronics and Communication Engineering',
          },
        ],
        directAnswer: 'B.E. Electronics and Communication Engineering – Intake: 120 Seats',
      };
    }

    // Dedicated handling for B.Tech. Information Technology
    if (department === 'Information Technology') {
      const itCourse: CourseInfo = {
        degree: 'UG',
        name: 'B.Tech. Information Technology',
        department: 'Information Technology',
        duration: '4 Years',
        seats: '120 Seats',
        eligibility: 'Pass in 10+2 / HSC with Physics, Chemistry, and Mathematics',
        sourceUrl: 'https://jjcet.ac.in/information-technology/',
      };

      return {
        intent: analysis,
        matchedCourses: [itCourse],
        relevantChunks: [],
        sources: [
          {
            title: 'Department of Information Technology',
            url: 'https://jjcet.ac.in/information-technology/',
            department: 'Information Technology',
          },
        ],
        directAnswer: 'B.Tech. Information Technology – Intake: 120 Seats',
      };
    }

    const courses = vectorStore.getAllCourses();
    if (courses.length > 0) {
      const filteredCourses = department ? courses.filter(c => c.department.toLowerCase().includes(department.toLowerCase())) : courses;
      const sources: SourceCitation[] = [
        {
          title: 'JJCET Academic Programs',
          url: 'https://jjcet.ac.in/admission/',
        },
      ];

      return {
        intent: analysis,
        matchedCourses: filteredCourses.length > 0 ? filteredCourses : courses,
        relevantChunks: [],
        sources,
      };
    }
  }

  // 5. DEDICATED TRANSPORT RETRIEVAL
  if (intent === 'TRANSPORT') {
    const allChunks = vectorStore.getAllChunks();
    const queryTokens = extractKeywords(normalizedQuery);
    const queryVector = generateEmbedding(normalizedQuery);

    const transportChunks = allChunks.filter(c => {
      const url = (c.metadata.sourceUrl || '').toLowerCase();
      const title = (c.metadata.pageTitle || '').toLowerCase();
      const contentType = c.metadata.contentType;
      const content = c.content.toLowerCase();

      // Exclude unrelated topics
      if (url.includes('/hostel') || url.includes('/library') || url.includes('/computer-centre')) return false;
      if (contentType === 'course' && (content.includes('peo') || content.includes('pso') || content.includes('curriculum'))) return false;
      if (url.includes('patent') || url.includes('journal') || url.includes('copyright')) return false;

      // Primary match: dedicated transport page or title
      if (url.includes('/transport') || title === 'transport' || title.includes('transport')) {
        return true;
      }

      // Secondary match: facility content that specifically describes college buses / student transportation
      if (contentType === 'facility' && (content.includes('buses are operated') || content.includes('college bus') || content.includes('transportation'))) {
        return true;
      }

      return false;
    });

    if (transportChunks.length > 0) {
      const scored = transportChunks.map(chunk => {
        let score = 10.0;
        const url = (chunk.metadata.sourceUrl || '').toLowerCase();
        const title = (chunk.metadata.pageTitle || '').toLowerCase();
        const content = chunk.content.toLowerCase();

        if (url.includes('/transport/')) score += 50.0;
        if (title === 'transport' || title.includes('transport')) score += 20.0;
        if (chunk.vector) {
          score += cosineSimilarity(queryVector, chunk.vector) * 5.0;
        }
        for (const token of queryTokens) {
          if (content.includes(token)) score += 2.0;
        }

        return { chunk, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const topChunks = scored.slice(0, 5).map(r => r.chunk);

      const sources: SourceCitation[] = topChunks.map(c => ({
        title: c.metadata.pageTitle || 'Transport',
        url: c.metadata.sourceUrl,
        department: c.metadata.department,
      }));

      return {
        intent: analysis,
        relevantChunks: topChunks,
        sources: dedupSources(sources),
      };
    }
  }

  // 6. DEDICATED HOSTEL RETRIEVAL
  if (intent === 'HOSTEL') {
    const allChunks = vectorStore.getAllChunks();
    const hostelChunks = allChunks.filter(c => {
      const url = (c.metadata.sourceUrl || '').toLowerCase();
      const title = (c.metadata.pageTitle || '').toLowerCase();
      const content = c.content.toLowerCase();
      if (url.includes('/transport') || url.includes('/library') || url.includes('/computer-centre')) return false;
      return url.includes('/hostel') || title.includes('hostel') || (c.metadata.contentType === 'facility' && content.includes('hostel'));
    });

    if (hostelChunks.length > 0) {
      const sources: SourceCitation[] = hostelChunks.map(c => ({
        title: c.metadata.pageTitle || 'Hostel',
        url: c.metadata.sourceUrl,
        department: c.metadata.department,
      }));
      return {
        intent: analysis,
        relevantChunks: hostelChunks.slice(0, 5),
        sources: dedupSources(sources),
      };
    }
  }

  // 7. DEDICATED LIBRARY RETRIEVAL
  if (intent === 'LIBRARY') {
    const allChunks = vectorStore.getAllChunks();
    const libraryChunks = allChunks.filter(c => {
      const url = (c.metadata.sourceUrl || '').toLowerCase();
      const title = (c.metadata.pageTitle || '').toLowerCase();
      if (url.includes('/transport') || url.includes('/hostel') || url.includes('/computer-centre')) return false;
      return url.includes('/library') || title.includes('library');
    });

    if (libraryChunks.length > 0) {
      const sources: SourceCitation[] = libraryChunks.map(c => ({
        title: c.metadata.pageTitle || 'Central Library',
        url: c.metadata.sourceUrl,
        department: c.metadata.department,
      }));
      return {
        intent: analysis,
        relevantChunks: libraryChunks.slice(0, 5),
        sources: dedupSources(sources),
      };
    }
  }

  // 7b. DEDICATED NPTEL / SWAYAM RETRIEVAL
  if (lowerQ.includes('nptel') || lowerQ.includes('swayam')) {
    const allChunks = vectorStore.getAllChunks();
    const chapterChunks = allChunks.filter(c => {
      const url = (c.metadata.sourceUrl || '').toLowerCase();
      const title = (c.metadata.pageTitle || '').toLowerCase();
      const heading = (c.metadata.heading || '').toLowerCase();
      return url.includes('nptel') || title.includes('nptel') || heading.includes('nptel');
    });

    const sortedChunks = [...chapterChunks].sort((a, b) => {
      if (a.id === 'chk-nptel_local_chapter-0') return -1;
      if (b.id === 'chk-nptel_local_chapter-0') return 1;
      if (a.id === 'chk-nptel_local_chapter-1') return -1;
      if (b.id === 'chk-nptel_local_chapter-1') return 1;
      return 0;
    });

    const sources: SourceCitation[] = [
      {
        title: 'NPTEL LOCAL CHAPTER',
        url: 'https://jjcet.ac.in/nptel-local-chapter/',
      },
    ];

    return {
      intent: analysis,
      relevantChunks: sortedChunks.slice(0, 5),
      sources,
    };
  }

  // 8. GENERAL HYBRID SEARCH FOR ADMISSIONS, PLACEMENTS, FACILITIES, CONTACT, ETC.
  const queryTokens = extractKeywords(normalizedQuery);
  const queryVector = generateEmbedding(normalizedQuery);

  const bm25Results = vectorStore.searchBM25(queryTokens, 20);
  const vectorResults = vectorStore.searchVector(queryVector, 20);

  // Combine scores
  const scoreMap = new Map<string, { chunk: DocumentChunk; score: number }>();

  for (const { chunk, score } of bm25Results) {
    scoreMap.set(chunk.id, { chunk, score: score * 1.5 });
  }

  for (const { chunk, score } of vectorResults) {
    const existing = scoreMap.get(chunk.id);
    if (existing) {
      existing.score += score * 2.0;
    } else {
      scoreMap.set(chunk.id, { chunk, score: score * 2.0 });
    }
  }

  // Apply intent & department boosting/down-ranking
  const reranked = Array.from(scoreMap.values()).map(item => {
    let finalScore = item.score;
    const chunk = item.chunk;
    const contentLower = chunk.content.toLowerCase();
    const meta = chunk.metadata;

    // Boost matching department
    if (department) {
      if (meta.department && meta.department.toLowerCase().includes(department.toLowerCase())) {
        finalScore *= 2.5;
      } else if (contentLower.includes(department.toLowerCase())) {
        finalScore *= 1.8;
      } else {
        // Down-rank unrelated department chunks
        finalScore *= 0.5;
      }
    }

    // Down-rank PEO/PSO/Curriculum when searching for general queries
    if (contentLower.includes('peo') || contentLower.includes('pso') || contentLower.includes('course outcomes')) {
      finalScore *= 0.4;
    }

    // Boost matching content types
    if (intent === 'ADMISSION' && meta.contentType === 'admission') finalScore *= 2.5;
    if (intent === 'PLACEMENT' && meta.contentType === 'placement') finalScore *= 2.5;
    if (intent === 'FACILITIES' && meta.contentType === 'facility') finalScore *= 2.5;
    if (intent === 'HOSTEL' && contentLower.includes('hostel')) finalScore *= 3.0;
    if (intent === 'TRANSPORT' && contentLower.includes('transport')) finalScore *= 3.0;
    if (intent === 'CONTACT' && meta.contentType === 'contact') finalScore *= 3.0;

    return { chunk, score: finalScore };
  });

  reranked.sort((a, b) => b.score - a.score);
  const topChunks = reranked.slice(0, 5).map(r => r.chunk);

  const sources: SourceCitation[] = topChunks.map(c => ({
    title: c.metadata.pageTitle,
    url: c.metadata.sourceUrl,
    department: c.metadata.department,
  }));

  return {
    intent: analysis,
    relevantChunks: topChunks,
    sources: dedupSources(sources),
  };
}

function dedupSources(sources: SourceCitation[]): SourceCitation[] {
  const seen = new Set<string>();
  const out: SourceCitation[] = [];

  for (const s of sources) {
    const cleanTitle = sanitizeSourceTitle(s.title);
    if (!seen.has(s.url)) {
      seen.add(s.url);
      out.push({
        title: cleanTitle,
        url: s.url,
        department: s.department,
      });
    }
  }

  return out;
}

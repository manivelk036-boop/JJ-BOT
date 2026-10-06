import { FacultyMember, DocumentChunk, FacultyAggregatedProfile, SourceCitation } from '../types.js';
import { sanitizeSourceTitle } from '../ai/sanitizer.js';
import { cleanFacultyFieldValue } from '../ingestion/extractors.js';

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function transliterateTamilToEnglish(input: string): string {
  // Common name roots for high accuracy
  const commonMap: Record<string, string> = {
    'அம்பிகா': 'ambika',
    'சுரேஷ்': 'suresh',
    'சுமித்ரா': 'sumithra',
    'செல்லம்மாள்': 'chellammal',
    'கனகராஜ்': 'kanagaraj',
    'சதீஷ்': 'sathish',
    'ஜெயந்தி': 'jayanthi',
    'ஆனந்த்': 'anand',
    'கார்த்திக்': 'karthik',
    'மணிவண்ணன்': 'manivannan',
    'சரவணன்': 'saravanan'
  };

  for (const [ta, en] of Object.entries(commonMap)) {
    if (input.includes(ta)) {
      input = input.replace(new RegExp(ta, 'g'), en);
    }
  }

  const vowels: Record<string, string> = {
    'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo',
    'எ': 'e', 'ஏ': 'e', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'o', 'ஔ': 'au'
  };
  const consonantBase: Record<string, string> = {
    'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'nj', 'ட': 't', 'ண': 'n',
    'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r',
    'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
    'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h'
  };
  const signs: Record<string, string> = {
    'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo',
    'ெ': 'e', 'ே': 'e', 'ை': 'ai', 'ொ': 'o', 'ோ': 'o', 'ௌ': 'au',
    '்': ''
  };

  let result = '';
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (vowels[ch]) {
      result += vowels[ch];
      i++;
    } else if (consonantBase[ch]) {
      const base = consonantBase[ch];
      const next = input[i + 1];
      if (next && signs[next] !== undefined) {
        result += base + signs[next];
        i += 2;
      } else {
        result += base + 'a';
        i++;
      }
    } else if (signs[ch] !== undefined) {
      result += signs[ch];
      i++;
    } else {
      result += ch;
      i++;
    }
  }
  return result;
}

export function cleanPersonQuery(rawQuery: string): string {
  let q = rawQuery
    .toLowerCase()
    // Respectful titles & suffixes (must never prevent person matching)
    .replace(/\b(mam|maam|madam|sir|miss|mister|dr|mr|mrs|ms|prof|professor|avanga|avargal)\b/gi, ' ')
    // English question markers
    .replace(/\b(who is|tell me about|profile of|profile|details of|details|about|faculty|staff|info|information)\b/gi, ' ')
    // Thanglish conversational markers & verbs (must never be treated as part of person name)
    .replace(/\b(yaaru|yaar|pathi|paththi|patri|sollu|sollunga|kudu|kudunga|enna|epdi|eppadi|evlo|evvalavu|irukku|iruku|irukka|iruka|venum|oda|udaiya|la|le|ku|kku)\b/gi, ' ')
    // Common attributes queried in questions
    .replace(/\b(qualification|qualifications|publication|publications|journal|journals|patent|patents|experience|department|degree|paper|papers|project|projects|achievements|fdp|conference|conferences|workshop|workshops)\b/gi, ' ')
    // Tamil script particles & honorifics
    .replace(/(யார்|பற்றி|சொல்லு|சொல்லுங்கள்|விவரங்கள்|தகவல்|பேராசிரியர்|கல்வித்தகுதி|ஆராய்ச்சி|மேம்|மேடம்|சார்|டாக்டர்|அவர்கள்|அவுங்க)/g, ' ');

  // If query contains Tamil Unicode script, transliterate to Latin for index matching
  if (/[\u0B80-\u0BFF]/.test(q)) {
    q = transliterateTamilToEnglish(q);
  }

  return q
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves a query to one or more official JJCET faculty members.
 * Implements tiered priority matching:
 * 1. Exact full-name match has highest priority.
 * 2. Normalized full-name / initials match next (e.g. "k suresh", "m ambika").
 * 3. Partial / surname matching:
 *    - If query is a surname shared by multiple people (e.g. "Suresh"), returns all matches
 *      so that a disambiguation list can be shown rather than falsely merging distinct identities.
 *    - If query matches a unique person in the college (e.g. "Ambika", "Sumithra"), returns that single person.
 * 4. Strict typo tolerance (Levenshtein distance === 1 for tokens >= 5 chars, e.g. "ambikaa" -> "Ambika").
 */
export function resolvePersonName(
  query: string,
  allFaculty: FacultyMember[]
): FacultyMember[] {
  const qClean = cleanPersonQuery(query);
  if (!qClean || qClean.length < 2) return [];

  const qTokens = qClean.split(' ').filter(t => t.length > 0);
  if (qTokens.length === 0) return [];

  // Stage 1: Exact normalized full-name match (highest priority)
  const exact = allFaculty.filter(f => f.normalizedName === qClean);
  if (exact.length === 1) return exact;

  // Stage 2: Normalized full-name / initials match (e.g. "k suresh", "m ambika", "p chellammal")
  if (qTokens.length > 1) {
    const multiMatches = allFaculty.filter(f => {
      const fTokens = f.normalizedName.split(' ');
      return qTokens.every(qt => fTokens.some(ft => ft === qt || (qt.length === 1 && ft.startsWith(qt))));
    });
    if (multiMatches.length > 0) return multiMatches;
  }

  // Stage 3: Single-token / surname matching
  if (qTokens.length === 1) {
    const qToken = qTokens[0];

    // Check exact surname match (e.g. "suresh" or "ambika")
    const surnameMatches = allFaculty.filter(f => {
      const fTokens = f.normalizedName.split(' ');
      const fLastName = fTokens[fTokens.length - 1];
      return fLastName === qToken || (fLastName.startsWith(qToken) && qToken.length >= 6);
    });

    if (surnameMatches.length > 0) {
      return surnameMatches;
    }

    // Substring in normalized name (min 4 characters)
    const substringMatches = allFaculty.filter(f => f.normalizedName.includes(qToken) && qToken.length >= 4);
    if (substringMatches.length > 0) {
      return substringMatches;
    }

    // Stage 4: Typo tolerance (Levenshtein distance === 1 on surname for tokens >= 5 chars)
    if (qToken.length >= 5) {
      const typoMatches: FacultyMember[] = [];
      for (const f of allFaculty) {
        const fTokens = f.normalizedName.split(' ');
        const fLastName = fTokens[fTokens.length - 1];
        if (fLastName.length >= 5 && levenshteinDistance(qToken, fLastName) === 1) {
          typoMatches.push(f);
        }
      }
      if (typoMatches.length > 0) return typoMatches;
    }
  }

  return [];
}

/**
 * Cleans markdown table artifacts, row indexes, and raw delimiters.
 */
function cleanRecordLine(text: string): string {
  return text
    .replace(/^(\s*(?:s\.?\s*no\.?|sl\.?\s*no\.?|row|no\.?|#)?\s*\d+\s*[\|\.\)\-:]\s*)+/i, '')
    .replace(/^\[TABLE\]\s*/i, '')
    .replace(/\s*\[\/TABLE\]/i, '')
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifies whether a given record/line can be confidently attributed
 * to the specified faculty member, preventing cross-contamination when multiple
 * people share the same surname (e.g. Dr. K. Suresh vs Dr. P. Suresh vs Dr. G. Suresh).
 */
export function isRecordAttributedToFaculty(
  line: string,
  chunk: DocumentChunk,
  faculty: FacultyMember,
  allFaculty: FacultyMember[] = []
): boolean {
  const norm = faculty.normalizedName;
  const parts = norm.split(' ');
  const lastName = parts[parts.length - 1];
  const initial = parts[0];

  const lineWithoutInst = line.replace(/sowdambikaa?/gi, '');
  const nameWordRegex = new RegExp(`\\b${lastName}\\b`, 'i');
  if (!nameWordRegex.test(lineWithoutInst)) return false;

  // Identify any other faculty members in JJCET who share the same surname
  const otherFacultyWithSameSurname = allFaculty.filter(
    f => f.id !== faculty.id && f.normalizedName.split(' ').pop() === lastName
  );

  if (otherFacultyWithSameSurname.length > 0) {
    // 1. Check for conflicting initials
    for (const other of otherFacultyWithSameSurname) {
      const otherInitial = other.normalizedName.split(' ')[0];
      if (otherInitial && otherInitial !== initial) {
        // Line explicitly mentions other faculty's initial (e.g. "P. Suresh", "Dr. P. Suresh", "Suresh P")
        const otherInitRegex = new RegExp(`\\b${otherInitial}[.\\s]+${lastName}\\b`, 'i');
        const otherSurnameInitRegex = new RegExp(`\\b${lastName}[.\\s]+${otherInitial}\\b`, 'i');
        if (otherInitRegex.test(lineWithoutInst) || otherSurnameInitRegex.test(lineWithoutInst)) {
          return false; // Belongs to the other person
        }
      }

      // Check for conflicting department
      if (other.department !== faculty.department) {
        const otherDeptCode = other.department.includes('Mechanical') ? 'MECH' :
                              other.department.includes('Electronics and Communication') ? 'ECE' :
                              other.department.includes('Electrical and Electronics') ? 'EEE' :
                              other.department.includes('Civil') ? 'CIVIL' : '';
        if (otherDeptCode && new RegExp(`\\b${otherDeptCode}\\b`, 'i').test(line) && !line.includes('CSE')) {
          return false;
        }
      }
    }

    // 2. Positive attribution check:
    // Requires either this person's initial OR department match (without conflicting title/initials)
    const hasThisInitial =
      new RegExp(`\\b${initial}[.\\s]+${lastName}\\b`, 'i').test(lineWithoutInst) ||
      new RegExp(`\\b${lastName}[.\\s]+${initial}\\b`, 'i').test(lineWithoutInst);

    const hasFacultyDept =
      (chunk.metadata.department && chunk.metadata.department.toLowerCase().includes(faculty.department.toLowerCase())) ||
      line.toLowerCase().includes(faculty.department.toLowerCase()) ||
      (faculty.department.includes('Computer Science') && /\bCSE\b/i.test(line)) ||
      (faculty.department.includes('Electronics and Communication') && /\bECE\b/i.test(line)) ||
      (faculty.department.includes('Mechanical') && /\bMECH\b/i.test(line));

    return hasThisInitial || (hasFacultyDept && !/dr\.?\s*[a-z][.\s]/i.test(lineWithoutInst));
  }

  // Unique surname across the college (e.g. Ambika, Sumithra, Chellammal, Kanagaraj)
  return true;
}

/**
 * Aggregates all officially available information for a specific faculty member
 * across all persistent index chunks, applying strict canonical attribution and deduplication.
 */
export function aggregateFacultyProfile(
  faculty: FacultyMember,
  allChunks: DocumentChunk[],
  allFaculty: FacultyMember[] = []
): FacultyAggregatedProfile {
  const norm = faculty.normalizedName;
  const parts = norm.split(' ');
  const lastName = parts[parts.length - 1];
  const initial = parts[0];

  const qualifications = new Set<string>();
  if (faculty.qualification) {
    qualifications.add(cleanFacultyFieldValue(faculty.qualification, false) || faculty.qualification);
  }

  const books = new Set<string>();
  const journals = new Set<string>();
  const conferences = new Set<string>();
  const patents = new Set<string>();
  const projects = new Set<string>();
  const fdpsWorkshops = new Set<string>();
  const achievements = new Set<string>();
  const responsibilities = new Set<string>();
  const sourceCitationsMap = new Map<string, SourceCitation>();

  // Always include the faculty member's direct department source URL with sanitized title
  sourceCitationsMap.set(faculty.sourceUrl, {
    title: sanitizeSourceTitle(`${faculty.department} - Faculty Profile`),
    url: faculty.sourceUrl,
    department: faculty.department,
  });

  const nameWordRegex = new RegExp(`\\b${lastName}\\b`, 'i');

  allChunks.forEach(chunk => {
    const text = chunk.content;
    if (!nameWordRegex.test(text)) return;

    // Filter out institutional mentions of "Sowdambikaa"
    const textWithoutInstitution = text.replace(/sowdambikaa?/gi, '');
    if (!nameWordRegex.test(textWithoutInstitution)) return;

    // Verify chunk has relevant records for this specific person
    const isDirectSource = chunk.metadata.sourceUrl === faculty.sourceUrl;
    const lines = text.split('\n');
    const hasAttributedLines = lines.some(l => isRecordAttributedToFaculty(l, chunk, faculty, allFaculty));

    if (!hasAttributedLines && !isDirectSource) {
      return;
    }

    // Process chunk content lines
    lines.forEach(rawLine => {
      const line = rawLine.trim();
      if (!line) return;

      if (!isRecordAttributedToFaculty(line, chunk, faculty, allFaculty) && !isDirectSource) {
        return;
      }

      // Add source citation for this contributing page with sanitized title
      if (!sourceCitationsMap.has(chunk.metadata.sourceUrl)) {
        sourceCitationsMap.set(chunk.metadata.sourceUrl, {
          title: sanitizeSourceTitle(chunk.metadata.pageTitle),
          url: chunk.metadata.sourceUrl,
          department: chunk.metadata.department || faculty.department,
        });
      }

      const cleaned = cleanRecordLine(line);
      if (!cleaned || cleaned.length < 5) return;

      // Extract degree qualifications if explicitly mentioned (e.g. M.E., Ph.D.)
      const qualMatch = line.match(/\b(Ph\.?D\.?|M\.?E\.?|M\.?Tech\.?|M\.?Phil\.?|B\.?E\.?|B\.?Tech\.?|M\.?Sc\.?|MCA|MBA)\b/g);
      if (qualMatch) {
        qualMatch.forEach(q => qualifications.add(q));
      }

      const sUrl = chunk.metadata.sourceUrl;
      const lowerLine = line.toLowerCase();

      // Categorize record line
      if (
        sUrl.includes('patent') ||
        lowerLine.includes('patent |') ||
        lowerLine.includes('patent') ||
        (line.includes('202') && (line.includes('410') || line.includes('Design No') || line.includes('Published')))
      ) {
        patents.add(cleaned);
      } else if (
        (sUrl.includes('book-publication-details') && !sUrl.includes('book-publication-details-2')) ||
        lowerLine.includes('book |') ||
        lowerLine.includes('book chapter |') ||
        (line.includes('Publications') && line.includes('978-'))
      ) {
        books.add(cleaned);
      } else if (
        sUrl.includes('book-publication-details-2') ||
        lowerLine.includes('conference |') ||
        lowerLine.includes('conference') ||
        lowerLine.includes('international conference')
      ) {
        conferences.add(cleaned);
      } else if (
        sUrl.includes('jounal') ||
        sUrl.includes('journal') ||
        lowerLine.includes('journal |') ||
        line.includes('ISSN:')
      ) {
        journals.add(cleaned);
      } else if (
        sUrl.includes('cell') ||
        sUrl.includes('edc') ||
        sUrl.includes('committee') ||
        sUrl.includes('council') ||
        sUrl.includes('nptel') ||
        sUrl.includes('iic') ||
        sUrl.includes('iqac')
      ) {
        responsibilities.add(`${cleaned} (${sanitizeSourceTitle(chunk.metadata.pageTitle)})`);
      } else if (chunk.metadata.heading === 'Achievements') {
        achievements.add(cleaned);
      } else if (lowerLine.includes('fdp') || lowerLine.includes('workshop')) {
        fdpsWorkshops.add(cleaned);
      }
    });
  });

  return {
    name: faculty.name,
    department: faculty.department,
    designation: faculty.designation,
    qualification: Array.from(qualifications).join(', ') || faculty.qualification,
    qualifications: Array.from(qualifications),
    isQualificationVerified: faculty.isQualificationVerified ?? (qualifications.size > 0),
    qualificationSource: faculty.qualificationSource ?? (qualifications.size > 0 ? 'official_authoritative_document' : 'department_standard_unverified'),
    experience: faculty.experience ? cleanFacultyFieldValue(faculty.experience, true) : undefined,
    specialization: faculty.specialization ? cleanFacultyFieldValue(faculty.specialization, false) : undefined,
    profileUrl: faculty.profileUrl,
    sourceUrl: faculty.sourceUrl,
    books: deduplicateRecords(Array.from(books), lastName),
    journals: deduplicateRecords(Array.from(journals), lastName),
    conferences: deduplicateRecords(Array.from(conferences), lastName),
    patents: deduplicateRecords(Array.from(patents), lastName),
    projects: deduplicateRecords(Array.from(projects), lastName),
    fdpsWorkshops: deduplicateRecords(Array.from(fdpsWorkshops), lastName),
    achievements: deduplicateRecords(Array.from(achievements), lastName),
    responsibilities: deduplicateRecords(Array.from(responsibilities), lastName),
    sourceCitations: Array.from(sourceCitationsMap.values()),
  };
}

/**
 * Derives a canonical fingerprint/key for a record to identify identical publications,
 * patents, or activities regardless of author variations (e.g. Mrs.Ambika vs M. Ambika vs Ms. M. Ambika Assistant Professor),
 * duplicate quote marks, or formatting differences.
 */
export function getCanonicalRecordKey(text: string, facultyLastName?: string): string {
  // 1. Patent Number (e.g. 202341017990 or 202341017990A -> pat-202341017990)
  const patentMatch = text.match(/\b(20\d{10})[A-Za-z]?\b/);
  if (patentMatch) {
    return `pat-${patentMatch[1]}`;
  }

  // 2. Design patent number (e.g. Design No. 451764-001)
  const designMatch = text.match(/\bdesign\s*no\.?\s*([\d-]+)\b/i);
  if (designMatch) {
    return `design-${designMatch[1].replace(/[^0-9]/g, '')}`;
  }

  // 3. ISBN (e.g. 978-81-1931-319-8 -> isbn-9788119313198)
  const isbnMatch = text.match(/\b(978[-\d]+)\b/);
  if (isbnMatch) {
    return `isbn-${isbnMatch[1].replace(/[^0-9]/g, '')}`;
  }

  // 4. DOI
  const doiMatch = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/);
  if (doiMatch) {
    return `doi-${doiMatch[0].toLowerCase()}`;
  }

  // 5. Extract core title by splitting pipes or stripping author/dept columns
  let candidateTitle = text;
  if (text.includes('|')) {
    const parts = text.split('|').map(p => p.trim());
    const contentParts = parts.filter(p => {
      const lower = p.toLowerCase();
      if (facultyLastName && lower.includes(facultyLastName.toLowerCase())) return false;
      if (/^(dr|mr|mrs|ms|prof)[.\s]/i.test(p)) return false;
      if (/^(cse|ece|mech|eee|it|civil|aids|mba|journal|conference|patent|book|coference)$/i.test(p)) return false;
      if (/^\d{1,3}$/.test(p)) return false;
      return p.length > 5;
    });

    if (contentParts.length > 0) {
      candidateTitle = contentParts[0];
    }
  }

  // Continuous alphanumeric fingerprint (spaces and punctuation stripped)
  const alphaFingerprint = candidateTitle
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 45);

  return alphaFingerprint || text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 45);
}

/**
 * Selects the richer, more informative representation between two identical records.
 */
function computeRecordRichnessScore(text: string): number {
  let score = text.length;
  // Boost if contains date (e.g. 2023, 31.03.2023)
  if (/\b\d{2}\.\d{2}\.\d{4}\b/.test(text) || /\b202[0-9]\b/.test(text)) score += 50;
  // Boost if contains patent number
  if (/20\d{10}/.test(text)) score += 100;
  // Boost if contains journal venue, ISSN, ISBN, or DOI
  if (/ISSN|ISBN|DOI|Publish/i.test(text)) score += 50;
  // Penalize redundant repeated quotes
  if (/[”"']{2,}/.test(text)) score -= 30;
  return score;
}

/**
 * Deduplicates a list of record strings using canonical keys,
 * preserving only one entry per genuinely identical publication/patent/activity.
 */
export function deduplicateRecords(records: string[], facultyLastName?: string): string[] {
  const map = new Map<string, string>();

  for (const r of records) {
    const key = getCanonicalRecordKey(r, facultyLastName);
    if (!key || key.length < 5) continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
    } else {
      if (computeRecordRichnessScore(r) > computeRecordRichnessScore(existing)) {
        map.set(key, r);
      }
    }
  }

  return Array.from(map.values());
}

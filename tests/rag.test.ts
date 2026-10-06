import { vectorStore } from '../server/rag/vectorStore.js';
import { analyzeIntent } from '../server/rag/intent.js';
import { executeHybridSearch } from '../server/rag/hybridSearch.js';
import { generateGroundedAnswer } from '../server/ai/gemini.js';
import { cleanFacultyFieldValue } from '../server/ingestion/extractors.js';
import { getCanonicalRecordKey } from '../server/rag/profileAggregator.js';

interface TestCase {
  id: number;
  query: string;
  expectedIntent?: string;
  validate: (answer: string, sources: any[], retrieval: any) => boolean;
  description: string;
}

const testCases: TestCase[] = [
  {
    id: 1,
    query: 'CSE HOD yaaru?',
    expectedIntent: 'HOD',
    validate: (answer, sources) => {
      const pass = answer.toLowerCase().includes('suresh') && sources.some(s => s.url.includes('computer-science'));
      const cleanExp = !answer.includes('14. 10') && !/\b\d+[\.\)]\s+\d+\s+years/i.test(answer);
      return pass && cleanExp;
    },
    description: 'CSE HOD query returns Dr. K. Suresh with CSE source and clean experience value (no unwanted numeric prefix)',
  },
  {
    id: 2,
    query: 'ECE HOD yaaru?',
    expectedIntent: 'HOD',
    validate: (answer, sources) => {
      const pass = answer.toLowerCase().includes('sumithra') && sources.some(s => s.url.includes('electronics'));
      return pass;
    },
    description: 'ECE HOD query returns Dr. S. Sumithra with ECE source',
  },
  {
    id: 3,
    query: 'CSE faculty full list kudu',
    expectedIntent: 'FACULTY',
    validate: (answer) => {
      // 1. Must contain standard Markdown table with 4 separate columns and separator
      const hasHeader = answer.includes('| S.No | Faculty Name | Designation | Qualification |');
      const hasSeparator = answer.includes('|------|--------------|-------------|---------------|');
      const hasAll50 = answer.includes('| 50 |');

      // 2. Exactly 50 data rows
      const dataRows = answer.split('\n').filter(line => /^\|\s*\d+\s*\|/.test(line));
      const has50Rows = dataRows.length === 50;

      // 3. Dr. K. Suresh => M.E., Ph.D.
      const sureshRow = dataRows.find(r => r.includes('Dr. K. Suresh'));
      const sureshQualPass = sureshRow ? sureshRow.includes('M.E., Ph.D.') : false;

      // 4. At least 3 other faculty with qualification data populated:
      // Mrs. M. Ambika => M.E.
      // Dr. P. Chellammal => M.E., Ph.D.
      // Mrs. J. S. Jaslin => M.E.
      // Mrs. T. Keerthana Jerine => M.E.
      // Dr. J. Erin Shine => M.Tech., Ph.D.
      const ambikaRow = dataRows.find(r => r.includes('Mrs. M. Ambika'));
      const ambikaPass = ambikaRow ? ambikaRow.includes('M.E.') : false;

      const chellammalRow = dataRows.find(r => r.includes('Dr. P. Chellammal'));
      const chellammalPass = chellammalRow ? chellammalRow.includes('M.E., Ph.D.') : false;

      const jaslinRow = dataRows.find(r => r.includes('Mrs. J. S. Jaslin'));
      const jaslinPass = jaslinRow ? jaslinRow.includes('M.E.') : false;

      const keerthanaRow = dataRows.find(r => r.includes('Mrs. T. Keerthana Jerine'));
      const keerthanaPass = keerthanaRow ? keerthanaRow.includes('M.E.') : false;

      // 5. Faculty members have accredited qualifications populated (no "-")
      const ramananRow = dataRows.find(r => r.includes('Mr. S. Ramanan'));
      const ramananPass = ramananRow ? (!ramananRow.endsWith('| - |') && ramananRow.includes('M.E.')) : false;

      const sivanesanRow = dataRows.find(r => r.includes('Dr. P. Sivanesan'));
      const sivanesanPass = sivanesanRow ? (!sivanesanRow.endsWith('| - |') && (sivanesanRow.includes('M.E., Ph.D.') || sivanesanRow.includes('Ph.D.'))) : false;

      // 6. Confusable pairs remain distinct rows with qualifications populated:
      const sathisRow = dataRows.find(r => r.includes('Mr. B. Sathis Kumar'));
      const sathishRow = dataRows.find(r => r.includes('Mr. B. Sathish Kumar'));
      const sathisPass = sathisRow ? (!sathisRow.endsWith('| - |') && sathisRow.includes('M.E.') && sathisRow !== sathishRow) : false;
      const sathishPass = sathishRow ? (!sathishRow.endsWith('| - |') && sathishRow.includes('M.E.')) : false;

      const shanmuagaRow = dataRows.find(r => r.includes('Mrs. G. Shanmuaga Priya'));
      const shanmugaRow = dataRows.find(r => r.includes('Mrs. G. Shanmuga Priya'));
      const shanmuagaPass = shanmuagaRow ? (!shanmuagaRow.endsWith('| - |') && shanmuagaRow.includes('M.E.') && shanmuagaRow !== shanmugaRow) : false;
      const shanmugaPass = shanmugaRow ? (!shanmugaRow.endsWith('| - |') && shanmugaRow.includes('M.E.')) : false;

      const jagatheeswaranRow = dataRows.find(r => r.includes('Mr. S. Jagatheeswaran'));
      const jagatheeswaranPass = jagatheeswaranRow ? (!jagatheeswaranRow.endsWith('| - |') && jagatheeswaranRow.includes('M.E.')) : false;

      const mageshwariRow = dataRows.find(r => r.includes('Mrs. P. Mageshwari'));
      const mageshwariPass = mageshwariRow ? (!mageshwariRow.endsWith('| - |') && mageshwariRow.includes('M.E.')) : false;

      const usharaniRow = dataRows.find(r => r.includes('Mrs. P. Usharani'));
      const usharaniPass = usharaniRow ? (!usharaniRow.endsWith('| - |') && usharaniRow.includes('M.E.')) : false;

      // All 50 rows must have non-empty qualifications (no "-")
      const noEmptyQual = dataRows.every(r => !r.endsWith('| - |'));

      // 7. No SVG or internal metadata leaks
      const noSvg = !/<svg[\s\S]*?<\/svg>/i.test(answer) &&
                    !/\bsvg\b/i.test(answer) &&
                    !/\bsvgverified\b/i.test(answer) &&
                    !/\bsvgsuggested\b/i.test(answer);

      return (
        hasHeader &&
        hasSeparator &&
        hasAll50 &&
        has50Rows &&
        sureshQualPass &&
        ambikaPass &&
        chellammalPass &&
        jaslinPass &&
        keerthanaPass &&
        ramananPass &&
        sivanesanPass &&
        sathisPass &&
        sathishPass &&
        shanmuagaPass &&
        shanmugaPass &&
        jagatheeswaranPass &&
        mageshwariPass &&
        usharaniPass &&
        noEmptyQual &&
        noSvg
      );
    },
    description: 'CSE faculty full list returns structured faculty table with 4 columns, 50 rows, verified qualifications for all 50 faculty members (zero empty "-" entries), keeping distinct confusable pairs',
  },
  {
    id: 4,
    query: 'CSE facullty list',
    expectedIntent: 'FACULTY',
    validate: (answer) => {
      const hasHeader = answer.includes('| S.No | Faculty Name | Designation | Qualification |');
      const hasSeparator = answer.includes('|------|--------------|-------------|---------------|');
      const hasAll50 = answer.includes('| 50 |');
      return hasHeader && hasSeparator && hasAll50;
    },
    description: 'Handles typo "facullty" and returns CSE faculty roster with 4 separate columns, separator, and all 50 members',
  },
  {
    id: 5,
    query: 'JJCET la enna courses irukku?',
    expectedIntent: 'COURSES',
    validate: (answer) => {
      const hasUG = answer.includes('Undergraduate') || answer.includes('B.E.');
      const hasTable = answer.includes('| Program / Branch |');
      return hasUG && hasTable;
    },
    description: 'Courses query returns UG/PG courses in structured table format',
  },
  {
    id: 6,
    query: 'Ambika',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer, sources, retrieval) => {
      const matchesAmbika = answer.toLowerCase().includes('ambika') && answer.toLowerCase().includes('computer science');
      const hasQualifications = answer.includes('M.E');
      const hasPublications = answer.includes('Publications') || answer.includes('Journal') || answer.includes('Information Security');
      const hasPatents = answer.includes('Patent') || answer.includes('Water Quality');
      const hasResponsibilities = answer.includes('Entrepreneurship Development Cell') || answer.includes('NPTEL');
      const hasMultipleSources = sources.length >= 2;
      const hasAggregatedProfile = retrieval?.aggregatedProfiles?.length === 1;

      // Assert NO duplicate records exist:
      // 1. Water Quality patent appears exactly once
      const waterQualityCount = (answer.match(/Water Quality/gi) || []).length;
      // 2. Information Security journal appears exactly once
      const infoSecCount = (answer.match(/Information Security/gi) || []).length;

      const profile = retrieval?.aggregatedProfiles?.[0];
      const singleWaterQualityPatent = (profile?.patents || []).filter(p => /water quality/i.test(p)).length === 1;
      const singleInfoSecJournal = (profile?.journals || []).filter(j => /information security/i.test(j)).length === 1;

      return (
        matchesAmbika &&
        hasQualifications &&
        hasPublications &&
        hasPatents &&
        hasResponsibilities &&
        hasMultipleSources &&
        hasAggregatedProfile &&
        waterQualityCount === 1 &&
        infoSecCount === 1 &&
        singleWaterQualityPatent &&
        singleInfoSecJournal
      );
    },
    description: 'Person lookup for "Ambika" returns complete official aggregated profile with zero duplicate records (Water Quality patent and Information Security journal appear exactly once)',
  },
  {
    id: 7,
    query: 'chelama',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer) => {
      const expected = "No official JJCET faculty or staff record was found for 'chelama'. Please check the spelling or provide the full name.";
      return answer.trim() === expected;
    },
    description: 'Unknown person "chelama" returns exact mandated no-record message',
  },
  {
    id: 8,
    query: 'chelamal',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer) => {
      const expected = "No official JJCET faculty or staff record was found for 'chelamal'. Please check the spelling or provide the full name.";
      return answer.trim() === expected;
    },
    description: 'Unknown person "chelamal" returns exact mandated no-record message',
  },
  {
    id: 9,
    query: 'Admission eligibility enna?',
    expectedIntent: 'ADMISSION',
    validate: (answer) => {
      const hasTNEA = answer.includes('TNEA') || answer.includes('10+2') || answer.includes('Eligibility');
      return hasTNEA;
    },
    description: 'Admission eligibility query returns verified TNEA & 10+2 criteria',
  },
  {
    id: 10,
    query: 'JJCET enga irukku?',
    expectedIntent: 'CONTACT',
    validate: (answer) => {
      const hasTrichy = answer.includes('Tiruchirappalli') || answer.includes('Trichy') || answer.includes('Ammapettai');
      return hasTrichy;
    },
    description: 'Location query returns Tiruchirappalli, Ammapettai campus address',
  },
  {
    id: 11,
    query: 'What facilities are available?',
    expectedIntent: 'FACILITIES',
    validate: (answer) => {
      const hasHostelOrLib = answer.toLowerCase().includes('hostel') || answer.toLowerCase().includes('library');
      return hasHostelOrLib;
    },
    description: 'Facilities query returns hostel, library, transport, labs information',
  },
  {
    id: 12,
    query: 'Placement details',
    expectedIntent: 'PLACEMENT',
    validate: (answer) => {
      const hasRecruiters = answer.toLowerCase().includes('zoho') || answer.toLowerCase().includes('tcs') || answer.toLowerCase().includes('placement');
      return hasRecruiters;
    },
    description: 'Placement query returns training & recruiter achievements (Zoho, TCS, etc.)',
  },
  {
    id: 13,
    query: 'Who is the CSE HOD?',
    expectedIntent: 'HOD',
    validate: (answer) => {
      // 1. Must NOT contain unwanted numeric row/list prefix like '14. 10'
      const hasMalformedPrefix = answer.includes('14. 10') || /\b\d+[\.\)]\s+\d+\s+years/i.test(answer);
      // 2. Must preserve the official experience value and format properly
      const hasCleanExperience = answer.includes('10 Years');
      const unitChecks =
        cleanFacultyFieldValue('14. 10 Years', true) === '10 Years' &&
        cleanFacultyFieldValue('14) 10 Years', true) === '10 Years' &&
        cleanFacultyFieldValue('14 - 10 Years', true) === '10 Years' &&
        cleanFacultyFieldValue('Row 1: 5 Years', true) === '5 Years' &&
        cleanFacultyFieldValue('S.No. 3 - 8 Years', true) === '8 Years' &&
        cleanFacultyFieldValue('13.6 Years', true) === '13.6 Years' &&
        cleanFacultyFieldValue('14 Years', true) === '14 Years' &&
        cleanFacultyFieldValue('26 Years 10 Month', true) === '26 Years 10 Month' &&
        cleanFacultyFieldValue('1. Dr. K. Suresh', false) === 'Dr. K. Suresh' &&
        cleanFacultyFieldValue('14. M.E., Ph.D.', false) === 'M.E., Ph.D.';

      return !hasMalformedPrefix && hasCleanExperience && unitChecks;
    },
    description: 'Regression test: Faculty experience & fields do not contain concatenated row/index prefixes, and cleanFacultyFieldValue preserves valid experience',
  },
  {
    id: 14,
    query: 'ambikaa',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer, sources, retrieval) => {
      const resolvesToAmbika = answer.includes('Mrs. M. Ambika');
      const hasPublications = answer.includes('Publications') || answer.includes('Journal');
      const hasSingleProfile = retrieval?.aggregatedProfiles?.length === 1;
      return resolvesToAmbika && hasPublications && hasSingleProfile;
    },
    description: 'Typo tolerance: "ambikaa" resolves to Mrs. M. Ambika and returns aggregated profile',
  },
  {
    id: 15,
    query: 'Sumithra',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer, sources, retrieval) => {
      const matchesSumithra = answer.includes('Dr. S. Sumithra');
      const isECE = answer.includes('Electronics and Communication Engineering');
      const hasDeanOrHOD = answer.includes('Dean Research') || answer.includes('HOD') || answer.includes('Professor');
      const hasPublications = answer.includes('Book Publications') || answer.includes('Journal Publications') || answer.includes('Publications');
      const hasIQACorNPTEL = answer.includes('IQAC') || answer.includes('NPTEL') || answer.includes('Committees');
      return matchesSumithra && isECE && hasDeanOrHOD && hasPublications && hasIQACorNPTEL;
    },
    description: 'Generic faculty profile for "Sumithra" returns Dr. S. Sumithra ECE profile across publications and committees',
  },
  {
    id: 16,
    query: 'Chellammal',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer, sources, retrieval) => {
      const matchesChellammal = answer.includes('Dr. P. Chellammal');
      const isCSE = answer.includes('Computer Science & Engineering');
      const hasPatentsOrPubs = answer.includes('Patents') || answer.includes('Publications');
      return matchesChellammal && isCSE && hasPatentsOrPubs;
    },
    description: 'Generic faculty profile for "Chellammal" returns Dr. P. Chellammal CSE profile across patents and publications',
  },
  {
    id: 17,
    query: 'Kanagaraj',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer, sources, retrieval) => {
      const matchesKanagaraj = answer.includes('Mr. A. Kanagaraj');
      const isCSE = answer.includes('Computer Science & Engineering');
      const hasNoFabricatedPubs = !answer.includes('Book Publications & Chapters');
      return matchesKanagaraj && isCSE && hasNoFabricatedPubs;
    },
    description: 'Generic faculty profile for "Kanagaraj" returns verified official record without fabricating missing sections',
  },
  {
    id: 18,
    query: 'Mrs. M. Ambika',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer, sources, retrieval) => {
      const profile = retrieval?.aggregatedProfiles?.[0];
      if (!profile) return false;

      // 1. Patents canonical uniqueness
      const patentKeys = profile.patents.map(p => getCanonicalRecordKey(p, 'ambika'));
      const uniquePatentKeys = new Set(patentKeys);
      const patentsDeduplicated = uniquePatentKeys.size === profile.patents.length;

      // 2. Journals canonical uniqueness
      const journalKeys = profile.journals.map(j => getCanonicalRecordKey(j, 'ambika'));
      const uniqueJournalKeys = new Set(journalKeys);
      const journalsDeduplicated = uniqueJournalKeys.size === profile.journals.length;

      // 3. Books canonical uniqueness
      const bookKeys = profile.books.map(b => getCanonicalRecordKey(b, 'ambika'));
      const uniqueBookKeys = new Set(bookKeys);
      const booksDeduplicated = uniqueBookKeys.size === profile.books.length;

      // 4. Conferences canonical uniqueness
      const confKeys = profile.conferences.map(c => getCanonicalRecordKey(c, 'ambika'));
      const uniqueConfKeys = new Set(confKeys);
      const confsDeduplicated = uniqueConfKeys.size === profile.conferences.length;

      // 5. Answer has no duplicate bullet items in rendered markdown
      const bulletLines = answer
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('- '));
      const uniqueBulletLines = new Set(bulletLines);
      const noDuplicateBullets = uniqueBulletLines.size === bulletLines.length;

      return (
        patentsDeduplicated &&
        journalsDeduplicated &&
        booksDeduplicated &&
        confsDeduplicated &&
        noDuplicateBullets
      );
    },
    description: 'Strict canonical deduplication test: Asserts zero duplicate normalized records across patents, journals, books, conferences, and rendered answer bullets',
  },
  {
    id: 19,
    query: 'Suresh',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer, sources, retrieval) => {
      const isDisambiguation =
        answer.includes('Multiple official JJCET faculty and staff records match') &&
        answer.includes('Dr. K. Suresh') &&
        answer.includes('Mr. S. Sureshkumar') &&
        answer.includes('Dr. P. Suresh') &&
        answer.includes('Dr. G. Suresh');
      const doesNotMerge = !answer.includes('### Dr. K. Suresh\n- **Department**');
      const hasDirectAnswer = !!retrieval.directAnswer;
      return isDisambiguation && doesNotMerge && hasDirectAnswer;
    },
    description: 'Ambiguous short query "Suresh" returns clean disambiguation list rather than guessing or merging records',
  },
  {
    id: 20,
    query: 'Dr. K. Suresh',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer, sources, retrieval) => {
      const isKSuresh = answer.includes('Dr. K. Suresh') && answer.includes('Computer Science & Engineering');
      const noPSuresh = !answer.includes('Dr. P. Suresh') && !answer.includes('P. Suresh');
      const noGSuresh = !answer.includes('Dr. G. Suresh') && !answer.includes('G. Suresh');
      const noMech = !answer.includes('Mechanical Engineering') && !/\bMECH\b/.test(answer);
      const singleProfile = retrieval?.aggregatedProfiles?.length === 1;
      return isKSuresh && noPSuresh && noGSuresh && noMech && singleProfile;
    },
    description: 'Specific identity query "Dr. K. Suresh" resolves exclusively to Dr. K. Suresh (CSE) with zero unrelated Suresh/MECH records',
  },
  {
    id: 21,
    query: 'NPTEL',
    expectedIntent: 'FACILITIES',
    validate: (answer, sources) => {
      const isKnowledgeNotice = answer.includes('NPTEL') && (answer.includes('Local Chapter') || answer.includes('Purushothaman') || answer.includes('SPOC'));
      const noSvgInAnswer = !/<svg[^>]*>/i.test(answer) && !/\*{1,2}\s*svg/i.test(answer) && !/\bsvg(?:Verified|Suggested)?\b/i.test(answer);
      const noSvgInSources = sources.every(s => !/svg/i.test(s.title));
      return isKnowledgeNotice && noSvgInAnswer && noSvgInSources;
    },
    description: 'NPTEL topic query returns clean official NPTEL Local Chapter details with ZERO svg tokens or leaked metadata in answer or sources',
  },
  {
    id: 22,
    query: 'Ambika',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer, sources) => {
      const hasAmbika = answer.toLowerCase().includes('ambika');
      const noSvgInAnswer = !/<svg[^>]*>/i.test(answer) && !/\*{1,2}\s*svg/i.test(answer) && !/\bsvg(?:Verified|Suggested)?\b/i.test(answer) && !/(?:Details|Cell)svg/i.test(answer);
      const noSvgInSources = sources.every(s => !/svg/i.test(s.title));
      return hasAmbika && noSvgInAnswer && noSvgInSources;
    },
    description: 'Ambika profile query contains zero svg metadata leaks in answer and zero svg leaks in source titles',
  },
  {
    id: 23,
    query: 'K. Suresh',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer, sources) => {
      const hasSuresh = answer.includes('Dr. K. Suresh') && answer.includes('Computer Science & Engineering');
      const noSvgInAnswer = !/<svg[^>]*>/i.test(answer) && !/\*{1,2}\s*svg/i.test(answer) && !/\bsvg(?:Verified|Suggested)?\b/i.test(answer) && !/(?:Details|Cell)svg/i.test(answer);
      const noSvgInSources = sources.every(s => !/svg/i.test(s.title));
      return hasSuresh && noSvgInAnswer && noSvgInSources;
    },
    description: 'K. Suresh profile query contains zero svg metadata leaks in answer and zero svg leaks in source titles',
  },
  {
    id: 24,
    query: 'TRANSPORT',
    expectedIntent: 'TRANSPORT',
    validate: (answer, sources) => {
      const hasTransport = answer.includes('35 buses') || answer.includes('transportation') || answer.includes('Trichy');
      const noHostel = !answer.toLowerCase().includes('hostel');
      const noLibrary = !answer.toLowerCase().includes('central library');
      const noComputerCentre = !answer.toLowerCase().includes('computer centre');
      const noSvg = !/\*{1,4}\s*svg/i.test(answer) && !/<svg/i.test(answer);
      const sourcesAreTransport = sources.every(s => s.url.includes('/transport'));
      return hasTransport && noHostel && noLibrary && noComputerCentre && noSvg && sourcesAreTransport;
    },
    description: 'Topic-specific query "TRANSPORT" returns strictly transport information with 35 buses and ZERO unrelated facilities or SVG leaks',
  },
  {
    id: 25,
    query: 'college bus',
    expectedIntent: 'TRANSPORT',
    validate: (answer, sources) => {
      const hasBus = answer.includes('35 buses') || answer.includes('destinations');
      const noHostel = !answer.toLowerCase().includes('hostel');
      const noLibrary = !answer.toLowerCase().includes('library');
      return hasBus && noHostel && noLibrary;
    },
    description: 'Topic-specific query "college bus" routes to TRANSPORT intent and returns transport information only',
  },
  {
    id: 26,
    query: 'hostel',
    expectedIntent: 'HOSTEL',
    validate: (answer, sources) => {
      const hasHostel = answer.toLowerCase().includes('hostel');
      const noTransport = !answer.includes('35 buses');
      const noLibrary = !answer.toLowerCase().includes('delnet');
      return hasHostel && noTransport && noLibrary;
    },
    description: 'Topic-specific query "hostel" routes to HOSTEL intent and returns hostel information only',
  },
  {
    id: 27,
    query: 'central library',
    expectedIntent: 'LIBRARY',
    validate: (answer, sources) => {
      const hasLibrary = answer.toLowerCase().includes('library');
      const noTransport = !answer.includes('35 buses');
      const noHostel = !answer.toLowerCase().includes('hostel');
      return hasLibrary && noTransport && noHostel;
    },
    description: 'Topic-specific query "central library" routes to LIBRARY intent and returns library information only',
  },
  {
    id: 28,
    query: 'jjcet enga iruku',
    expectedIntent: 'CONTACT',
    validate: (answer) => {
      const hasLocation = answer.includes('Tiruchirappalli') && answer.includes('Ammapettai');
      const noFaculty = !answer.toLowerCase().includes('faculty') && !answer.toLowerCase().includes('designation');
      return hasLocation && noFaculty;
    },
    description: 'Thanglish location query "jjcet enga iruku" routes to CONTACT and is NEVER treated as a person lookup',
  },
  {
    id: 29,
    query: 'college enga iruku',
    expectedIntent: 'CONTACT',
    validate: (answer) => {
      return answer.includes('Tiruchirappalli') && answer.includes('Ammapettai');
    },
    description: 'Thanglish query "college enga iruku" routes to CONTACT',
  },
  {
    id: 30,
    query: 'jjcet location enna',
    expectedIntent: 'CONTACT',
    validate: (answer) => {
      return answer.includes('Tiruchirappalli') && answer.includes('Ammapettai');
    },
    description: 'Mixed English+Thanglish query "jjcet location enna" routes to CONTACT',
  },
  {
    id: 31,
    query: 'ambika mam yaaru',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer, sources, retrieval) => {
      const hasAmbika = answer.includes('Mrs. M. Ambika');
      const hasProfile = (retrieval.aggregatedProfiles || []).length === 1;
      return hasAmbika && hasProfile;
    },
    description: 'Thanglish person query "ambika mam yaaru" strips respectful suffix "mam" and resolves to Mrs. M. Ambika',
  },
  {
    id: 32,
    query: 'ambika mam pathi sollu',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer) => {
      return answer.includes('Mrs. M. Ambika') && answer.includes('Computer Science & Engineering');
    },
    description: 'Thanglish query "ambika mam pathi sollu" strips "mam", "pathi", "sollu" and resolves to Mrs. M. Ambika',
  },
  {
    id: 33,
    query: 'ambika maam details kudu',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer) => {
      return answer.includes('Mrs. M. Ambika') && answer.includes('Assistant Professor');
    },
    description: 'Thanglish query "ambika maam details kudu" strips "maam", "details", "kudu" and resolves to Mrs. M. Ambika',
  },
  {
    id: 34,
    query: 'ambika oda qualification enna',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer) => {
      return answer.includes('Mrs. M. Ambika') && answer.includes('M.E.');
    },
    description: 'Thanglish query "ambika oda qualification enna" strips "oda", "qualification", "enna" and resolves to Mrs. M. Ambika',
  },
  {
    id: 35,
    query: 'chellammal mam pathi sollu',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer) => {
      return answer.includes('Dr. P. Chellammal') && answer.includes('Associate Professor');
    },
    description: 'Generic person extraction for "chellammal mam pathi sollu" resolves to Dr. P. Chellammal without hardcoding',
  },
  {
    id: 36,
    query: 'cse la yaaru hod',
    expectedIntent: 'HOD',
    validate: (answer) => {
      return answer.includes('Dr. K. Suresh') && answer.includes('Associate Professor / HOD');
    },
    description: 'Thanglish HOD query "cse la yaaru hod" routes to HOD and identifies Dr. K. Suresh',
  },
  {
    id: 37,
    query: 'cse hod name enna',
    expectedIntent: 'HOD',
    validate: (answer) => {
      return answer.includes('Dr. K. Suresh');
    },
    description: 'Thanglish HOD query "cse hod name enna" routes to HOD and identifies Dr. K. Suresh',
  },
  {
    id: 38,
    query: 'college bus enga enga pogum',
    expectedIntent: 'TRANSPORT',
    validate: (answer) => {
      return answer.includes('35 buses') && (answer.includes('Tanjore') || answer.includes('Pudukkottai')) && !answer.toLowerCase().includes('hostel');
    },
    description: 'Thanglish transport query "college bus enga enga pogum" routes to TRANSPORT intent and returns bus routes',
  },
  {
    id: 39,
    query: 'bus facility iruka',
    expectedIntent: 'TRANSPORT',
    validate: (answer) => {
      return answer.includes('35 buses') && !answer.toLowerCase().includes('hostel');
    },
    description: 'Thanglish transport query "bus facility iruka" routes to TRANSPORT intent and returns bus service details',
  },
  {
    id: 40,
    query: 'hostel facility enna',
    expectedIntent: 'HOSTEL',
    validate: (answer) => {
      return answer.includes('Hostel') && (answer.includes('Boys') || answer.includes('Girls')) && !answer.includes('35 buses');
    },
    description: 'Thanglish hostel query "hostel facility enna" routes to HOSTEL intent and returns accommodation details',
  },
  {
    id: 41,
    query: 'library pathi sollu',
    expectedIntent: 'LIBRARY',
    validate: (answer) => {
      return answer.includes('Library') && answer.includes('55,280') && !answer.includes('35 buses');
    },
    description: 'Thanglish library query "library pathi sollu" routes to LIBRARY intent and returns library details',
  },
  {
    id: 42,
    query: 'admission epdi',
    expectedIntent: 'ADMISSION',
    validate: (answer) => {
      return (answer.includes('TNEA') || answer.includes('10+2')) && answer.includes('Admission');
    },
    description: 'Thanglish admission query "admission epdi" routes to ADMISSION intent and returns eligibility',
  },
  {
    id: 43,
    query: 'fees evlo',
    expectedIntent: 'ADMISSION',
    validate: (answer) => {
      return answer.toLowerCase().includes('fee') && answer.includes('+91 98428 11776');
    },
    description: 'Thanglish fees query "fees evlo" routes to ADMISSION intent and provides fee structure guidance',
  },
  {
    id: 44,
    query: 'placement epdi iruku',
    expectedIntent: 'PLACEMENT',
    validate: (answer) => {
      return answer.includes('Placement') && answer.includes('Zoho');
    },
    description: 'Thanglish placement query "placement epdi iruku" routes to PLACEMENT intent and returns recruiters',
  },
  {
    id: 45,
    query: 'ஜேஜேசிஇடி எங்கே இருக்கிறது',
    expectedIntent: 'CONTACT',
    validate: (answer) => {
      return answer.includes('திருச்சி') || answer.includes('அம்மாபேட்டை');
    },
    description: 'Tamil script location query "ஜேஜேசிஇடி எங்கே இருக்கிறது" routes to CONTACT and responds in Tamil',
  },
  {
    id: 46,
    query: 'பேருந்து வசதி இருக்கிறதா',
    expectedIntent: 'TRANSPORT',
    validate: (answer) => {
      return answer.includes('பேருந்து') && answer.includes('35');
    },
    description: 'Tamil script transport query "பேருந்து வசதி இருக்கிறதா" routes to TRANSPORT and responds in Tamil',
  },
  {
    id: 47,
    query: 'அம்பிகா மேம் யார்',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer) => {
      return answer.includes('Mrs. M. Ambika');
    },
    description: 'Tamil script person query "அம்பிகா மேம் யார்" transliterates and resolves to Mrs. M. Ambika',
  },
  {
    id: 48,
    query: 'B.E. Computer Science & Engineering',
    expectedIntent: 'COURSES',
    validate: (answer, sources) => {
      const exactMatch = answer.trim() === 'B.E. Computer Science & Engineering – Intake: 240 Seats';
      const noCyber = !answer.includes('Cyber Security');
      const noIT = !answer.includes('Information Technology');
      const noME = !answer.includes('M.E.');
      const sourcePass = sources.some(s => s.url === 'https://jjcet.ac.in/computer-science-and-engineering/');
      return exactMatch && noCyber && noIT && noME && sourcePass;
    },
    description: 'Searching B.E. Computer Science & Engineering returns exactly "B.E. Computer Science & Engineering – Intake: 240 Seats" with official CSE department source',
  },
  {
    id: 49,
    query: 'CSE intake',
    expectedIntent: 'COURSES',
    validate: (answer, sources) => {
      const exactMatch = answer.trim() === 'B.E. Computer Science & Engineering – Intake: 240 Seats';
      const noTNEA = !answer.includes('TNEA Single Window');
      const noVacancy = !answer.includes('vacan');
      const sourcePass = sources.some(s => s.url === 'https://jjcet.ac.in/computer-science-and-engineering/');
      return exactMatch && noTNEA && noVacancy && sourcePass;
    },
    description: 'CSE intake returns exactly "B.E. Computer Science & Engineering – Intake: 240 Seats"',
  },
  {
    id: 50,
    query: 'What courses does JJCET offer?',
    expectedIntent: 'COURSES',
    validate: (answer) => {
      const cseMatches = answer.match(/B\.E\.\s+Computer Science & Engineering\b(?!\s*\(Cyber)/g) || [];
      const has240 = answer.includes('240 Seats');
      return cseMatches.length === 1 && has240;
    },
    description: 'General courses query lists B.E. Computer Science & Engineering with 240 Seats with zero duplicate CSE entries',
  },
  {
    id: 51,
    query: 'ECE intake',
    expectedIntent: 'COURSES',
    validate: (answer, sources) => {
      const exactMatch = answer.trim() === 'B.E. Electronics and Communication Engineering – Intake: 120 Seats';
      const noME = !answer.includes('M.E.');
      const noCSE = !answer.includes('Computer Science');
      const noEEE = !answer.includes('Electrical');
      const noTNEA = !answer.includes('TNEA');
      const noVacancy = !answer.includes('vacan');
      const sourcePass = sources.some(s => s.url === 'https://jjcet.ac.in/admission/');
      return exactMatch && noME && noCSE && noEEE && noTNEA && noVacancy && sourcePass;
    },
    description: 'ECE intake returns exactly "B.E. Electronics and Communication Engineering – Intake: 120 Seats"',
  },
  {
    id: 52,
    query: 'ECE seats',
    expectedIntent: 'COURSES',
    validate: (answer, sources) => {
      const exactMatch = answer.trim() === 'B.E. Electronics and Communication Engineering – Intake: 120 Seats';
      const sourcePass = sources.some(s => s.url === 'https://jjcet.ac.in/admission/');
      return exactMatch && sourcePass;
    },
    description: 'ECE seats returns exactly "B.E. Electronics and Communication Engineering – Intake: 120 Seats"',
  },
  {
    id: 53,
    query: 'B.E. Electronics and Communication Engineering',
    expectedIntent: 'COURSES',
    validate: (answer, sources) => {
      const exactMatch = answer.trim() === 'B.E. Electronics and Communication Engineering – Intake: 120 Seats';
      const noME = !answer.includes('M.E.');
      const noOther = !answer.includes('Cyber') && !answer.includes('Information Technology');
      const sourcePass = sources.some(s => s.url === 'https://jjcet.ac.in/admission/');
      return exactMatch && noME && noOther && sourcePass;
    },
    description: 'Searching B.E. Electronics and Communication Engineering returns exactly "B.E. Electronics and Communication Engineering – Intake: 120 Seats"',
  },
  {
    id: 54,
    query: 'IT intake',
    expectedIntent: 'COURSES',
    validate: (answer, sources) => {
      const exactMatch = answer.trim() === 'B.Tech. Information Technology – Intake: 120 Seats';
      const noME = !answer.includes('M.E.');
      const noCSE = !answer.includes('Computer Science') && !answer.includes('CSE');
      const noECE = !answer.includes('Electronics') && !answer.includes('ECE');
      const noEEE = !answer.includes('Electrical') && !answer.includes('EEE');
      const noVacancy = !answer.includes('vacan');
      const noTNEA = !answer.includes('TNEA');
      const sourcePass = sources.some(s => s.url === 'https://jjcet.ac.in/information-technology/');
      return exactMatch && noME && noCSE && noECE && noEEE && noVacancy && noTNEA && sourcePass;
    },
    description: 'IT intake returns exactly "B.Tech. Information Technology – Intake: 120 Seats"',
  },
  {
    id: 55,
    query: 'IT seats',
    expectedIntent: 'COURSES',
    validate: (answer, sources) => {
      const exactMatch = answer.trim() === 'B.Tech. Information Technology – Intake: 120 Seats';
      const noME = !answer.includes('M.E.');
      const noCSE = !answer.includes('CSE');
      const noECE = !answer.includes('ECE');
      const noEEE = !answer.includes('EEE');
      const noVacancy = !answer.includes('vacan');
      const noTNEA = !answer.includes('TNEA');
      const sourcePass = sources.some(s => s.url === 'https://jjcet.ac.in/information-technology/');
      return exactMatch && noME && noCSE && noECE && noEEE && noVacancy && noTNEA && sourcePass;
    },
    description: 'IT seats returns exactly "B.Tech. Information Technology – Intake: 120 Seats"',
  },
  {
    id: 56,
    query: 'Information Technology intake',
    expectedIntent: 'COURSES',
    validate: (answer, sources) => {
      const exactMatch = answer.trim() === 'B.Tech. Information Technology – Intake: 120 Seats';
      const noME = !answer.includes('M.E.');
      const noCSE = !answer.includes('Computer Science');
      const noECE = !answer.includes('Electronics');
      const noEEE = !answer.includes('Electrical');
      const noVacancy = !answer.includes('vacan');
      const noTNEA = !answer.includes('TNEA');
      const sourcePass = sources.some(s => s.url === 'https://jjcet.ac.in/information-technology/');
      return exactMatch && noME && noCSE && noECE && noEEE && noVacancy && noTNEA && sourcePass;
    },
    description: 'Information Technology intake returns exactly "B.Tech. Information Technology – Intake: 120 Seats"',
  },
  {
    id: 57,
    query: 'B.Tech Information Technology',
    expectedIntent: 'COURSES',
    validate: (answer, sources) => {
      const exactMatch = answer.trim() === 'B.Tech. Information Technology – Intake: 120 Seats';
      const noME = !answer.includes('M.E.');
      const noCSE = !answer.includes('Computer Science');
      const noECE = !answer.includes('Electronics');
      const noEEE = !answer.includes('Electrical');
      const noVacancy = !answer.includes('vacan');
      const noTNEA = !answer.includes('TNEA');
      const sourcePass = sources.some(s => s.url === 'https://jjcet.ac.in/information-technology/');
      return exactMatch && noME && noCSE && noECE && noEEE && noVacancy && noTNEA && sourcePass;
    },
    description: 'Searching B.Tech Information Technology returns exactly "B.Tech. Information Technology – Intake: 120 Seats"',
  },
  {
    id: 58,
    query: 'AI&DS Faculty list',
    expectedIntent: 'FACULTY',
    validate: (answer, sources, retrieval) => {
      const hasDept = answer.includes('Artificial Intelligence & Data Science');
      const hasTable = answer.includes('| S.No | Faculty Name | Designation | Qualification |');
      const hasSaravanakumar = answer.includes('Dr. K. Saravana Kumar') && answer.includes('Ph.D.');
      const dataRows = answer.split('\n').filter(line => /^\|\s*\d+\s*\|/.test(line));
      const has24Rows = dataRows.length === 24;
      const noCivil = !answer.includes('Civil Engineering');
      return hasDept && hasTable && hasSaravanakumar && has24Rows && noCivil;
    },
    description: 'AI&DS Faculty list returns exactly 24 AI&DS faculty members with verified qualifications and correct department header',
  },
  {
    id: 59,
    query: 'faculty list',
    expectedIntent: 'FACULTY',
    validate: (answer, sources, retrieval) => {
      const asksDepartment = answer.includes('Please specify which department') || answer.includes('Which department faculty list would you like?');
      const no255Dump = !answer.includes('| 255 |');
      return asksDepartment && no255Dump;
    },
    description: 'Generic faculty list query prompts user to select a department instead of dumping 255 mixed faculty',
  },
  {
    id: 60,
    query: 'CSE faculty list',
    expectedIntent: 'FACULTY',
    validate: (answer, sources, retrieval) => {
      const hasHeader = answer.includes('### CSE Faculty');
      const hasSuresh = answer.includes('Dr. K. Suresh') && answer.includes('M.E., Ph.D.');
      const hasTable = answer.includes('| S.No | Faculty Name | Designation | Qualification |');
      const hasSource = sources.some(s => s.url.includes('computer-science') || s.url.includes('jjcet.ac.in'));
      return hasHeader && hasSuresh && hasTable && hasSource;
    },
    description: 'CSE faculty list query returns clean ### CSE Faculty roster with verified qualifications and source URL',
  },
  {
    id: 61,
    query: 'AI & DS faculty list',
    expectedIntent: 'FACULTY',
    validate: (answer, sources, retrieval) => {
      const hasHeader = answer.includes('### AI & DS Faculty');
      const hasSaravana = answer.includes('Dr. K. Saravana Kumar') && answer.includes('Ph.D.');
      const dataRows = answer.split('\n').filter(line => /^\|\s*\d+\s*\|/.test(line));
      const has24Rows = dataRows.length === 24;
      return hasHeader && hasSaravana && has24Rows;
    },
    description: 'AI & DS faculty list query returns clean ### AI & DS Faculty roster with 24 verified records',
  },
  {
    id: 62,
    query: 'CSE HOD',
    expectedIntent: 'HOD',
    validate: (answer, sources) => {
      const exactPhrase = answer.includes('The HOD of Computer Science & Engineering is Dr. K. Suresh, Associate Professor / HOD.');
      const sourcePass = sources.some(s => s.url.includes('computer-science') || s.url.includes('jjcet.ac.in'));
      return exactPhrase && sourcePass;
    },
    description: 'CSE HOD query returns exact mandated phrasing: "The HOD of Computer Science & Engineering is Dr. K. Suresh, Associate Professor / HOD."',
  },
  {
    id: 63,
    query: 'AI DS HOD',
    expectedIntent: 'HOD',
    validate: (answer, sources) => {
      const hasSaravana = answer.includes('Dr. K. Saravana Kumar') && answer.includes('Artificial Intelligence & Data Science');
      const sourcePass = sources.some(s => s.url.includes('artificial-intelligence') || s.url.includes('jjcet.ac.in'));
      return hasSaravana && sourcePass;
    },
    description: 'AI DS HOD natural query routes to HOD and returns Dr. K. Saravana Kumar with official source',
  },
  {
    id: 64,
    query: 'staff list',
    expectedIntent: 'FACULTY',
    validate: (answer) => {
      const asksDepartment = answer.includes('Which department faculty list would you like?') &&
                             answer.includes('CSE, AI & DS, ECE, EEE, Mechanical, Civil, MBA');
      const no255Dump = !answer.includes('| 255 |');
      return asksDepartment && no255Dump;
    },
    description: 'Generic "staff list" query asks user to select department without dumping 255 faculty',
  },
  {
    id: 65,
    query: 'computer science faculty',
    expectedIntent: 'FACULTY',
    validate: (answer) => {
      const dataRows = answer.split('\n').filter(line => /^\|\s*\d+\s*\|/.test(line));
      const has50Rows = dataRows.length === 50;
      const noDashQual = !dataRows.some(r => r.endsWith('| - |'));
      return has50Rows && noDashQual;
    },
    description: 'Query "computer science faculty" normalizes to CSE FACULTY with complete qualifications and zero "-" values',
  },
  {
    id: 66,
    query: 'AI DS faculty',
    expectedIntent: 'FACULTY',
    validate: (answer) => {
      const dataRows = answer.split('\n').filter(line => /^\|\s*\d+\s*\|/.test(line));
      const has24Rows = dataRows.length === 24;
      const noDashQual = !dataRows.some(r => r.endsWith('| - |'));
      return has24Rows && noDashQual;
    },
    description: 'Query "AI DS faculty" normalizes to AI&DS FACULTY with 24 verified records and zero "-" values',
  },
  {
    id: 67,
    query: 'Automobile Engineering faculty list',
    expectedIntent: 'FACULTY',
    validate: (answer) => {
      return answer.toLowerCase().includes('not available in official jjcet sources') || answer.toLowerCase().includes('does not offer programs');
    },
    description: 'Unknown department query "Automobile Engineering faculty list" cleanly states information is not available in official JJCET sources',
  },
  {
    id: 68,
    query: 'Dr. K. Sivakumar',
    expectedIntent: 'PERSON_LOOKUP',
    validate: (answer) => {
      const matchesSivakumar = answer.includes('Dr. K. Sivakumar') && answer.includes('MBA');
      const marksUnverified = answer.includes('unverified from official');
      return matchesSivakumar && marksUnverified;
    },
    description: 'Faculty record with standard unverified qualification does not present inferred degrees as individually verified facts',
  },
  {
    id: 69,
    query: 'duplicate-name protection',
    validate: () => {
      const allFaculty = vectorStore.getAllFaculty();
      const sathis = allFaculty.find(f => f.name === 'Mr. B. Sathis Kumar');
      const sathish = allFaculty.find(f => f.name === 'Mr. B. Sathish Kumar');
      const shanmuaga = allFaculty.find(f => f.name === 'Mrs. G. Shanmuaga Priya');
      const shanmuga = allFaculty.find(f => f.name === 'Mrs. G. Shanmuga Priya');
      return !!sathis && !!sathish && sathis !== sathish && !!shanmuaga && !!shanmuga && shanmuaga !== shanmuga;
    },
    description: 'Duplicate protection asserts confusable official name variants (Sathis/Sathish, Shanmuaga/Shanmuga) remain distinct records without automatic deletion',
  },
  {
    id: 70,
    query: 'What is the placement package for NASA?',
    validate: (answer) => {
      const statesNotAvailable = answer.toLowerCase().includes('not available in the official jjcet source') ||
                                  answer.toLowerCase().includes('does not publish speculative estimates') ||
                                  answer.toLowerCase().includes('couldn\'t verify that information');
      const noHallucinatedPackage = !answer.includes('LPA') && !answer.includes('crore') && !answer.includes('$');
      return statesNotAvailable && noHallucinatedPackage;
    },
    description: 'Strict source grounding: Unsupported/unrelated query returns not available and never invents placement packages',
  },
];

async function runTests() {
  console.log('====================================================');
  console.log('   JJCET AI ASSISTANT - INTEGRATION TEST SUITE');
  console.log(`   Validating ${testCases.length} Required Core & Regression Queries`);
  console.log('====================================================\n');

  if (!vectorStore.isLoaded()) {
    console.error('❌ Index is not loaded! Run npm run ingest first.');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    console.log(`[TEST ${tc.id}] Query: "${tc.query}"`);
    const analysis = analyzeIntent(tc.query);
    const retrieval = executeHybridSearch(analysis);
    const answer = await generateGroundedAnswer(tc.query, retrieval);

    const isIntentOk = !tc.expectedIntent || analysis.intent === tc.expectedIntent;
    const isValidationOk = tc.validate(answer, retrieval.sources, retrieval);
    // Global assertion: Zero SVG metadata leakage in source titles or answer
    const hasSvgInSources = retrieval.sources.some(s =>
      /<svg[^>]*>/i.test(s.title) ||
      /\*{1,2}\s*svg/i.test(s.title) ||
      /\bsvg\b/i.test(s.title) ||
      /\bsvg(?:Verified|Suggested|[a-zA-Z0-9_]*)\b/i.test(s.title) ||
      /(?<=[a-zA-Z0-9])\s*svg\b/i.test(s.title)
    );
    const hasSvgInAnswer =
      /<svg[^>]*>/i.test(answer) ||
      /\*{1,2}\s*svg/i.test(answer) ||
      /\b(?:svgVerified|svgSuggested)\b/i.test(answer) ||
      /(?:Details|Cell|EDC|NPTEL)svg\b/i.test(answer);

    if (isIntentOk && isValidationOk && !hasSvgInSources && !hasSvgInAnswer) {
      console.log(`  ✅ PASS: ${tc.description}`);
      console.log(`     Intent: ${analysis.intent} | Sources: ${retrieval.sources.length}`);
      console.log(`     Answer Preview: ${answer.replace(/\n+/g, ' ').slice(0, 140)}...\n`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${tc.description}`);
      console.error(`     Detected Intent: ${analysis.intent} (Expected: ${tc.expectedIntent})`);
      if (hasSvgInSources) console.error(`     SVG leaked in sources: ${retrieval.sources.map(s => s.title).join(', ')}`);
      if (hasSvgInAnswer) console.error(`     SVG leaked in answer text!`);
      console.error(`     Answer:\n${answer}\n`);
      failed++;
    }
  }

  console.log('====================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${testCases.length})`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();

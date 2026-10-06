import { IntentAnalysis, QueryIntent } from '../types.js';
import { cleanPersonQuery } from './profileAggregator.js';

export function normalizeQuery(query: string): string {
  let q = query.trim();

  // Typo corrections & slang normalization
  q = q.replace(/\bfacullty\b/gi, 'faculty');
  q = q.replace(/\bfaculity\b/gi, 'faculty');
  q = q.replace(/\bfaculties\b/gi, 'faculty');
  q = q.replace(/\bhod\b/gi, 'HOD');
  q = q.replace(/\bai\s*(&|and|\/)\s*ds\b/gi, 'AI & DS');
  q = q.replace(/\bai&ds\b/gi, 'AI & DS');
  q = q.replace(/\baids\b/gi, 'AI & DS');
  q = q.replace(/\bai\s+ds\b/gi, 'AI & DS');
  q = q.replace(/\bcse\b/gi, 'CSE');
  q = q.replace(/\bece\b/gi, 'ECE');
  q = q.replace(/\beee\b/gi, 'EEE');
  q = q.replace(/\bmech\b/gi, 'Mechanical');
  q = q.replace(/\baero\b/gi, 'Aeronautical');
  q = q.replace(/\bcolg\b/gi, 'college');
  q = q.replace(/\bclg\b/gi, 'college');

  return q;
}

export function detectLanguage(query: string): 'en' | 'ta' | 'tanglish' {
  // Check for Tamil Unicode script range
  if (/[\u0B80-\u0BFF]/.test(query)) {
    return 'ta';
  }

  // Check for common Tanglish words and markers
  const tanglishPatterns = [
    /\b(yaaru|yaar|irukku|iruku|irukka|iruka|kudu|kudunga|enna|epdi|eppadi|evlo|evvalavu|enga|engirukku|engiruku|sollinga|sollu|sollunga|theriyuma|la|le|ku|kku|oda|udaiya|paththi|pathi|patri|venum|illai)\b/i,
  ];

  for (const p of tanglishPatterns) {
    if (p.test(query)) {
      return 'tanglish';
    }
  }

  return 'en';
}

export function detectDepartment(query: string): string | undefined {
  const q = query.toLowerCase();

  // Unsupported department detection for strict source grounding
  if (
    q.includes('automobile') ||
    q.includes('biotech') ||
    q.includes('biotechnology') ||
    q.includes('chemical') ||
    q.includes('mining') ||
    q.includes('textile') ||
    q.includes('aerospace')
  ) {
    return 'Unsupported Department';
  }

  if (q.includes('cyber') || q.includes('cyber security')) {
    return 'Computer Science & Engineering (Cyber Security)';
  }
  if (
    q.includes('ai & ds') ||
    q.includes('ai and ds') ||
    q.includes('ai&ds') ||
    q.includes('artificial intelligence') ||
    q.includes('data science') ||
    /\bai\s*(&|and|\/)?\s*ds\b/i.test(query) ||
    /\baids\b/i.test(query) ||
    /செயற்கை நுண்ணறிவு/i.test(query)
  ) {
    return 'Artificial Intelligence & Data Science';
  }
  if (q.includes('cse') || q.includes('computer science') || q.includes('comp sci') || /கணினி/i.test(query)) {
    return 'Computer Science & Engineering';
  }
  if (q.includes('eee') || q.includes('electrical and electronics') || q.includes('electrical')) {
    return 'Electrical and Electronics Engineering';
  }
  if (q.includes('ece') || q.includes('electronics and communication') || (q.includes('electronics') && !q.includes('electrical')) || /மின்னணு/i.test(query)) {
    return 'Electronics and Communication Engineering';
  }
  if (
    !q.includes('cse') &&
    !q.includes('computer science') &&
    !q.includes('cyber') &&
    (q.includes('information technology') ||
     /\b(it)\b/i.test(query) ||
     /\bit intake\b/i.test(query) ||
     /\bit seats?\b/i.test(query) ||
     /தகவல் தொழில்நுட்ப/i.test(query))
  ) {
    return 'Information Technology';
  }
  if (q.includes('mech') || q.includes('mechanical') || /இயந்திர/i.test(query)) {
    return 'Mechanical Engineering';
  }
  if (q.includes('civil') || /சிவில்/i.test(query)) {
    return 'Civil Engineering';
  }
  if (q.includes('aero') || q.includes('aeronautical') || /வானூர்தி/i.test(query)) {
    return 'Aeronautical Engineering';
  }
  if (/\b(math|maths|mathematics)\b/i.test(q) || /கணித/i.test(query)) {
    return 'Mathematics';
  }
  if (q.includes('physics') || /இயற்பியல்/i.test(query)) {
    return 'Physics';
  }
  if (q.includes('chemistry') || /வேதியியல்/i.test(query)) {
    return 'Chemistry';
  }
  if (q.includes('english') || /ஆங்கில/i.test(query)) {
    return 'English';
  }
  if (q.includes('mba') || q.includes('management') || /மேலாண்மை/i.test(query)) {
    return 'MBA';
  }
  if (q.includes('tamil') || /தமிழ்/i.test(query)) {
    return 'Tamil';
  }
  if (q.includes('library') || /நூலக/i.test(query)) {
    return 'Library';
  }
  if (q.includes('physical education') || q.includes('sports') || /உடற்கல்வி/i.test(query)) {
    return 'Physical Education';
  }

  return undefined;
}

export function analyzeIntent(rawQuery: string): IntentAnalysis {
  const normalizedQuery = normalizeQuery(rawQuery);
  const q = normalizedQuery.toLowerCase();
  const language = detectLanguage(rawQuery);
  const department = detectDepartment(normalizedQuery);

  const isFullListRequested =
    q.includes('full list') ||
    q.includes('all faculty') ||
    q.includes('entire list') ||
    q.includes('complete list') ||
    q.includes('list') ||
    q.includes('yaar yaar') ||
    q.includes('ellarum') ||
    q.includes('kudu');

  let intent: QueryIntent = 'GENERAL';

  // 1. Location & Contact queries (HIGH PRIORITY: "jjcet enga iruku", "college location enna" must never be person lookup)
  if (
    q.includes('enga iruk') ||
    q.includes('engiruk') ||
    q.includes('where is') ||
    q.includes('how to reach') ||
    q.includes('location') ||
    q.includes('address') ||
    q.includes('contact') ||
    q.includes('phone') ||
    q.includes('map') ||
    q.includes('email') ||
    /எங்கே|முகவரி|தொடர்பு/.test(q)
  ) {
    intent = 'CONTACT';
  }
  // 2. HOD queries
  else if (
    q.includes('hod') ||
    q.includes('head of the department') ||
    q.includes('head of department') ||
    q.includes('department head') ||
    (department && (q.includes('yaaru') || q.includes('who is the head') || q.includes('head'))) ||
    /துறைத் தலைவர்|எச்ஓடி/.test(q)
  ) {
    intent = 'HOD';
  }
  // 3. Faculty list queries
  else if (
    q === 'faculty list' ||
    q === 'faculty members' ||
    q === 'staff list' ||
    q === 'staff members' ||
    q === 'faculty' ||
    q.includes('faculty list') ||
    q.includes('faculty members') ||
    q.includes('staff list') ||
    q.includes('staff members') ||
    q.includes('faculty roster') ||
    q.includes('faculty directory') ||
    q.includes('all faculty') ||
    q.includes('full list') ||
    q.includes('list of faculty') ||
    q.includes('list of professors') ||
    (department && (
      q.includes('faculty') ||
      q.includes('staff') ||
      q.includes('professors') ||
      q.includes('members') ||
      isFullListRequested ||
      q.includes('list') ||
      q.includes('yaar yaar') ||
      q.includes('ellarum') ||
      q.includes('faculty kudu')
    )) ||
    /பேராசிரியர்கள் பட்டியல்|பட்டியல்/.test(q)
  ) {
    intent = 'FACULTY';
  }
  // 4. Courses & Intake queries
  else if (
    (department && (q.includes('intake') || q.includes('seat') || q.includes('course') || q.includes('program') || q.includes('b.e') || q.includes('m.e'))) ||
    q.includes('intake') ||
    q.includes('course') ||
    q.includes('courses') ||
    q.includes('program') ||
    q.includes('programs') ||
    q.includes('degrees') ||
    q.includes('degree') ||
    q.includes('b.e') ||
    q.includes('m.e') ||
    q.includes('b.tech') ||
    q.includes('branch') ||
    q.includes('branches') ||
    (q.includes('enna') && q.includes('iruk') && !q.includes('hostel') && !q.includes('bus') && !q.includes('facility')) ||
    /படிப்புகள்|பாடப்பிரிவுகள்/.test(q)
  ) {
    intent = 'COURSES';
  }
  // 5. Admission & Fees queries
  else if (
    q.includes('admission') ||
    q.includes('eligibility') ||
    q.includes('cutoff') ||
    q.includes('tnea') ||
    q.includes('lateral entry') ||
    q.includes('seat') ||
    q.includes('apply') ||
    q.includes('application') ||
    q.includes('fees') ||
    q.includes('fee') ||
    q.includes('kattanam') ||
    /சேர்க்கை|கட்டணம்/.test(q)
  ) {
    intent = 'ADMISSION';
  }
  // 6. Placement queries
  else if (
    q.includes('placement') ||
    q.includes('placements') ||
    q.includes('recruiter') ||
    q.includes('recruiters') ||
    q.includes('salary') ||
    q.includes('package') ||
    q.includes('company') ||
    q.includes('companies') ||
    q.includes('training') ||
    /வேலைவாய்ப்பு|பிளேஸ்மென்ட்/.test(q)
  ) {
    intent = 'PLACEMENT';
  }
  // 7. Transport queries
  else if (
    q.includes('transport') ||
    q.includes('bus') ||
    q.includes('buses') ||
    q.includes('route') ||
    q.includes('routes') ||
    /பேருந்து|போக்குவரத்து/.test(q)
  ) {
    intent = 'TRANSPORT';
  }
  // 8. Hostel queries
  else if (
    q.includes('hostel') ||
    q.includes('hostels') ||
    q.includes('accommodation') ||
    q.includes('mess') ||
    q.includes('room') ||
    /விடுதி|ஹாஸ்டல்/.test(q)
  ) {
    intent = 'HOSTEL';
  }
  // 9. Library queries
  else if (
    q.includes('library') ||
    q.includes('books') ||
    q.includes('reading room') ||
    q.includes('delnet') ||
    q.includes('ndli') ||
    /நூலகம்|லைப்ரரி/.test(q)
  ) {
    intent = 'LIBRARY';
  }
  // 10. Facilities queries & Academic Initiatives (including NPTEL & SWAYAM Local Chapter)
  else if (
    q.includes('nptel') ||
    q.includes('swayam') ||
    q.includes('facility') ||
    q.includes('facilities') ||
    q.includes('infrastructure') ||
    q.includes('campus') ||
    /வசதிகள்/.test(q)
  ) {
    intent = 'FACILITIES';
  }
  // 11. Person lookup queries (e.g. "ambika mam yaaru", "ambika mam pathi sollu", "who is ambika", "Dr. S. Sumithra", "Principal", "Mathiyalagan")
  else if (
    (
      q.includes('principal') ||
      q.includes('mathiyalagan') ||
      q.includes('profile') ||
      q.includes('who is') ||
      q.includes('tell me about') ||
      q.includes('yaaru') ||
      q.includes('yaar') ||
      q.includes('mam') ||
      q.includes('maam') ||
      q.includes('madam') ||
      q.includes('sir') ||
      q.includes('pathi') ||
      q.includes('details') ||
      q.includes('qualification') ||
      q.includes('publications') ||
      q.includes('experience') ||
      q.includes('faculty') ||
      q.includes('staff') ||
      q.includes('professor') ||
      /யார்|பற்றி|முதல்வர்/.test(q)
    ) &&
    !q.includes('nptel') &&
    !q.includes('swayam')
  ) {
    intent = 'PERSON_LOOKUP';
  } else if (!department) {
    const words = q.split(/\s+/).filter(w => w.length > 0);
    const nonPersonKeywords = [
      'hello', 'hi', 'hey', 'help',
      'nptel', 'swayam', 'naac', 'nba', 'aicte', 'nirf',
      'tnea', 'tancet', 'scholarship', 'scholarships',
      'timing', 'timings', 'fees', 'fee', 'admission',
      'hostel', 'bus', 'transport', 'library', 'canteen', 'placement'
    ];
    if (words.length <= 4 && !nonPersonKeywords.some(kw => q.includes(kw))) {
      intent = 'PERSON_LOOKUP';
    }
  } else {
    // If a department is mentioned by itself without other intent flags, route to COURSES overview
    intent = 'COURSES';
  }

  // Extract clean entity name if person lookup
  let entityName: string | undefined;
  if (intent === 'PERSON_LOOKUP') {
    entityName = cleanPersonQuery(rawQuery);
  }

  return {
    intent,
    department,
    entityName,
    isFullListRequested,
    language,
    normalizedQuery,
    rawQuery,
  };
}

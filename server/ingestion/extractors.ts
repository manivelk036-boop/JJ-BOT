import * as cheerio from 'cheerio';
import { FacultyMember, CourseInfo } from '../types.js';

export function normalizePersonName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(dr\.|mr\.|mrs\.|ms\.|prof\.)\s*/i, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractDepartmentName(title: string, slug: string): string {
  const t = title.toLowerCase();
  const s = slug.toLowerCase();

  if (t.includes('cyber') || s.includes('cyber')) return 'Computer Science & Engineering (Cyber Security)';
  if (t.includes('artificial intelligence') || t.includes('data science') || s.includes('artificial-intelligence')) return 'Artificial Intelligence & Data Science';
  if (t.includes('computer science') || s.includes('computer-science')) return 'Computer Science & Engineering';
  if (t.includes('electronics and communication') || s.includes('electronics-and-communication')) return 'Electronics and Communication Engineering';
  if (t.includes('electrical and electronics') || s.includes('electrical-and-electronics')) return 'Electrical and Electronics Engineering';
  if (t.includes('information technology') || s.includes('information-technology')) return 'Information Technology';
  if (t.includes('mechanical') || s.includes('mechanical')) return 'Mechanical Engineering';
  if (t.includes('civil') || s.includes('civil')) return 'Civil Engineering';
  if (t.includes('aeronautical') || s.includes('aeronautical')) return 'Aeronautical Engineering';
  if (t.includes('math') || s.includes('math')) return 'Mathematics';
  if (t.includes('physics') || s.includes('physics')) return 'Physics';
  if (t.includes('chemistry') || s.includes('chemistry')) return 'Chemistry';
  if (t.includes('english') || s.includes('english')) return 'English';
  if (t.includes('humanities') || s.includes('humanities')) return 'Science & Humanities';

  return title;
}

export function cleanFacultyFieldValue(value?: string, isNumericField = false): string | undefined {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (isNumericField) {
    // For numeric/experience fields, only strip row/index prefix if followed by the actual numeric value:
    // e.g. '14. 10 Years' -> '10 Years', '14) 10 Years' -> '10 Years', '14 - 10 Years' -> '10 Years', 'Row 1: 10 Years' -> '10 Years'
    // Lookahead (?=\d) ensures that if the field is legitimately '14 Years' or '14. Years', we preserve it.
    // Also does not match decimals like '13.6 Years' because dot is immediately followed by a digit with no space.
    return trimmed
      .replace(/^(\s*(?:(?:s\.?\s*no\.?|sl\.?\s*no\.?|row|no\.?|#)\s*\d+[\s\.\)\-:]*|\d+\.\s+|\d+\s*[\)\-:]|\[\d+\])\s*[-–:]*\s*)(?=\d)/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  } else {
    // For text fields (name, designation, qualification, specialization), strip leading list/row index numbers
    return trimmed
      .replace(/^(\s*(?:(?:s\.?\s*no\.?|sl\.?\s*no\.?|row|no\.?|#)\s*\d+[\s\.\)\-:]*|\d+\.\s+|\d+\s*[\)\-:]|\[\d+\])\s*[-–:]*\s*)/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export function cleanFacultyRecord(faculty: FacultyMember): FacultyMember {
  const cleanedQual = cleanFacultyFieldValue(faculty.qualification, false);
  const qual = cleanedQual ? cleanedQual.replace(/,+$/, '').trim() : undefined;
  const exp = cleanFacultyFieldValue(faculty.experience, true);
  const spec = cleanFacultyFieldValue(faculty.specialization, false);

  return {
    ...faculty,
    name: cleanFacultyFieldValue(faculty.name, false) || faculty.name,
    designation: cleanFacultyFieldValue(faculty.designation, false) || faculty.designation,
    department: cleanFacultyFieldValue(faculty.department, false) || faculty.department,
    qualification: qual || undefined,
    experience: exp || undefined,
    specialization: spec || undefined,
  };
}

export function extractFacultyFromPage(
  html: string,
  pageUrl: string,
  department: string
): FacultyMember[] {
  const $ = cheerio.load(html);
  const facultyList: FacultyMember[] = [];
  const seenNames = new Set<string>();

  // 1. Extract HOD from table or "Head of the Department" section
  let hodName = '';
  let hodDesignation = 'Professor & Head of the Department (HOD)';
  let hodQual = '';
  let hodExp = '';
  let hodSpec = '';
  let hodProfileUrl = '';

  $('table').each((_, tbl) => {
    const tableText = $(tbl).text();
    if (tableText.includes('Designation') && (tableText.includes('HOD') || tableText.includes('Head') || tableText.includes('Associate Professor') || tableText.includes('Professor'))) {
      $(tbl).find('tr').each((_, tr) => {
        const ths = $(tr).find('th');
        const tds = $(tr).find('td');

        if (ths.length >= 2) {
          const k = $(ths[0]).text().trim().toLowerCase();
          const v = $(ths[1]).text().trim();
          if (k.includes('name') && v.length > 2) {
            const cleaned = cleanFacultyFieldValue(v, false);
            if (cleaned) hodName = cleaned;
          }
        }
        if (tds.length >= 2) {
          let keyIdx = 0;
          let valIdx = 1;
          // If 3 columns where column 0 is a row/index number, shift key and value columns
          if (tds.length >= 3 && /^\s*\d+[\.\)]?\s*$/.test($(tds[0]).text().trim())) {
            keyIdx = 1;
            valIdx = 2;
          }
          const k = $(tds[keyIdx]).text().trim().toLowerCase();
          const v = $(tds[valIdx]).text().trim();
          if (k.includes('name') && v.length > 2) {
            const cleaned = cleanFacultyFieldValue(v, false);
            if (cleaned) hodName = cleaned;
          } else if (k.includes('designation')) {
            const cleaned = cleanFacultyFieldValue(v, false);
            if (cleaned) hodDesignation = cleaned;
          } else if (k.includes('qualification')) {
            const cleaned = cleanFacultyFieldValue(v, false);
            if (cleaned) hodQual = cleaned;
          } else if (k.includes('experience')) {
            const cleaned = cleanFacultyFieldValue(v, true);
            if (cleaned) hodExp = cleaned;
          } else if (k.includes('specialization')) {
            const cleaned = cleanFacultyFieldValue(v, false);
            if (cleaned) hodSpec = cleaned;
          }
        }
      });
    }
  });

  // Fallback text matching if table wasn't found
  if (!hodName) {
    const rawText = $.text();
    const hodIdx = rawText.indexOf('Head of the Department');
    if (hodIdx !== -1) {
      const hodSectionText = rawText.slice(hodIdx, hodIdx + 1500);
      const nameMatch = hodSectionText.match(/Name\s+([A-Za-z\s.]+?)(?=Designation|Educational|Teaching|Years|$)/i);
      const desigMatch = hodSectionText.match(/Designation\s+([A-Za-z\s.\/]+?)(?=Educational|Teaching|Years|Area|$)/i);
      if (nameMatch && nameMatch[1].trim().length > 3) {
        hodName = cleanFacultyFieldValue(nameMatch[1].trim().replace(/\s+/g, ' '), false) || '';
      }
      if (desigMatch && desigMatch[1].trim()) {
        hodDesignation = cleanFacultyFieldValue(desigMatch[1].trim().replace(/\s+/g, ' '), false) || hodDesignation;
      }
    }
  }

  // Look for HOD profile PDF link
  $('a').each((_, a) => {
    const href = $(a).attr('href') || '';
    if (href.endsWith('.pdf') && (href.toLowerCase().includes('pro-') || href.toLowerCase().includes('hod'))) {
      if (!hodProfileUrl) hodProfileUrl = href;
    }
  });

  if (hodName) {
    const norm = normalizePersonName(hodName);
    seenNames.add(norm);
    facultyList.push(cleanFacultyRecord({
      id: `fac-${department}-${norm}`.replace(/[^a-z0-9-]/gi, '-'),
      name: hodName,
      normalizedName: norm,
      designation: hodDesignation,
      department,
      qualification: hodQual || undefined,
      experience: hodExp || undefined,
      specialization: hodSpec || undefined,
      isHod: true,
      profileUrl: hodProfileUrl || undefined,
      sourceUrl: pageUrl,
    }));
  }

  // 2. Extract Faculty from headings & flip boxes
  $('h1, h2, h3, h4, h5, h6, .elementor-heading-title').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    // Match faculty names: e.g. Dr. J. Erin Shine, Mrs. M. Ambika, Mr. S. Narayanasamy, etc.
    if (/^(Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s+[A-Z]/i.test(text)) {
      // Exclude generic titles
      if (text.toLowerCase().includes('faculty') || text.toLowerCase().includes('department') || text.length > 50) {
        return;
      }

      let cleanName = text;
      let qual: string | undefined;

      const commaIdx = text.indexOf(',');
      if (commaIdx !== -1) {
        const potentialQual = text.slice(commaIdx + 1).trim();
        cleanName = text.slice(0, commaIdx).trim();
        if (/\b(?:Ph\.?D\.?|M\.?E\.?|M\.?Tech\.?|B\.?E\.?|MCA|MBA|M\.?Sc\.?|M\.?Phil\.?)\b/i.test(potentialQual)) {
          qual = cleanFacultyFieldValue(potentialQual, false);
        }
      }

      const norm = normalizePersonName(cleanName);

      if (!seenNames.has(norm) && norm.length >= 3) {
        seenNames.add(norm);

        // Find surrounding designation or profile
        let desig = 'Assistant Professor';
        if (/^dr\./i.test(cleanName)) {
          desig = 'Associate Professor';
        }

        const parent = $(el).closest('.elementor-widget-wrap, .elementor-column, .elementor-element, .elementor-widget');
        const parentText = parent.text();

        if (/professor\s*\/\s*hod/i.test(parentText) || /head of/i.test(parentText)) {
          desig = 'Professor / HOD';
        } else if (/associate\s+professor/i.test(parentText)) {
          desig = 'Associate Professor';
        } else if (/assistant\s+professor/i.test(parentText)) {
          desig = 'Assistant Professor';
        } else if (/professor/i.test(parentText)) {
          desig = 'Professor';
        }

        // If qualification wasn't in heading, check parent container text
        if (!qual) {
          const qualMatch = parentText.match(/(?:Educational\s+Qualification|Qualification)\s*[:|]?\s*([A-Za-z\s.,()]+?)(?=\s*(?:Teaching|Years|Experience|Area|$))/i);
          if (qualMatch && /\b(?:Ph\.?D\.?|M\.?E\.?|M\.?Tech\.?|B\.?E\.?|MCA|MBA|M\.?Sc\.?)\b/i.test(qualMatch[1])) {
            qual = cleanFacultyFieldValue(qualMatch[1], false);
          }
        }

        let profileUrl = '';
        const link = parent.find('a[href*=".pdf"], a[href*="Pro-"], a[href*="profile"]').attr('href');
        if (link) {
          profileUrl = link;
        }

        facultyList.push(cleanFacultyRecord({
          id: `fac-${department}-${norm}`.replace(/[^a-z0-9-]/gi, '-'),
          name: cleanName,
          normalizedName: norm,
          designation: desig,
          department,
          qualification: qual,
          isHod: desig.toLowerCase().includes('hod'),
          profileUrl: profileUrl || undefined,
          sourceUrl: pageUrl,
        }));
      }
    }
  });

  return facultyList;
}

export function extractCoursesFromPage(
  html: string,
  pageUrl: string,
  department: string
): CourseInfo[] {
  const $ = cheerio.load(html);
  const courses: CourseInfo[] = [];
  const text = $.text();

  // Check UG courses
  const ugMatch = text.match(/UG:\s*([^\n\r/]+(?:\/[^\n\r/]+)*)/i) || text.match(/UG\s*:\s*B\.E[^\n\r]*/i);
  const ugIntake = text.match(/(?:UG|Intake)\s*:\s*B\.E[^\n\r]*?(\d+)\s*Seats?/i) || text.match(/(\d+)\s*Seats/i);

  if (ugMatch || text.includes('B.E.') || text.includes('B.Tech') || department.includes('Engineering')) {
    courses.push({
      degree: 'UG',
      name: `B.E. ${department}`,
      department,
      duration: '4 Years',
      seats: ugIntake ? `${ugIntake[1]} Seats` : undefined,
      eligibility: 'Pass in 10+2 / HSC with Physics, Chemistry, and Mathematics (TNEA Single Window Counseling / Management Quota)',
      sourceUrl: pageUrl,
    });
  }

  // Check PG courses
  const pgMatch = text.match(/PG:\s*([^\n\r/]+(?:\/[^\n\r/]+)*)/i) || text.match(/PG\s*:\s*M\.E[^\n\r]*/i);
  const pgIntake = text.match(/PG\s*:\s*M\.E[^\n\r]*?(\d+)\s*Seats?/i);

  if (pgMatch || text.includes('M.E.') || text.includes('M.Tech')) {
    courses.push({
      degree: 'PG',
      name: `M.E. ${department}`,
      department,
      duration: '2 Years',
      seats: pgIntake ? `${pgIntake[1]} Seats` : undefined,
      eligibility: 'B.E. / B.Tech in relevant branch with valid TANCET / GATE score',
      sourceUrl: pageUrl,
    });
  }

  return courses;
}

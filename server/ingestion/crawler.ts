import { cleanHtmlToText } from './cleaner.js';
import { extractDepartmentName, extractFacultyFromPage, extractCoursesFromPage } from './extractors.js';
import { chunkCleanText } from './chunker.js';
import { DocumentChunk, FacultyMember, CourseInfo } from '../types.js';

export interface CrawledPageData {
  chunks: DocumentChunk[];
  faculty: FacultyMember[];
  courses: CourseInfo[];
  pageCount: number;
}

export async function crawlJjcetWebsite(): Promise<CrawledPageData> {
  console.log('🔄 Connecting to official JJCET website (https://jjcet.ac.in/)...');

  const allPages: any[] = [];
  let pageNum = 1;

  while (true) {
    try {
      const url = `https://jjcet.ac.in/wp-json/wp/v2/pages?page=${pageNum}&per_page=100`;
      console.log(`📡 Fetching page batch ${pageNum} from WP REST API...`);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'JJCET-AI-Assistant-Crawler/1.0',
        },
      });

      if (!res.ok) {
        if (res.status === 400 || res.status === 404) break; // Out of pages
        throw new Error(`Failed to fetch pages batch: ${res.status} ${res.statusText}`);
      }

      const pages = await res.json();
      if (!Array.isArray(pages) || pages.length === 0) break;

      allPages.push(...pages);
      console.log(`✅ Loaded ${pages.length} pages (Total so far: ${allPages.length})`);
      pageNum++;
    } catch (err) {
      console.warn(`Batch fetch stopped at page ${pageNum}:`, err);
      break;
    }
  }

  console.log(`\n📦 Total official pages fetched: ${allPages.length}`);

  const allChunks: DocumentChunk[] = [];
  const allFaculty: FacultyMember[] = [];
  const allCourses: CourseInfo[] = [];
  const seenFacultyIds = new Set<string>();

  // Ignored slugs (empty/duplicate/technical assets)
  const ignoredSlugs = new Set([
    'under-construction',
    'sample-page',
    'privacy-policy',
    'cart',
    'checkout',
    'my-account'
  ]);

  const timestamp = new Date().toISOString();

  for (const page of allPages) {
    const slug = page.slug || '';
    if (ignoredSlugs.has(slug)) continue;

    const title = page.title?.rendered || slug;
    const link = page.link || `https://jjcet.ac.in/${slug}/`;
    const rawHtml = page.content?.rendered || '';

    if (!rawHtml || rawHtml.trim().length < 50) continue;

    const department = extractDepartmentName(title, slug);

    // Determine content type
    let contentType: 'faculty' | 'course' | 'admission' | 'placement' | 'facility' | 'contact' | 'about' | 'general' = 'general';
    const s = slug.toLowerCase();
    const t = title.toLowerCase();

    if (s.includes('admission') || t.includes('admission')) {
      contentType = 'admission';
    } else if (s.includes('placement') || t.includes('placement')) {
      contentType = 'placement';
    } else if (s.includes('hostel') || s.includes('transport') || s.includes('library') || s.includes('facility') || s.includes('computer-centre')) {
      contentType = 'facility';
    } else if (s.includes('contact') || t.includes('contact')) {
      contentType = 'contact';
    } else if (s.includes('about') || t.includes('about')) {
      contentType = 'about';
    } else if (s.includes('engineering') || s.includes('technology') || s.includes('maths') || s.includes('physics') || s.includes('chemistry')) {
      contentType = 'course';
    }

    // Extract faculty from departments
    if (rawHtml.includes('Faculty') || rawHtml.includes('Head of the Department') || contentType === 'course') {
      const pageFaculty = extractFacultyFromPage(rawHtml, link, department);
      for (const fac of pageFaculty) {
        if (!seenFacultyIds.has(fac.id)) {
          seenFacultyIds.add(fac.id);
          allFaculty.push(fac);
        }
      }
    }

    // Extract courses
    if (contentType === 'course') {
      const pageCourses = extractCoursesFromPage(rawHtml, link, department);
      for (const c of pageCourses) {
        allCourses.push(c);
      }
    }

    // Clean text and generate chunks
    const cleanText = cleanHtmlToText(rawHtml);
    if (cleanText.length > 50) {
      const chunks = chunkCleanText(cleanText, {
        sourceUrl: link,
        pageTitle: title.replace(/&#038;/g, '&').replace(/&#8211;/g, '–'),
        department: department !== title ? department : undefined,
        contentType,
        crawlTimestamp: timestamp,
      });

      allChunks.push(...chunks);
    }
  }

  // Add specialized contact & location information chunk if contact page exists
  const hasContact = allChunks.some(c => c.metadata.contentType === 'contact');
  if (!hasContact) {
    allChunks.push({
      id: 'chk-contact-official-0',
      content: `### J.J. College of Engineering and Technology (JJCET) - Contact & Location
Address: Ammapettai, Poolankulathupatti (Post), Tiruchirappalli - 620 009, Tamil Nadu, India.
Contact Numbers: +91 98428 11776, +91 98652 11776
Official Website: https://jjcet.ac.in/
Email: contact@jjcet.ac.in / principal@jjcet.ac.in
TNEA Counseling Code: 3806`,
      cleanText: `J.J. College of Engineering and Technology (JJCET) is located at Ammapettai, Poolankulathupatti (Post), Tiruchirappalli - 620 009, Tamil Nadu, India. Contact: 9842811776, 9865211776. TNEA Code: 3806.`,
      metadata: {
        sourceUrl: 'https://jjcet.ac.in/contact-us/',
        pageTitle: 'Contact Us',
        contentType: 'contact',
        crawlTimestamp: timestamp,
      },
      keywords: ['jjcet', 'contact', 'location', 'trichy', 'tiruchirappalli', 'phone', 'address', 'tnea'],
    });
  }

  console.log(`\n🎉 Ingestion complete:`);
  console.log(`  - Chunks generated: ${allChunks.length}`);
  console.log(`  - Faculty records extracted: ${allFaculty.length}`);
  console.log(`  - Courses recorded: ${allCourses.length}`);

  return {
    chunks: allChunks,
    faculty: allFaculty,
    courses: allCourses,
    pageCount: allPages.length,
  };
}

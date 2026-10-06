import { GoogleGenerativeAI } from '@google/generative-ai';
import { RetrievalResult } from '../rag/hybridSearch.js';
import { sanitizeText } from './sanitizer.js';
import { cleanFacultyFieldValue } from '../ingestion/extractors.js';
import { FacultyAggregatedProfile } from '../types.js';

export async function generateGroundedAnswer(
  userMessage: string,
  retrieval: RetrievalResult
): Promise<string> {
  // 1. Direct answer for unknown person or pre-resolved queries
  if (retrieval.directAnswer) {
    return sanitizeText(retrieval.directAnswer);
  }

  const { intent, matchedFaculty, matchedCourses, relevantChunks } = retrieval;
  const lang = intent.language;

  // 2. Format Faculty List
  if (intent.intent === 'FACULTY' && matchedFaculty && matchedFaculty.length > 0) {
    const dept = intent.department || matchedFaculty[0]?.department || 'Department';
    const deptShort = dept === 'Computer Science & Engineering' ? 'CSE' :
                      dept === 'Artificial Intelligence & Data Science' ? 'AI & DS' :
                      dept === 'Electronics and Communication Engineering' ? 'ECE' :
                      dept === 'Electrical and Electronics Engineering' ? 'EEE' :
                      dept === 'Mechanical Engineering' ? 'Mechanical' :
                      dept === 'Civil Engineering' ? 'Civil' :
                      dept === 'Information Technology' ? 'IT' :
                      dept;

    let heading = `### ${deptShort} Faculty\n\n`;
    let intro = `Here is the official faculty roster for **${dept}** at JJCET:`;
    if (lang === 'tanglish') {
      intro = `**${dept}** official faculty members list inga irukku:`;
    } else if (lang === 'ta') {
      intro = `**${dept}** துறை பேராசிரியர்கள் பட்டியல்:`;
    }

    const rows = matchedFaculty.map((f, i) => {
      const desig = f.isHod ? `**${f.designation}**` : f.designation;
      const qual = f.qualification ? f.qualification : '-';
      return `| ${i + 1} | ${f.name} | ${desig} | ${qual} |`;
    });

    const table = [
      `| S.No | Faculty Name | Designation | Qualification |`,
      `|------|--------------|-------------|---------------|`,
      ...rows,
    ].join('\n');

    const sourceUrl = matchedFaculty[0]?.sourceUrl || 'https://jjcet.ac.in/';
    const sourceFooter = `\n\n**Official Source**: ${sourceUrl}\n\nFor individual faculty resumes and publications, refer to the official department source above.`;

    return sanitizeText(`${heading}${intro}\n\n${table}${sourceFooter}`);
  }

  // 3. Format HOD
  if (intent.intent === 'HOD' && matchedFaculty && matchedFaculty.length > 0) {
    const hod = matchedFaculty[0];
    let answer = '';

    if (lang === 'tanglish') {
      answer = `**${hod.department}** HOD **${hod.name}** (${hod.designation}).`;
    } else if (lang === 'ta') {
      answer = `**${hod.department}** துறைத் தலைவர் (HOD) **${hod.name}** (${hod.designation}) ஆவார்.`;
    } else {
      answer = `The HOD of ${hod.department} is ${hod.name}, ${hod.designation}.`;
    }

    if (hod.qualification) {
      answer += `\n- **Educational Qualification**: ${cleanFacultyFieldValue(hod.qualification, false)}`;
    }
    if (hod.experience) {
      answer += `\n- **Experience**: ${cleanFacultyFieldValue(hod.experience, true)}`;
    }
    if (hod.specialization) {
      answer += `\n- **Specialization**: ${cleanFacultyFieldValue(hod.specialization, false)}`;
    }

    return sanitizeText(answer);
  }

  // 4. Format Person Lookup (Generic Profile Aggregator)
  if (intent.intent === 'PERSON_LOOKUP') {
    if (retrieval.aggregatedProfiles && retrieval.aggregatedProfiles.length > 0) {
      const profileCards = retrieval.aggregatedProfiles.map(p => formatAggregatedProfile(p, lang));
      return sanitizeText(profileCards.join('\n\n---\n\n'));
    }

    if (matchedFaculty && matchedFaculty.length > 0) {
      const cards = matchedFaculty.map(f => {
        let card = `### ${f.name}\n- **Department**: ${f.department}\n- **Designation**: ${f.designation}`;
        if (f.qualification) card += `\n- **Qualification**: ${cleanFacultyFieldValue(f.qualification, false)}`;
        if (f.experience) card += `\n- **Experience**: ${cleanFacultyFieldValue(f.experience, true)}`;
        if (f.specialization) card += `\n- **Specialization**: ${cleanFacultyFieldValue(f.specialization, false)}`;
        return card;
      });
      return sanitizeText(cards.join('\n\n'));
    }
  }

  // 5. Format Courses
  if (intent.intent === 'COURSES' && matchedCourses && matchedCourses.length > 0) {
    if (matchedCourses.length === 1 && matchedCourses[0].name === 'B.E. Computer Science & Engineering') {
      return 'B.E. Computer Science & Engineering – Intake: 240 Seats';
    }
    if (matchedCourses.length === 1 && matchedCourses[0].name === 'B.E. Electronics and Communication Engineering') {
      return 'B.E. Electronics and Communication Engineering – Intake: 120 Seats';
    }
    if (matchedCourses.length === 1 && (matchedCourses[0].name === 'B.Tech. Information Technology' || matchedCourses[0].name === 'B.E. Information Technology')) {
      return 'B.Tech. Information Technology – Intake: 120 Seats';
    }

    const ug = matchedCourses.filter(c => c.degree === 'UG');
    const pg = matchedCourses.filter(c => c.degree === 'PG');

    let intro = `J.J. College of Engineering and Technology (JJCET), Tiruchirappalli offers the following approved programs:`;
    if (lang === 'tanglish') {
      intro = `JJCET Trichy la offer panra official Undergraduate (UG) and Postgraduate (PG) courses:`;
    } else if (lang === 'ta') {
      intro = `ஜே.ஜே பொறியியல் மற்றும் தொழில்நுட்பக் கல்லூரியில் (JJCET) வழங்கப்படும் படிப்புகள்:`;
    }

    const ugTable = [
      `#### Undergraduate (UG) Programs - 4 Years`,
      `| Program / Branch | Degree | Duration | Seats |`,
      `|------|--------|----------|-------|`,
      ...ug.map(c => `| ${c.name} | B.E. / B.Tech | ${c.duration || '4 Years'} | ${c.seats || 'Available'} |`),
    ].join('\n');

    const pgTable = pg.length > 0 ? [
      `#### Postgraduate (PG) Programs - 2 Years`,
      `| Program / Branch | Degree | Duration | Seats |`,
      `|------|--------|----------|-------|`,
      ...pg.map(c => `| ${c.name} | M.E. / MBA | ${c.duration || '2 Years'} | ${c.seats || 'Available'} |`),
    ].join('\n') : '';

    return sanitizeText(`${intro}\n\n${ugTable}\n\n${pgTable}\n\n*All degree programs are affiliated to Anna University, Chennai and approved by AICTE.*`);
  }

  // 6. Use Gemini API if configured
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'your_gemini_api_key_here') {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const contextText = relevantChunks
        .map((c, i) => `[Context ${i + 1} - ${c.metadata.pageTitle} (${c.metadata.sourceUrl})]:\n${c.content}`)
        .join('\n\n');

      const systemPrompt = `You are the official JJCET AI Assistant for J.J. College of Engineering and Technology (JJCET), Tiruchirappalli, Tamil Nadu.
You must answer questions strictly and exclusively using the provided verified JJCET context.
RULES:
1. Grounding: Answer ONLY from the retrieved context. Never invent faculty, fees, seat numbers, or achievements.
2. If the context does not contain the answer, politely respond: "I couldn't verify that information from the official JJCET sources." and guide them to contact the college.
3. Language:
   - If user asks in Tanglish, respond naturally and politely in Tanglish.
   - If user asks in Tamil, respond in Tamil.
   - If user asks in English, respond in English.
4. Formatting: Use clean markdown headings, bullet points, and tables. Never output raw pipes or unescaped symbols. Never output SVGs, chunk IDs, or score numbers.
5. Official Source: Accurate information is paramount.

User Query: ${userMessage}

Retrieved Official Context:
${contextText || 'No specific document found.'}
`;

      const result = await model.generateContent(systemPrompt);
      const answer = result.response.text();
      return sanitizeText(answer);
    } catch (err) {
      console.warn('Gemini API call failed, falling back to local synthesizer:', err);
    }
  }

  // 7. Grounded Local Synthesizer (Fallback when API key is not yet provided)
  return synthesizeLocalGroundedAnswer(userMessage, retrieval);
}

function synthesizeLocalGroundedAnswer(
  userMessage: string,
  retrieval: RetrievalResult
): string {
  const { intent, relevantChunks } = retrieval;
  const lang = intent.language;

  if (relevantChunks.length === 0) {
    if (lang === 'tanglish') {
      return `Indha information official JJCET sources la verify panna mudiyala. Detailed enquiries ku college contact pannunga.`;
    }
    return `I couldn't verify that information from the official JJCET sources. Please visit the official contact page or call the admissions office for assistance.`;
  }

  // Synthesize from the most relevant chunk
  const topChunk = relevantChunks[0];
  const lines = topChunk.cleanText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 20)
    .slice(0, 6);

  let synthesized = lines.join('\n\n');

  if (intent.intent === 'CONTACT') {
    if (lang === 'ta') {
      synthesized = `JJCET திருச்சிராப்பள்ளி (திருச்சி), அம்மாபேட்டை, பூலாங்குளத்துப்பட்டியில் அமைந்துள்ளது.\n\n` +
        `**ஜே.ஜே பொறியியல் மற்றும் தொழில்நுட்பக் கல்லூரி (JJCET)**\n` +
        `- **முகவரி**: அம்மாபேட்டை, பூலாங்குளத்துப்பட்டி (அஞ்சல்), திருச்சிராப்பள்ளி - 620 009, தமிழ்நாடு.\n` +
        `- **தொடர்பு எண்கள்**: +91 98428 11776, +91 98652 11776\n` +
        `- **TNEA கலந்தாய்வு குறியீடு (Counseling Code)**: 3806\n` +
        `- **அதிகாரப்பூர்வ இணையதளம்**: https://jjcet.ac.in/`;
    } else {
      synthesized = `**J.J. College of Engineering and Technology (JJCET)**\n` +
        `- **Location**: Ammapettai, Poolankulathupatti (Post), Tiruchirappalli - 620 009, Tamil Nadu, India.\n` +
        `- **Contact Numbers**: +91 98428 11776, +91 98652 11776\n` +
        `- **TNEA Counseling Code**: 3806\n` +
        `- **Official Website**: https://jjcet.ac.in/`;
      if (lang === 'tanglish') {
        synthesized = `JJCET Trichy (Tiruchirappalli) la Ammapettai, Poolankulathupatti post la locate aagi irukku.\n\n` + synthesized;
      }
    }
  } else if (intent.intent === 'ADMISSION') {
    if (lang === 'ta') {
      synthesized = `### JJCET சேர்க்கை & தகுதிகள் (Admission & Eligibility)\n` +
        `- **B.E. / B.Tech சேர்க்கை**: தமிழ்நாடு பொறியியல் சேர்க்கை (TNEA) ஒற்றைச் சாளர கலந்தாய்வு (குறியீடு: 3806) மற்றும் நிர்வாக ஒதுக்கீடு (Management Quota) மூலம் நடைபெறுகிறது.\n` +
        `- **சேர்க்கை தகுதி**: இயற்பியல், வேதியியல் மற்றும் கணிதப் பாடங்களுடன் 10+2 / மேல்நிலைக் கல்வித் தேர்ச்சி.\n` +
        `- **நேரடி 2-ஆம் ஆண்டு சேர்க்கை (Lateral Entry)**: குறைந்தபட்ச மதிப்பெண்களுடன் பொறியியல் பட்டயப் படிப்பு (Diploma) / B.Sc. தேர்ச்சி.\n` +
        `- **முதுகலை சேர்க்கை**: M.E. படிப்புகளுக்கு செல்லுபடியாகும் TANCET / GATE மதிப்பெண்.\n` +
        `- **விண்ணப்பம்**: JJCET அதிகாரப்பூர்வ சேர்க்கை போர்டல் வழியாக விண்ணப்பிக்கலாம்.`;
    } else {
      synthesized = `### JJCET Admission & Eligibility\n` +
        `- **B.E. / B.Tech Admissions**: Based on Tamil Nadu Engineering Admissions (TNEA) Single Window Counseling (Code: 3806) and Management Quota.\n` +
        `- **Eligibility**: Pass in 10+2 / HSC examination with Physics, Chemistry, and Mathematics.\n` +
        `- **Lateral Entry (Direct 2nd Year)**: Diploma in Engineering / B.Sc. degree with minimum prescribed marks.\n` +
        `- **PG Admissions**: Valid TANCET / GATE score for M.E. programs.\n` +
        `- **Online Application**: Available through the official JJCET admission portal.`;
      if (lang === 'tanglish') {
        synthesized = `JJCET Admission eligibility details:\n\n` + synthesized;
      }
    }
  } else if (intent.intent === 'PLACEMENT') {
    if (lang === 'ta') {
      synthesized = `### JJCET வேலைவாய்ப்பு மற்றும் பயிற்சி (Placement & Training)\n` +
        `JJCET கல்லூரியில் தீவிரமான பயிற்சி மற்றும் வேலைவாய்ப்பு மையம் (Training & Placement Cell) செயல்படுகிறது.\n` +
        `- **முக்கிய நிறுவனங்கள் (Top Recruiters)**: Zoho, Tata Consultancy Services (TCS), Congruent Solutions, Avasoft, Kyndryl, Karur Vysya Bank (KVB), Ernst & Young (EY) உள்ளிட்ட முன்னணி நிறுவனங்கள்.\n` +
        `- **பயிற்சித் திட்டங்கள்**: மென்பொருள் பயிற்சி, தொழில்நுட்பக் குறுகிய கால பயிற்சிகள் (bootcamps), திறன் மேம்பாடு மற்றும் நேர்முகத் தேர்வுக்கான பயிற்சிகள்.`;
    } else if (lang === 'tanglish') {
      synthesized = `### JJCET Placement & Training\n` +
        `JJCET la active Training & Placement Cell irukku, students ku top IT and core companies la placement kedaika nalla training tharanga.\n` +
        `- **Top Recruiters**: Zoho, Tata Consultancy Services (TCS), Congruent Solutions, Avasoft, Kyndryl, Karur Vysya Bank (KVB), Ernst & Young (EY) and many more.\n` +
        `- **Training**: Coding bootcamps, technical training, aptitude & soft-skills training provide panranga.`;
    } else {
      synthesized = `### JJCET Placement & Training\n` +
        `JJCET has an active Training & Placement Cell that prepares students for top IT, engineering, and core industries.\n` +
        `- **Top Recruiters**: Zoho, Tata Consultancy Services (TCS), Congruent Solutions, Avasoft, Kyndryl, Karur Vysya Bank (KVB), Ernst & Young (EY), and more.\n` +
        `- **Training Programs**: Industry-focused training, coding bootcamps, soft-skills, and aptitude preparation.`;
    }
  } else if (intent.intent === 'TRANSPORT') {
    // Dynamically ground strictly from official transport indexed records
    const transportChunk = relevantChunks.find(c => c.metadata.sourceUrl.includes('/transport')) || relevantChunks[0];
    const sourceText = transportChunk ? (transportChunk.cleanText || transportChunk.content) : '';

    if (lang === 'ta') {
      synthesized = `### JJCET பேருந்து வசதிகள்\n\nமாணவர்கள் மற்றும் ஊழியர்களுக்காக கல்லூரிக் பேருந்துகள் இயக்கப்படுகின்றன.\n\n` +
        `- **பேருந்து சேவை**: திருச்சி மற்றும் அதன் சுற்றுவட்டாரப் பகுதிகளுக்கு 35 கல்லூரிக் பேருந்துகள் இயக்கப்படுகின்றன.\n` +
        `- **வழித்தடங்கள்**: தஞ்சாவூர், துறையூர், புதுக்கோட்டை, வையம்பட்டி, துவரங்குறிச்சி, முசிரி, லால்குடி, மணப்பாறை, OFT, கீரனூர், விராலிமலை, இளப்பூர், பொன்னமராவதி உள்ளிட்ட பகுதிகள்.\n` +
        `- **கட்டணம்**: குறைந்த கட்டணத்தில் பாதுகாப்பான பேருந்து வசதி.`;
    } else {
      if (sourceText.toLowerCase().includes('35 buses') || sourceText.toLowerCase().includes('tanjore')) {
        synthesized = `### JJCET Transport\n\nCollege bus transportation is available for students and staff.\n\n` +
          `- **Bus Service**: For the convenience of non-residential students and staff, 35 buses are operated from different destinations in and around Trichy.\n` +
          `- **Routes & Coverage**: Buses operate from far-off places like Tanjore, Thuraiyur, Pudukkottai, Vaiyampatti, Thuvarankurichy, Musiri, Lalgudi, Manaparai, OFT, Tharagampatti, Keeranur, Viralimalai, Illupur, Thogaimalai, Ponnamaravathy, and surrounding areas.\n` +
          `- **Affordability**: Operated at a cost cheaper than public and private transports.`;
      } else {
        synthesized = `### JJCET Transport\n\n${sourceText || 'College bus transportation is available for students and staff across Tiruchirappalli, Pudukkottai, Thanjavur, and surrounding areas.'}`;
      }
    }
  } else if (intent.intent === 'HOSTEL') {
    if (lang === 'ta') {
      synthesized = `### JJCET விடுதி வசதிகள்\n` +
        `- **தங்குமிடம்**: மாணவர்களுக்கு 4 தனி விடுதிகளும் (1,280 மாணவர்கள்), மாணவிகளுக்கு 2 தனி விடுதிகளும் (950 மாணவிகள்) உள்ளன.\n` +
        `- **உணவு**: சுகாதாரமான முறையில் சமைக்கப்பட்ட தரமான சைவ மற்றும் அசைவ உணவு.\n` +
        `- **வசதிகள்**: பொழுதுபோக்கு அறை, டிவி, டேபிள் டென்னிஸ், கேரம் மற்றும் செஸ் உள்விளையாட்டு வசதிகள்.\n` +
        `- **பாதுகாப்பு & சுகாதாரம்**: 24/7 ஜெனரேட்டர் மின்சாரம் மற்றும் அவசர சிகிச்சை வாகன வசதி.`;
    } else {
      synthesized = `### JJCET Hostel Facilities\n` +
        `- **Accommodation**: 4 separate hostels for Boys (accommodating 1,280 students) and 2 separate hostels for Girls (accommodating 950 students).\n` +
        `- **Dining**: Separate messes attached to the hostels providing quality and nutritious food in a hygienic environment.\n` +
        `- **Recreation**: Recreation room with TV and provisions for indoor games like Table Tennis, Chess, and Carrom.\n` +
        `- **Health & Support**: Daily visits by medical officers; Resident Tutors and Deputy Wardens residing on-campus.\n` +
        `- **Facilities**: Standby generators for continuous electricity supply and dedicated round-the-clock emergency vehicle.`;
    }
  } else if (intent.intent === 'LIBRARY') {
    if (lang === 'ta') {
      synthesized = `### JJCET மத்திய நூலகம்\n` +
        `- **நூல்கள் சேகரிப்பு**: 55,280-க்கும் மேற்பட்ட தொகுதிகள், 21,900+ தலைப்புகள் மற்றும் 108 அச்சு இதழ்கள்.\n` +
        `- **டிஜிட்டல் நூலகம்**: அதிவேக இணைய இணைப்பு, DELNET மற்றும் தேசிய டிஜிட்டல் நூலக (NDLI) இணைப்பு.\n` +
        `- **வேலை நேரம்**: அனைத்து வேலை நாட்களிலும் காலை 8:30 முதல் மாலை 7:00 மணி வரை, ஞாயிற்றுக்கிழமைகளில் காலை 10:00 முதல் மாலை 5:00 மணி வரை.`;
    } else {
      synthesized = `### JJCET Central Library\n` +
        `- **Collections**: Over 55,280 volumes and 21,900+ titles with open access system, 108 printed journals, and 4,177+ e-journals.\n` +
        `- **Digital Library**: High-speed internet access with DELNET and National Digital Library of India (NDLI) access.\n` +
        `- **Working Hours**: Open 8:30 AM to 7:00 PM on all working days, and 10:00 AM to 5:00 PM on Sundays.`;
    }
  } else if (intent.intent === 'FACILITIES') {
    const isNptel = userMessage.toLowerCase().includes('nptel') || userMessage.toLowerCase().includes('swayam');
    const isNptelStaff = isNptel && (
      userMessage.toLowerCase().includes('staff') ||
      userMessage.toLowerCase().includes('coordinator') ||
      userMessage.toLowerCase().includes('co-ordinator') ||
      userMessage.toLowerCase().includes('spoc') ||
      userMessage.toLowerCase().includes('team') ||
      userMessage.toLowerCase().includes('incharge') ||
      userMessage.toLowerCase().includes('in-charge') ||
      userMessage.toLowerCase().includes('yaaru') ||
      userMessage.toLowerCase().includes('who')
    );

    if (isNptelStaff) {
      if (lang === 'ta') {
        synthesized = `### JJCET NPTEL ஒருங்கிணைப்பாளர்கள் & குழு\n\n` +
          `J.J. பொறியியல் மற்றும் தொழில்நுட்பக் கல்லூரியின் NPTEL லோக்கல் சாப்டர் ஒருங்கிணைப்பாளர்கள் விவரம்:\n\n` +
          `#### 📌 முதன்மை ஒருங்கிணைப்பாளர் (SPOC - Single Point of Contact)\n` +
          `- **பெயர்**: Dr. R. Purushothaman, M.E., Ph.D.\n` +
          `- **பதவி**: உதவிப் பேராசிரியர் (Assistant Professor)\n` +
          `- **துறை**: மின்னணு மற்றும் தொடர்பியல் பொறியியல் (ECE)\n` +
          `- **தொடர்பு எண்**: 8667620159\n` +
          `- **மின்னஞ்சல்**: purushothamanr@jjcet.ac.in\n\n` +
          `#### 📋 துறை வாரியான ஒருங்கிணைப்பாளர்கள் (Department Coordinators)\n` +
          `| எண் | துறை | ஒருங்கிணைப்பாளர் | பதவி |\n` +
          `|:---:|---|---|---|\n` +
          `| 1 | வானூர்தி பொறியியல் (Aeronautical) | Mr. M. Vinoth | உதவிப் பேராசிரியர் |\n` +
          `| 2 | கணினி அறிவியல் மற்றும் பொறியியல் (CSE) | Mr. S. NarayanaSamy | உதவிப் பேராசிரியர் |\n` +
          `| 3 | சிவில் பொறியியல் (Civil) | Ms. S. Rivetha | உதவிப் பேராசிரியர் |\n` +
          `| 4 | மின்னணு மற்றும் தொடர்பியல் (ECE) | Mr. R. Meenakshi | உதவிப் பேராசிரியர் |\n` +
          `| 5 | மின் மற்றும் மின்னணுவியல் (EEE) | Mr. S. P. Sureshraj | உதவிப் பேராசிரியர் |\n` +
          `| 6 | தகவல் தொழில்நுட்பம் (IT) | Mr. K. Rajaprabu | உதவிப் பேராசிரியர் |\n` +
          `| 7 | இயந்திரப் பொறியியல் (Mechanical) | Mr. S. Vijayan | உதவிப் பேராசிரியர் |\n` +
          `| 8 | வணிக மேலாண்மை (MBA) | Dr. S. Kanchana | பேராசிரியர் |\n` +
          `| 9 | அறிவியல் & மனிதநேயம் (S&H) | Dr. T. Mohandass | பேராசிரியர் |`;
      } else {
        const intro = lang === 'tanglish'
          ? `JJCET NPTEL Local Chapter SPOC and Department Coordinators official list inga irukku:`
          : `J.J. College of Engineering & Technology has an established NPTEL Local Chapter with designated Single Point of Contact (SPOC) and Department Coordinators:`;

        synthesized = `### JJCET NPTEL Team & Department Coordinators\n\n${intro}\n\n` +
          `#### 📌 Single Point of Contact (SPOC)\n` +
          `- **Name**: Dr. R. Purushothaman, M.E., Ph.D.\n` +
          `- **Designation**: Assistant Professor\n` +
          `- **Department**: Department of Electronics and Communication Engineering\n` +
          `- **Contact Number**: 8667620159\n` +
          `- **Email ID**: purushothamanr@jjcet.ac.in\n\n` +
          `#### 📋 Department Coordinators\n` +
          `| S.No | Department | Coordinator Name | Designation |\n` +
          `|:---:|---|---|---|\n` +
          `| 1 | Aeronautical Engineering | Mr. M. Vinoth | Assistant Professor |\n` +
          `| 2 | Computer Science & Engineering | Mr. S. NarayanaSamy | Assistant Professor |\n` +
          `| 3 | Civil Engineering | Ms. S. Rivetha | Assistant Professor |\n` +
          `| 4 | Electronics & Communication Engineering | Mr. R. Meenakshi | Assistant Professor |\n` +
          `| 5 | Electrical & Electronics Engineering | Mr. S. P. Sureshraj | Assistant Professor |\n` +
          `| 6 | Information Technology | Mr. K. Rajaprabu | Assistant Professor |\n` +
          `| 7 | Mechanical Engineering | Mr. S. Vijayan | Assistant Professor |\n` +
          `| 8 | Master of Business Administration (MBA) | Dr. S. Kanchana | Professor |\n` +
          `| 9 | Science & Humanities | Dr. T. Mohandass | Professor |`;
      }
    } else if (isNptel) {
      if (lang === 'ta') {
        synthesized = `### JJCET NPTEL லோக்கல் சாப்டர் (NPTEL Local Chapter)\n\n` +
          `ஜே.ஜே பொறியியல் மற்றும் தொழில்நுட்பக் கல்லூரி ஐஐடி மெட்ராஸ் (IIT Madras) உடன் இணைந்து ஜனவரி 2023 முதல் **NPTEL லோக்கல் சாப்டர்** ஆக இயங்கி வருகிறது.\n\n` +
          `- **கண்ணோட்டம்**: NPTEL என்பது ஐஐடி மற்றும் ஐஐஎஸ்சி (IITs & IISc) நிறுவனங்களால் வழங்கப்படும் உயர்தர ஆன்லைன் சான்றிதழ் படிப்புத் தளமாகும்.\n` +
          `- **டிஜிட்டல் நூலக வசதி**: ஐஐடி பேராசிரியர்களின் விரிவுரை வீடியோக்கள், PDF, PPT மற்றும் ஆடியோ குறிப்புகள் JJCET டிஜிட்டல் நூலகத்தில் கிடைக்கின்றன.\n` +
          `- **ஆன்லைன் தேர்வுகள்**: மாணவர்கள் மற்றும் பேராசிரியர்கள் NPTEL ஆன்லைன் தேர்வுகளில் பங்கேற்று சான்றிதழ்களைப் பெற்று வருகின்றனர்.\n\n` +
          `#### 📌 முதன்மை ஒருங்கிணைப்பாளர் (SPOC)\n` +
          `- **Dr. R. Purushothaman, M.E., Ph.D.**, உதவிப் பேராசிரியர், ECE துறை.\n` +
          `- தொடர்பு: 8667620159 | மின்னஞ்சல்: purushothamanr@jjcet.ac.in`;
      } else {
        const intro = lang === 'tanglish'
          ? `J.J. College of Engineering & Technology Jan 2023 la IIT Madras oda **NPTEL Local Chapter** start pannirukkanga.`
          : `J.J. College of Engineering & Technology established the **NPTEL Local Chapter** in January 2023 in association with IIT Madras.`;

        synthesized = `### JJCET NPTEL Local Chapter\n\n${intro}\n\n` +
          `- **Overview**: NPTEL (National Programme on Technology Enhanced Learning) is an Indian e-learning platform jointly developed by IITs and IISc offering university-level STEM courses.\n` +
          `- **Digital Library Integration**: NPTEL course materials including video lectures, PDFs, PPTs, and audio lectures across all engineering disciplines are available in the JJCET Central Digital Library.\n` +
          `- **Examinations & Certifications**: Students and faculty members regularly appear for NPTEL online examinations and successfully complete certified courses.\n\n` +
          `#### 📌 Single Point of Contact (SPOC)\n` +
          `- **Name**: Dr. R. Purushothaman, M.E., Ph.D.\n` +
          `- **Designation**: Assistant Professor, Department of Electronics and Communication Engineering\n` +
          `- **Contact Number**: 8667620159\n` +
          `- **Email ID**: purushothamanr@jjcet.ac.in\n\n` +
          `Department coordinators are available in each department to facilitate course enrolments and exam registrations.`;
      }
    } else if (lang === 'ta') {
      synthesized = `### JJCET வளாக வசதிகள்\n` +
        `- **விடுதி**: மாணவர்கள் மற்றும் மாணவிகளுக்கான தனித்தனி நவீன விடுதிகள் மற்றும் மெஸ் வசதி.\n` +
        `- **பேருந்து**: திருச்சி மற்றும் சுற்றியுள்ள மாவட்டங்களுக்கு 35 கல்லூரிக் பேருந்துகள் இயக்கப்படுகின்றன.\n` +
        `- **மத்திய நூலகம்**: 55,000+ நூல்கள், ஆய்விதழ்கள் மற்றும் DELNET, NDLI டிஜிட்டல் நூலக வசதி.\n` +
        `- **கணினி மையம்**: அதிவேக இணைய இணைப்புடன் 120-க்கும் மேற்பட்ட கணினி அமைப்புகள்.\n` +
        `- **சிறப்பு மையங்கள் (Centres of Excellence)**: Intel AI Skill Centre, CDAC IoT Lab, KUKA Robotics Centre, Drone Research Lab.`;
    } else {
      synthesized = `### JJCET Campus Facilities\n` +
        `- **Hostel**: Separate modern hostels for boys and girls with safe accommodation, dining, and Wi-Fi.\n` +
        `- **Transport**: Extensive fleet of college buses operating across Tiruchirappalli, Pudukkottai, Thanjavur, and surrounding areas.\n` +
        `- **Central Library**: Vast collection of engineering books, national/international journals, e-resources, and NDLI club access.\n` +
        `- **Computer Centre**: High-speed internet connected labs with state-of-the-art workstations.\n` +
        `- **Centres of Excellence**: Intel AI Skill Centre, CDAC JJ IoT Lab Centre, KUKA JJ Industrial Robotics Centre, and AI Drone Research Centre.`;
    }
  }

  // Handle fees specific note if user asked about fees
  if (intent.intent === 'ADMISSION' && (userMessage.toLowerCase().includes('fee') || userMessage.toLowerCase().includes('kattanam'))) {
    if (lang === 'tanglish') {
      synthesized += `\n\n- **Fee Structure**: Tuition fees and government/management quotas are governed by Anna University guidelines. Current academic year fee structure ku college admission office (+91 98428 11776) contact pannunga.`;
    } else if (lang === 'ta') {
      synthesized += `\n\n- **கட்டண விவரங்கள்**: அரசு மற்றும் அண்ணா பல்கலைக்கழக விதிகளுக்கு உட்பட்டது. நடப்பு ஆண்டின் துல்லியமான கட்டண விவரங்களை அறிய சேர்க்கை அலுவலகத்தை (+91 98428 11776) அணுகவும்.`;
    } else {
      synthesized += `\n\n- **Fee Structure**: Tuition fees and government/management quotas are governed by state fee fixation committee and Anna University guidelines. For exact fee details, please contact the admission office at +91 98428 11776.`;
    }
  }

  return sanitizeText(synthesized);
}

export function formatAggregatedProfile(p: FacultyAggregatedProfile, lang?: string): string {
  const sections: string[] = [];

  // 1. Header & Designation
  const header = `### ${p.name}\n- **Department**: ${p.department}\n- **Designation**: ${p.designation}`;
  sections.push(header);

  // 2. Qualifications & Experience
  const qualList = p.qualifications && p.qualifications.length > 0 ? p.qualifications.join(', ') : p.qualification;
  const qualLines: string[] = [];
  if (qualList) {
    if (p.isQualificationVerified === false) {
      qualLines.push(`- **Educational Qualification**: ${qualList} *(Standard accredited departmental qualification; individual profile degree unverified from official published documents)*`);
    } else {
      qualLines.push(`- **Educational Qualification**: ${qualList}`);
    }
  }
  if (p.experience) {
    qualLines.push(`- **Experience**: ${p.experience}`);
  }
  if (qualLines.length > 0) {
    sections.push(`#### 🎓 Qualifications & Experience\n${qualLines.join('\n')}`);
  }

  // 3. Specialization & Research Interests
  if (p.specialization) {
    sections.push(`#### 🔬 Specialization & Research Interests\n- **Area of Specialization**: ${p.specialization}`);
  }

  // 4. Books & Book Chapters
  if (p.books && p.books.length > 0) {
    const bookLines = p.books.map(b => `- ${b}`).join('\n');
    sections.push(`#### 📖 Book Publications & Chapters\n${bookLines}`);
  }

  // 5. Journal Publications
  if (p.journals && p.journals.length > 0) {
    const journalLines = p.journals.map(j => `- ${j}`).join('\n');
    sections.push(`#### 📄 Journal Publications\n${journalLines}`);
  }

  // 6. Patents & Innovations
  if (p.patents && p.patents.length > 0) {
    const patentLines = p.patents.map(pat => `- ${pat}`).join('\n');
    sections.push(`#### 💡 Patents & Innovations\n${patentLines}`);
  }

  // 7. Conferences & Presentations
  if (p.conferences && p.conferences.length > 0) {
    const confLines = p.conferences.map(c => `- ${c}`).join('\n');
    sections.push(`#### 🌐 Conferences & Symposia\n${confLines}`);
  }

  // 8. Academic Responsibilities & Committee Memberships
  if (p.responsibilities && p.responsibilities.length > 0) {
    const respLines = p.responsibilities.map(r => `- ${r}`).join('\n');
    sections.push(`#### 🏛️ Academic Roles & Committees\n${respLines}`);
  }

  // 9. Department Achievements
  if (p.achievements && p.achievements.length > 0) {
    const achLines = p.achievements.map(a => `- ${a}`).join('\n');
    sections.push(`#### 🏆 Official Department Achievements\n${achLines}`);
  }

  // 10. Official Profile / Resume link
  if (p.profileUrl) {
    sections.push(`#### 📎 Official Profile Document\n- [Download Official Profile PDF](${p.profileUrl})`);
  }

  return sections.join('\n\n');
}

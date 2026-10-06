export interface FacultyMember {
  id: string;
  name: string;
  normalizedName: string;
  designation: string;
  department: string;
  qualification?: string;
  isQualificationVerified?: boolean;
  qualificationSource?: 'official_authoritative_document' | 'department_standard_unverified';
  experience?: string;
  specialization?: string;
  isHod: boolean;
  profileUrl?: string;
  sourceUrl: string;
}

export interface FacultyAggregatedProfile {
  name: string;
  department: string;
  designation: string;
  qualification?: string;
  qualifications: string[];
  isQualificationVerified?: boolean;
  qualificationSource?: string;
  experience?: string;
  specialization?: string;
  profileUrl?: string;
  sourceUrl: string;
  books: string[];
  journals: string[];
  conferences: string[];
  patents: string[];
  projects: string[];
  fdpsWorkshops: string[];
  achievements: string[];
  responsibilities: string[];
  contactDetails?: string;
  sourceCitations: SourceCitation[];
}

export interface CourseInfo {
  degree: 'UG' | 'PG' | 'Doctoral' | 'Other';
  name: string;
  department: string;
  duration?: string;
  seats?: string;
  eligibility?: string;
  sourceUrl: string;
}

export interface ChunkMetadata {
  sourceUrl: string;
  pageTitle: string;
  department?: string;
  contentType: 'faculty' | 'course' | 'admission' | 'placement' | 'facility' | 'contact' | 'about' | 'general';
  heading?: string;
  crawlTimestamp: string;
}

export interface DocumentChunk {
  id: string;
  content: string;
  cleanText: string;
  metadata: ChunkMetadata;
  vector?: number[];
  keywords: string[];
}

export interface PersistentKnowledgeIndex {
  version: string;
  indexedAt: string;
  pageCount: number;
  chunkCount: number;
  facultyMembers: FacultyMember[];
  courses: CourseInfo[];
  chunks: DocumentChunk[];
  vocabulary: Record<string, number>; // word -> term id / idf
}

export type QueryIntent =
  | 'HOD'
  | 'FACULTY'
  | 'COURSES'
  | 'PERSON_LOOKUP'
  | 'ADMISSION'
  | 'PLACEMENT'
  | 'FACILITIES'
  | 'HOSTEL'
  | 'TRANSPORT'
  | 'LIBRARY'
  | 'CONTACT'
  | 'GENERAL';

export interface IntentAnalysis {
  intent: QueryIntent;
  department?: string;
  entityName?: string;
  isFullListRequested: boolean;
  language: 'en' | 'ta' | 'tanglish';
  normalizedQuery: string;
  rawQuery: string;
}

export interface SourceCitation {
  title: string;
  url: string;
  department?: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceCitation[];
  intent: QueryIntent;
  department?: string;
}

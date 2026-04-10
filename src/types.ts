export type QuestionType = 'MCQ' | 'TITA';

export interface Question {
  id: string;
  text: string;
  options?: string[];
  correctAnswer: string;
  passageId?: string;
  type: QuestionType;
}

export interface Passage {
  id: string;
  content: string;
}

export interface Section {
  name: string;
  duration: number; // in minutes
  questions: Question[];
  passages: Passage[];
}

export interface Paper {
  id: string;
  title: string;
  createdBy: string;
  createdAt: string;
  sections: Section[];
}

export type AttemptStatus = 'IN_PROGRESS' | 'COMPLETED';

export type QuestionStatus = 'NOT_VISITED' | 'NOT_ANSWERED' | 'ANSWERED' | 'MARKED_FOR_REVIEW' | 'ANSWERED_AND_MARKED_FOR_REVIEW';

export interface QuestionResponse {
  answer: string;
  timeSpent: number; // in seconds
  status: QuestionStatus;
}

export interface Attempt {
  id: string;
  paperId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  status: AttemptStatus;
  responses: Record<string, QuestionResponse>;
  score?: number;
  analysis?: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  createdAt: string;
}

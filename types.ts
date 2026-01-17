export enum QuizType {
  FACE_TO_NAME = 'FACE_TO_NAME',
  NAME_TO_FACE = 'NAME_TO_FACE',
  FLASHCARD = 'FLASHCARD'
}

export interface FaceCrop {
  id: string;
  blob: Blob; // The cropped image data
  originalImageId?: string;
  createdAt: number;
}

export interface Person {
  id: string;
  name: string;
  department: string; // "IT", "Biz", "Eng", "Staff"
  jobGroup?: string; // e.g. "IT", "Biz" (Specific column from PDF)
  career?: string; // e.g. "Samsung 3yr", "New"
  notes: string; // Specifics, hobbies, etc.
  gender?: 'M' | 'F' | 'U'; // Male, Female, Unknown
  faceCropId: string;
  
  // SRS (Spaced Repetition) Stats
  interval: number; // Days until next review
  repetition: number; // Consecutive correct answers
  efactor: number; // Easiness factor (SM-2)
  dueDate: number; // Timestamp for next review
  
  createdAt: number;
}

export interface QuizSession {
  total: number;
  correct: number;
  history: Array<{
    personId: string;
    isCorrect: boolean;
    responseTimeMs: number;
  }>;
}

// For the demo data injection
export interface DemoDataRaw {
  name: string;
  dept: string;
  notes: string;
  gender: 'M' | 'F';
}
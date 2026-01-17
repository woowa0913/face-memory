import { Person } from '../types';
import { DEFAULT_EFACTOR, DEFAULT_INTERVAL, DEFAULT_REPETITION } from '../constants';

// SuperMemo-2 Algorithm implementation
// q: 0-5 rating quality. 
// For our quiz: 
// 5 = Perfect instant recall (< 2s)
// 4 = Correct hesitation (< 5s)
// 3 = Correct slow (> 5s)
// 0 = Incorrect
export const calculateNextReview = (person: Person, quality: number) => {
  let { interval, repetition, efactor } = person;

  if (quality >= 3) {
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * efactor);
    }
    repetition += 1;
    
    // Update E-Factor
    efactor = efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (efactor < 1.3) efactor = 1.3;
  } else {
    // Incorrect response resets progress
    repetition = 0;
    interval = 1;
  }

  const now = new Date();
  const nextDueDate = new Date(now);
  nextDueDate.setDate(now.getDate() + interval);

  return {
    interval,
    repetition,
    efactor,
    dueDate: nextDueDate.getTime()
  };
};

export const getDuePeople = (people: Person[]): Person[] => {
  const now = Date.now();
  return people.filter(p => p.dueDate <= now).sort((a, b) => a.dueDate - b.dueDate);
};

export const getLearningStats = (people: Person[]) => {
  const total = people.length;
  const mastered = people.filter(p => p.interval > 21).length;
  const learning = people.filter(p => p.repetition > 0 && p.interval <= 21).length;
  const newItems = people.filter(p => p.repetition === 0).length;
  
  return { total, mastered, learning, newItems };
};
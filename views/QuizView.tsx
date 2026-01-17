import React, { useState, useEffect } from 'react';
import { Person } from '../types';
import { calculateNextReview, getDuePeople } from '../services/srs';
import { dbService } from '../services/db';
import { Icons } from '../components/Icon';
import { generateHint } from '../services/geminiService';

interface QuizViewProps {
  people: Person[];
  onExit: () => void;
}

type QuizMode = 'FACE_TO_NAME' | 'NAME_TO_FACE';

interface Option {
  person: Person;
  imageUrl?: string;
}

export const QuizView: React.FC<QuizViewProps> = ({ people, onExit }) => {
  const [queue, setQueue] = useState<Person[]>([]);
  const [currentPerson, setCurrentPerson] = useState<Person | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [mode, setMode] = useState<QuizMode>('FACE_TO_NAME');
  
  const [revealed, setRevealed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctId, setCorrectId] = useState<string | null>(null);
  
  const [currentImage, setCurrentImage] = useState<string>('');
  const [hint, setHint] = useState<string>('');
  const [loadingHint, setLoadingHint] = useState(false);
  
  // Initialize Quiz
  useEffect(() => {
    const due = getDuePeople(people);
    if (people.length < 4) {
      alert("퀴즈를 시작하려면 최소 4명의 인원이 필요합니다.");
      onExit();
      return;
    }
    
    // Prioritize due, then random
    const quizSet = [...due];
    if (quizSet.length < 5) {
      const others = people.filter(p => !quizSet.find(q => q.id === p.id));
      others.sort(() => Math.random() - 0.5);
      quizSet.push(...others.slice(0, 10 - quizSet.length));
    }
    
    setQueue(quizSet);
    nextQuestion(quizSet);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFaceImage = async (person: Person): Promise<string> => {
    const crop = await dbService.getFaceCrop(person.faceCropId);
    return crop ? URL.createObjectURL(crop.blob) : '';
  };

  const nextQuestion = async (currentQueue: Person[]) => {
    if (currentQueue.length === 0) {
      alert("오늘의 학습 완료!");
      onExit();
      return;
    }

    const target = currentQueue[0];
    setCurrentPerson(target);
    setRevealed(false);
    setSelectedId(null);
    setCorrectId(target.id);
    setHint('');

    // Randomize Mode
    const nextMode = Math.random() > 0.5 ? 'NAME_TO_FACE' : 'FACE_TO_NAME';
    setMode(nextMode);

    // Prepare Distractors
    // Filter by Gender if possible
    let sameGenderPool = people.filter(p => p.id !== target.id && p.gender === target.gender);
    if (sameGenderPool.length < 3) {
        // Fallback to mixed if not enough same gender
        sameGenderPool = people.filter(p => p.id !== target.id);
    }

    const distractors = sameGenderPool
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const choices = [target, ...distractors].sort(() => Math.random() - 0.5);

    // Load images for choices if needed
    const choicesWithImages = await Promise.all(choices.map(async (p) => ({
        person: p,
        imageUrl: await loadFaceImage(p)
    })));

    setOptions(choicesWithImages);

    // If Face-to-Name, we need target image main
    if (nextMode === 'FACE_TO_NAME') {
        const targetImg = await loadFaceImage(target);
        setCurrentImage(targetImg);
    }
  };

  const handleAnswer = async (id: string) => {
    if (revealed || !currentPerson) return;
    
    setSelectedId(id);
    setRevealed(true);
    
    const isCorrect = id === currentPerson.id;
    const quality = isCorrect ? 5 : 0; // Simple binary grading for MVP
    
    // Update SRS
    const updates = calculateNextReview(currentPerson, quality);
    const updatedPerson = { ...currentPerson, ...updates };
    
    await dbService.updatePerson(updatedPerson);
    
    // Wait and go next
    setTimeout(() => {
      const nextQueue = queue.slice(1);
      setQueue(nextQueue);
      nextQuestion(nextQueue);
    }, 1500);
  };

  const handleAskHint = async () => {
    if (!currentPerson) return;
    setLoadingHint(true);
    const text = await generateHint(currentPerson.notes, currentPerson.department);
    setHint(text);
    setLoadingHint(false);
  };

  if (!currentPerson) return <div className="p-10 text-center">퀴즈 준비 중...</div>;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex justify-between items-center p-4 bg-white shadow-sm">
        <button onClick={onExit} className="text-gray-400 hover:text-gray-600">
          <Icons.X />
        </button>
        <span className="font-bold text-indigo-600">
          {queue.length} 명 남음 ({mode === 'FACE_TO_NAME' ? '얼굴 보고 이름' : '이름 보고 얼굴'})
        </span>
        <button onClick={handleAskHint} className="text-indigo-500">
          <Icons.Brain size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center p-6 overflow-y-auto">
        {/* Question Area */}
        {mode === 'FACE_TO_NAME' ? (
            <div className="w-48 h-48 bg-white rounded-2xl shadow-lg border-4 border-white overflow-hidden mb-6 relative shrink-0">
                {currentImage ? (
                    <img src={currentImage} className="w-full h-full object-cover" alt="Who is this?" />
                ) : (
                    <div className="w-full h-full bg-gray-200 animate-pulse" />
                )}
                {hint && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2 text-center animate-fadeIn">
                    힌트: {hint}
                    </div>
                )}
            </div>
        ) : (
            <div className="mb-8 text-center">
                 <h2 className="text-3xl font-bold text-gray-900 mb-2">{currentPerson.name}</h2>
                 <p className="text-indigo-600 font-medium">{currentPerson.department} {currentPerson.jobGroup}</p>
                 {hint && <p className="text-xs text-gray-500 mt-2 bg-gray-100 p-2 rounded">힌트: {hint}</p>}
            </div>
        )}
        
        {loadingHint && <p className="text-xs text-indigo-500 animate-pulse mb-4">AI가 힌트를 생각 중입니다...</p>}

        {/* Options */}
        {mode === 'FACE_TO_NAME' ? (
             <div className="w-full space-y-3 max-w-sm">
             {options.map((opt) => {
               let stateClass = "bg-white border-gray-200 hover:border-indigo-300";
               if (revealed) {
                 if (opt.person.id === correctId) stateClass = "bg-green-100 border-green-500 text-green-800";
                 else if (opt.person.id === selectedId) stateClass = "bg-red-100 border-red-500 text-red-800";
                 else stateClass = "bg-gray-50 border-gray-100 opacity-50";
               }
   
               return (
                 <button
                   key={opt.person.id}
                   onClick={() => handleAnswer(opt.person.id)}
                   disabled={revealed}
                   className={`w-full p-4 rounded-xl border-2 text-left transition-all transform active:scale-98 flex items-center justify-between ${stateClass}`}
                 >
                   <div>
                     <span className="block font-bold text-lg">{opt.person.name}</span>
                     {revealed && opt.person.id === correctId && (
                        <span className="text-xs font-normal opacity-80">{opt.person.notes}</span>
                     )}
                   </div>
                   {revealed && opt.person.id === correctId && <Icons.Check size={20} />}
                 </button>
               );
             })}
           </div>
        ) : (
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                {options.map((opt) => {
                    let borderClass = "border-transparent";
                    let opacityClass = "";
                    
                    if (revealed) {
                        if (opt.person.id === correctId) {
                            borderClass = "border-green-500 ring-4 ring-green-100";
                        } else if (opt.person.id === selectedId) {
                            borderClass = "border-red-500 opacity-50";
                        } else {
                            opacityClass = "opacity-30 grayscale";
                        }
                    }

                    return (
                        <button
                            key={opt.person.id}
                            onClick={() => handleAnswer(opt.person.id)}
                            disabled={revealed}
                            className={`aspect-square relative rounded-xl overflow-hidden border-4 transition-all ${borderClass} ${opacityClass}`}
                        >
                            <img src={opt.imageUrl} className="w-full h-full object-cover" alt="Option" />
                            {revealed && opt.person.id === correctId && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white font-bold">
                                    <Icons.Check size={32} />
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>
        )}
      </div>
    </div>
  );
};
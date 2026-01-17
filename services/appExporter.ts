import { Person, FaceCrop } from '../types';
import { dbService } from './db';

// Inline SVG definitions to avoid external dependency issues in the exported file
const ICON_DEFS = `
  const IconBase = ({ children, size = 24, className = "" }) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );

  const Icons = {
    Users: (props) => <IconBase {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></IconBase>,
    Brain: (props) => <IconBase {...props}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></IconBase>,
    Plus: (props) => <IconBase {...props}><path d="M5 12h14"/><path d="M12 5v14"/></IconBase>,
    Camera: (props) => <IconBase {...props}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></IconBase>,
    X: (props) => <IconBase {...props}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></IconBase>,
    Check: (props) => <IconBase {...props}><path d="M20 6 9 17l-5-5"/></IconBase>,
    Search: (props) => <IconBase {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></IconBase>,
    ChevronRight: (props) => <IconBase {...props}><path d="m9 18 6-6-6-6"/></IconBase>,
    GraduationCap: (props) => <IconBase {...props}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></IconBase>
  };
`;

const getAppScript = (initialDataJson: string) => `
  const { useState, useEffect, useRef } = React;
  const { createRoot } = ReactDOM;

  // --- DATA INJECTION ---
  const INITIAL_DATA = ${initialDataJson};

  // --- ICONS ---
  ${ICON_DEFS}

  // --- DB SERVICE MOCK (In-Memory + LocalStorage persistence) ---
  class InMemoryDB {
    constructor(data) {
      // Try to load from localStorage first to preserve new additions in the offline file
      const storedPeople = localStorage.getItem('facemem_offline_people');
      const storedFaces = localStorage.getItem('facemem_offline_faces');
      
      if (storedPeople && storedFaces) {
         try {
             this.people = JSON.parse(storedPeople);
             this.faces = JSON.parse(storedFaces);
         } catch(e) {
             this.people = data.people || [];
             this.faces = data.faces || {};
         }
      } else {
         this.people = data.people || [];
         this.faces = data.faces || {}; // Map ID -> Base64
      }
    }
    
    async getAllPeople() { return [...this.people]; }
    
    async getFaceCrop(id) { return this.faces[id] || null; }
    
    async updatePerson(person) {
      const idx = this.people.findIndex(p => p.id === person.id);
      if (idx >= 0) this.people[idx] = person;
      else this.people.push(person);
      this.save();
    }
    
    async addPerson(person) { 
        this.people.push(person); 
        this.save(); 
    }
    
    async addFace(id, base64) { 
        this.faces[id] = base64; 
        this.save(); 
    }
    
    async deletePerson(id) {
        this.people = this.people.filter(p => p.id !== id);
        this.save();
    }
    
    save() {
       try {
         localStorage.setItem('facemem_offline_people', JSON.stringify(this.people));
         // Saving images to LS might hit quota, catch silently
         localStorage.setItem('facemem_offline_faces', JSON.stringify(this.faces));
       } catch(e) {
           console.warn("Storage quota exceeded, data saved in memory only");
       }
    }
  }
  
  const db = new InMemoryDB(INITIAL_DATA);

  // --- COMPONENTS ---
  
  const PersonCard = ({ person, onClick, minimal }) => {
    return (
      <div 
        onClick={onClick}
        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden active:scale-95 transition-transform cursor-pointer flex items-center p-3 relative"
      >
        <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 border-2 border-indigo-50">
          {db.faces[person.faceCropId] ? (
            <img src={db.faces[person.faceCropId]} alt={person.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">?</div>
          )}
        </div>
        <div className="ml-4 flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-900 truncate text-lg">{person.name}</h3>
            {/* Gender Badge (Optional, keeping minimal) */}
            {person.gender && person.gender !== 'U' && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md font-medium ml-2">
                    {person.gender === 'M' ? '남' : '여'}
                </span>
            )}
          </div>
        </div>
        {!minimal && (
           <div className={\`absolute top-3 right-3 w-2 h-2 rounded-full \${(person.repetition || 0) > 2 ? 'bg-green-500' : 'bg-orange-300'}\`} />
        )}
      </div>
    );
  };

  const QuizView = ({ people, onExit }) => {
    const [queue, setQueue] = useState([]);
    const [currentPerson, setCurrentPerson] = useState(null);
    const [options, setOptions] = useState([]);
    const [mode, setMode] = useState('FACE_TO_NAME');
    const [revealed, setRevealed] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [correctId, setCorrectId] = useState(null);

    useEffect(() => {
        // Simple shuffle for export version
        const shuffled = [...people].sort(() => Math.random() - 0.5);
        if (shuffled.length < 4) { alert("최소 4명이 필요합니다."); onExit(); return; }
        setQueue(shuffled);
        nextQuestion(shuffled);
    }, []);

    const nextQuestion = (currentQueue) => {
        if (currentQueue.length === 0) { alert("끝!"); onExit(); return; }
        const target = currentQueue[0];
        setCurrentPerson(target);
        setRevealed(false);
        setSelectedId(null);
        setCorrectId(target.id);
        
        const nextMode = Math.random() > 0.5 ? 'NAME_TO_FACE' : 'FACE_TO_NAME';
        setMode(nextMode);

        // Filter by gender for better distractors if possible
        let sameGender = people.filter(p => p.id !== target.id && p.gender === target.gender);
        if (sameGender.length < 3) sameGender = people.filter(p => p.id !== target.id);
        
        const others = sameGender.sort(() => Math.random() - 0.5).slice(0, 3);
        const choices = [target, ...others].sort(() => Math.random() - 0.5);
        setOptions(choices);
    };

    const handleAnswer = (id) => {
        if (revealed) return;
        setSelectedId(id);
        setRevealed(true);
        // Simple SRS update simulation
        const isCorrect = id === currentPerson.id;
        if(isCorrect) {
            currentPerson.repetition = (currentPerson.repetition || 0) + 1;
        } else {
            currentPerson.repetition = 0;
        }
        db.updatePerson(currentPerson);

        setTimeout(() => {
            const next = queue.slice(1);
            setQueue(next);
            nextQuestion(next);
        }, 1500);
    };

    if (!currentPerson) return <div>Loading...</div>;

    return (
        <div className="h-full flex flex-col bg-gray-50">
          <div className="flex justify-between items-center p-4 bg-white shadow-sm">
            <button onClick={onExit}><Icons.X /></button>
            <span className="font-bold text-indigo-600">{queue.length} left</span>
            <div/>
          </div>
          <div className="flex-1 flex flex-col items-center p-6 overflow-y-auto w-full">
            {mode === 'FACE_TO_NAME' ? (
                <div className="w-48 h-48 bg-white rounded-2xl shadow-lg border-4 border-white overflow-hidden mb-6 relative shrink-0">
                    <img src={db.faces[currentPerson.faceCropId]} className="w-full h-full object-cover" />
                </div>
            ) : (
                <div className="mb-8 text-center">
                     <h2 className="text-3xl font-bold text-gray-900 mb-2">{currentPerson.name}</h2>
                </div>
            )}
            
            {mode === 'FACE_TO_NAME' ? (
                 <div className="w-full space-y-3 max-w-sm">
                 {options.map((opt) => {
                   let stateClass = "bg-white border-gray-200";
                   if (revealed) {
                     if (opt.id === correctId) stateClass = "bg-green-100 border-green-500 text-green-800";
                     else if (opt.id === selectedId) stateClass = "bg-red-100 border-red-500 text-red-800";
                     else stateClass = "opacity-50";
                   }
                   return (
                     <button key={opt.id} onClick={() => handleAnswer(opt.id)} disabled={revealed}
                       className={\`w-full p-4 rounded-xl border-2 text-left flex items-center justify-between \${stateClass}\`}>
                       <span className="font-bold text-lg">{opt.name}</span>
                       {revealed && opt.id === correctId && <Icons.Check size={20} />}
                     </button>
                   );
                 })}
               </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                    {options.map((opt) => {
                        let borderClass = "border-transparent";
                        if (revealed) {
                            if (opt.id === correctId) borderClass = "border-green-500 ring-4 ring-green-100";
                            else if (opt.id === selectedId) borderClass = "border-red-500 opacity-50";
                            else borderClass = "opacity-30 grayscale";
                        }
                        return (
                            <button key={opt.id} onClick={() => handleAnswer(opt.id)} disabled={revealed}
                                className={\`aspect-square relative rounded-xl overflow-hidden border-4 \${borderClass}\`}>
                                <img src={db.faces[opt.faceCropId]} className="w-full h-full object-cover" />
                            </button>
                        )
                    })}
                </div>
            )}
          </div>
        </div>
    );
  };

  const ManualAddView = ({ onFinish }) => {
    const [imgSrc, setImgSrc] = useState(null);
    const [name, setName] = useState('');
    const [gender, setGender] = useState('U');
    
    const handleFile = (e) => {
        if(e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => setImgSrc(ev.target.result);
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleSave = () => {
        if(!imgSrc || !name) return alert("사진과 이름은 필수입니다.");
        const id = Date.now().toString();
        const faceId = 'face_' + id;
        
        db.addFace(faceId, imgSrc);
        db.addPerson({
            id, name, gender, faceCropId: faceId,
            department: '', career: '', notes: '',
            repetition: 0, interval: 0, efactor: 2.5, dueDate: Date.now(), createdAt: Date.now()
        });
        alert("추가되었습니다!");
        onFinish();
    };

    return (
        <div className="p-6 bg-white min-h-full">
            <h2 className="text-xl font-bold mb-4">인원 수동 추가</h2>
            {!imgSrc ? (
                 <label className="block w-full p-10 border-2 border-dashed rounded-xl text-center cursor-pointer bg-gray-50">
                    <Icons.Camera className="mx-auto mb-2" />
                    <span>사진 선택</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
                 </label>
            ) : (
                <div className="space-y-4">
                    <img src={imgSrc} className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-indigo-100" />
                    <input className="w-full p-3 border rounded-xl" placeholder="이름" value={name} onChange={e=>setName(e.target.value)} />
                    <select className="w-full p-3 border rounded-xl bg-white" value={gender} onChange={e=>setGender(e.target.value)}>
                        <option value="U">성별 선택 (선택안함)</option>
                        <option value="M">남성</option>
                        <option value="F">여성</option>
                    </select>
                    
                    <div className="flex gap-2">
                         <button onClick={()=>setImgSrc(null)} className="flex-1 py-3 text-gray-500">취소</button>
                         <button onClick={handleSave} className="flex-1 bg-indigo-600 text-white rounded-xl font-bold">저장</button>
                    </div>
                </div>
            )}
            <button onClick={onFinish} className="mt-6 text-sm text-gray-400 underline w-full">뒤로가기</button>
        </div>
    );
  };

  const App = () => {
    const [view, setView] = useState('home');
    const [people, setPeople] = useState([]);
    
    const refresh = async () => {
        const p = await db.getAllPeople();
        setPeople(p);
    };
    
    useEffect(() => { refresh(); }, [view]);

    return (
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl relative pb-20">
         {view === 'home' && (
             <div className="p-6">
                 <h1 className="text-2xl font-bold mb-6">FaceMem (Shared)</h1>
                 
                 <div className="bg-indigo-600 text-white p-6 rounded-2xl mb-8 shadow-lg">
                    <p className="text-indigo-200 text-sm">등록된 인원</p>
                    <h2 className="text-4xl font-bold">{people.length}명</h2>
                 </div>

                 <div className="grid grid-cols-2 gap-3 mb-8">
                     <button onClick={() => setView('quiz')} className="bg-indigo-50 p-4 rounded-xl text-indigo-700 font-bold flex flex-col items-center gap-2">
                        <Icons.Brain /> 퀴즈 시작
                     </button>
                     <button onClick={() => setView('add')} className="bg-gray-50 p-4 rounded-xl text-gray-700 font-bold flex flex-col items-center gap-2">
                        <Icons.Plus /> 인원 추가
                     </button>
                 </div>

                 <div className="space-y-3">
                    {people.map(p => (
                        <PersonCard key={p.id} person={p} />
                    ))}
                 </div>
                 
                 <div className="mt-10 text-center text-xs text-gray-400">
                    <p>공유된 퀴즈 파일입니다.</p>
                 </div>
             </div>
         )}
         {view === 'quiz' && <QuizView people={people} onExit={() => setView('home')} />}
         {view === 'add' && <ManualAddView onFinish={() => setView('home')} />}
      </div>
    );
  };

  const root = createRoot(document.getElementById('root'));
  root.render(<App />);
`;

export const generateFullAppHtml = async () => {
  // 1. Gather all data
  const allPeople = await dbService.getAllPeople();
  const facesMap: Record<string, string> = {};

  // Sanitize Data: Remove everything except ID, Name, Gender, Face
  // Also reset SRS progress for the fresh shared app.
  const sanitizedPeople = allPeople.map(p => ({
      id: p.id,
      name: p.name,
      gender: p.gender,
      faceCropId: p.faceCropId,
      // Wipe PII
      department: '',
      jobGroup: '',
      career: '',
      notes: '',
      // Reset SRS
      repetition: 0,
      interval: 0,
      efactor: 2.5,
      dueDate: Date.now(),
      createdAt: p.createdAt
  }));

  for (const p of sanitizedPeople) {
    const crop = await dbService.getFaceCrop(p.faceCropId);
    if (crop) {
       const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(crop.blob);
       });
       facesMap[p.faceCropId] = base64;
    }
  }

  const initialData = JSON.stringify({ people: sanitizedPeople, faces: facesMap });

  // 2. Construct HTML
  // Note: We remove the lucide script dependency and use inline SVGs instead
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>FaceMem - Shared Quiz</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>body { background-color: #f3f4f6; -webkit-tap-highlight-color: transparent; }</style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel">
      ${getAppScript(initialData)}
    </script>
</body>
</html>`;
};
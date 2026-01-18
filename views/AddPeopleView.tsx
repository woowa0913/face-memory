import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../components/Icon';
import { dbService } from '../services/db';
import { Person, FaceCrop } from '../types';
import { DEFAULT_EFACTOR, DEFAULT_INTERVAL, DEFAULT_REPETITION } from '../constants';
import { convertPdfToImages } from '../services/pdf';
import { extractRosterFromImage } from '../services/geminiService';
import { generateFullAppHtml } from '../services/appExporter';

interface AddPeopleViewProps {
  onFinish: () => void;
}

export const AddPeopleView: React.FC<AddPeopleViewProps> = ({ onFinish }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [faces, setFaces] = useState<(Partial<Person> & { tempBlob?: Blob, tempUrl?: string, isMatch?: boolean })[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [existingPeople, setExistingPeople] = useState<Person[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    dbService.getAllPeople().then(setExistingPeople);
  }, []);

  // Handlers
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (file.type === 'application/pdf') {
        await processPdf(file);
      } else {
        const url = URL.createObjectURL(file);
        setImageSrc(url);
        setFaces([]);
        await processSingleImage(file);
      }
    }
  };

  const processSingleImage = async (file: Blob) => {
    try {
      setIsProcessing(true);
      setStatusMessage("AI가 사진 속 얼굴을 찾는 중...");
      const extracted = await extractRosterFromImage(file);
      const newFaces = [];
      let duplicateCount = 0;

      for (const p of extracted) {
        // Duplicate Detection: If name exists, skip it.
        const isDuplicate = existingPeople.some(ep => ep.name === p.name);
        if (isDuplicate && p.name) {
          duplicateCount++;
          continue;
        }

        const cropBlob = await cropFaceFromCoordinates(file, p.box_2d);
        if (cropBlob) {
          const cropUrl = URL.createObjectURL(cropBlob);
          newFaces.push({
            id: crypto.randomUUID(),
            name: p.name || '',
            department: 'General',
            jobGroup: p.job_group || '',
            career: p.career || '',
            notes: p.notes || '',
            gender: p.gender || 'U',
            tempBlob: cropBlob,
            tempUrl: cropUrl,
            isMatch: false
          });
        }
      }
      setFaces(newFaces);

      if (duplicateCount > 0) {
        alert(`${duplicateCount}명의 중복된 인원(이름 일치)이 제외되었습니다.`);
      } else if (newFaces.length === 0) {
        alert("얼굴을 찾지 못했습니다. 조금 더 선명한 사진을 사용해주세요.");
      }
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "알 수 없는 오류";
      alert(`이미지 분석 중 오류가 발생했습니다:\n${errorMessage}`);
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
    }
  };

  const processPdf = async (file: File) => {
    try {
      setIsProcessing(true);
      setStatusMessage("PDF를 이미지로 변환 중...");

      const images = await convertPdfToImages(file);
      if (images.length === 0) throw new Error("이미지 변환 실패");

      setStatusMessage("AI가 명단을 분석하고 얼굴을 자르는 중...");

      const allExtractedFaces = [];
      let duplicateCount = 0;

      // Process max 5 pages
      const pagesToProcess = images.slice(0, 5);

      for (const imgBlob of images) {
        const extracted = await extractRosterFromImage(imgBlob);

        for (const p of extracted) {
          // Duplicate Detection
          const isDuplicate = existingPeople.some(ep => ep.name === p.name);
          if (isDuplicate && p.name) {
            duplicateCount++;
            continue;
          }

          const cropBlob = await cropFaceFromCoordinates(imgBlob, p.box_2d);
          if (cropBlob) {
            const cropUrl = URL.createObjectURL(cropBlob);
            allExtractedFaces.push({
              id: crypto.randomUUID(),
              name: p.name,
              department: p.job_group || 'General',
              jobGroup: p.job_group || '',
              career: p.career || '',
              notes: p.notes || '',
              gender: p.gender || 'U',
              tempBlob: cropBlob,
              tempUrl: cropUrl,
              isMatch: false
            });
          }
        }
      }

      setFaces(prev => [...prev, ...allExtractedFaces]);
      setStatusMessage("");

      if (duplicateCount > 0) {
        alert(`${duplicateCount}명의 중복된 인원(이름 일치)이 제외되었습니다.`);
      }

      if (images.length > 0) {
        setImageSrc(URL.createObjectURL(images[0]));
      }

    } catch (e) {
      console.error(e);
      alert("PDF 처리 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
    }
  };

  const cropFaceFromCoordinates = async (sourceBlob: Blob, box_2d: [number, number, number, number]): Promise<Blob | null> => {
    // box_2d is [ymin, xmin, ymax, xmax] in 0-1000 scale
    return new Promise(async (resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(sourceBlob);
      await img.decode();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      const [ymin, xmin, ymax, xmax] = box_2d;

      // Convert 1000-scale to pixels
      const x = (xmin / 1000) * img.naturalWidth;
      const y = (ymin / 1000) * img.naturalHeight;
      const w = ((xmax - xmin) / 1000) * img.naturalWidth;
      const h = ((ymax - ymin) / 1000) * img.naturalHeight;

      // Add padding (20%)
      const padX = w * 0.2;
      const padY = h * 0.2;

      canvas.width = w + (padX * 2);
      canvas.height = h + (padY * 2);

      ctx.drawImage(
        img,
        Math.max(0, x - padX), Math.max(0, y - padY),
        Math.min(img.naturalWidth, w + padX * 2), Math.min(img.naturalHeight, h + padY * 2),
        0, 0,
        canvas.width, canvas.height
      );

      canvas.toBlob(resolve, 'image/jpeg');
    });
  };

  const handleManualCrop = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;

    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = imgRef.current.naturalWidth / rect.width;
    const scaleY = imgRef.current.naturalHeight / rect.height;

    const cropSize = 200;
    const actualX = (x * scaleX) - (cropSize / 2);
    const actualY = (y * scaleY) - (cropSize / 2);

    addFaceFromCrop(actualX, actualY, cropSize, cropSize);
  };

  const addFaceFromCrop = (x: number, y: number, w: number, h: number) => {
    if (!imgRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(imgRef.current, x, y, w, h, 0, 0, w, h);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const faceUrl = URL.createObjectURL(blob);

      const newPerson: Partial<Person> & { tempBlob: Blob, tempUrl: string } = {
        id: crypto.randomUUID(),
        name: '',
        department: 'IT',
        notes: '',
        tempBlob: blob,
        tempUrl: faceUrl
      };

      setFaces(prev => [...prev, newPerson]);
    }, 'image/jpeg');
  };

  const handleSave = async () => {
    setIsProcessing(true);
    setStatusMessage("데이터베이스 저장 중...");
    try {
      for (const face of faces) {
        if (!face.tempBlob) continue;

        const faceCropId = crypto.randomUUID();
        const faceCrop: FaceCrop = {
          id: faceCropId,
          blob: face.tempBlob,
          createdAt: Date.now()
        };
        await dbService.addFaceCrop(faceCrop);

        if (face.isMatch && face.id) {
          const existing = existingPeople.find(p => p.id === face.id);
          if (existing) {
            await dbService.updatePerson({
              ...existing,
              faceCropId: faceCropId,
              notes: face.notes || existing.notes,
              career: face.career || existing.career,
              jobGroup: face.jobGroup || existing.jobGroup,
              updatedAt: Date.now()
            });
          }
        } else {
          const person: Person = {
            id: face.id || crypto.randomUUID(),
            name: face.name || '이름 미정',
            department: face.department || 'General',
            jobGroup: face.jobGroup,
            career: face.career,
            notes: face.notes || '',
            gender: face.gender || 'U',
            faceCropId: faceCropId,
            interval: DEFAULT_INTERVAL,
            repetition: DEFAULT_REPETITION,
            efactor: DEFAULT_EFACTOR,
            dueDate: Date.now(),
            createdAt: Date.now()
          };
          await dbService.addPerson(person);
        }
      }
      onFinish();
    } catch (e) {
      console.error(e);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
    }
  };

  const handleExportHtml = async () => {
    if (existingPeople.length === 0) {
      alert("저장된 데이터가 없습니다.");
      return;
    }

    setIsProcessing(true);
    setStatusMessage("앱 다운로드 생성 중...");

    try {
      const htmlContent = await generateFullAppHtml();

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FaceMem_Quiz_App_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error(e);
      alert("HTML 내보내기 실패");
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
    }
  };

  return (
    <div className="p-4 pb-20 bg-white min-h-full">
      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col items-center justify-center text-white">
          <Icons.Brain className="animate-bounce mb-4" size={48} />
          <p className="font-bold">{statusMessage || "처리 중입니다..."}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">사진 추가</h2>
        <button onClick={handleExportHtml} className="text-xs bg-green-50 px-3 py-1 rounded-full text-green-700 border border-green-100 font-medium flex items-center gap-1">
          <Icons.Check size={12} /> 앱(HTML) 다운로드
        </button>
      </div>

      {!imageSrc ? (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
          <Icons.Camera size={48} className="mb-4" />
          <p className="mb-4 text-center text-sm">
            <span className="font-bold text-indigo-600">단체 사진(교육 등)</span>이나 <br />
            연명부(PDF)를 올려주세요.<br />
            AI가 자동으로 얼굴을 찾아 퀴즈를 생성합니다.
          </p>
          <label className="bg-indigo-600 text-white px-6 py-3 rounded-full font-bold cursor-pointer shadow-lg hover:bg-indigo-700 transition">
            사진/PDF 선택
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="relative rounded-xl overflow-hidden shadow-md bg-black">
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Upload"
              className="w-full h-auto opacity-90"
              onClick={handleManualCrop}
            />
            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
              미리보기
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-900">검출된 얼굴 ({faces.length})</h3>
              <button onClick={() => setFaces([])} className="text-xs text-red-500">전체 삭제</button>
            </div>

            {faces.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                자동으로 검출된 얼굴이 없습니다.<br />
                사진 속 얼굴을 직접 클릭해서 추가해주세요.
              </p>
            )}

            {faces.map((face, idx) => (
              <div key={idx} className="flex flex-col gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 animate-fadeIn">
                <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 border border-gray-200">
                    {/* @ts-ignore tempUrl exists */}
                    <img src={face.tempUrl} className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 space-y-2">
                    {/* Match Toggle */}
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          checked={!face.isMatch}
                          onChange={() => {
                            const newFaces = [...faces];
                            newFaces[idx].isMatch = false;
                            setFaces(newFaces);
                          }}
                        />
                        신규
                      </label>
                      <label className="text-xs flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          checked={!!face.isMatch}
                          onChange={() => {
                            const newFaces = [...faces];
                            newFaces[idx].isMatch = true;

                            // Auto-guess match based on name if extracted by AI
                            if (face.name) {
                              const match = existingPeople.find(p => p.name === face.name);
                              if (match) newFaces[idx].id = match.id;
                            }

                            setFaces(newFaces);
                          }}
                        />
                        기존 연결
                      </label>
                    </div>

                    {face.isMatch ? (
                      <select
                        className="w-full p-2 border rounded text-sm bg-white"
                        value={face.id || ''}
                        onChange={(e) => {
                          const newFaces = [...faces];
                          newFaces[idx].id = e.target.value;
                          newFaces[idx].name = existingPeople.find(p => p.id === e.target.value)?.name || '';
                          setFaces(newFaces);
                        }}
                      >
                        <option value="">-- 기존 인물 선택 --</option>
                        {existingPeople.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.department})</option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="이름"
                            className="w-1/2 p-2 border rounded text-sm"
                            value={face.name}
                            onChange={(e) => {
                              const newFaces = [...faces];
                              newFaces[idx].name = e.target.value;
                              setFaces(newFaces);
                            }}
                          />
                          <input
                            type="text"
                            placeholder="직군 (IT/Biz 등)"
                            className="w-1/2 p-2 border rounded text-sm bg-white"
                            value={face.jobGroup || face.department || ''}
                            onChange={(e) => {
                              const newFaces = [...faces];
                              newFaces[idx].jobGroup = e.target.value;
                              newFaces[idx].department = e.target.value;
                              setFaces(newFaces);
                            }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="성별(M/F)"
                            className="w-1/4 p-2 border rounded text-sm"
                            value={face.gender || ''}
                            onChange={(e) => {
                              const newFaces = [...faces];
                              // @ts-ignore
                              newFaces[idx].gender = e.target.value.toUpperCase();
                              setFaces(newFaces);
                            }}
                          />
                          <input
                            type="text"
                            placeholder="경력/회사"
                            className="w-3/4 p-2 border rounded text-sm"
                            value={face.career}
                            onChange={(e) => {
                              const newFaces = [...faces];
                              newFaces[idx].career = e.target.value;
                              setFaces(newFaces);
                            }}
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="특이사항 (전공, 학교 등)"
                          className="w-full p-2 border rounded text-sm"
                          value={face.notes}
                          onChange={(e) => {
                            const newFaces = [...faces];
                            newFaces[idx].notes = e.target.value;
                            setFaces(newFaces);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setFaces(faces.filter((_, i) => i !== idx))}
                  className="text-gray-400 text-xs self-end hover:text-red-500 underline"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setImageSrc(null)}
              className="flex-1 py-3 text-gray-600 font-medium"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={faces.length === 0 || isProcessing}
              className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-md disabled:opacity-50"
            >
              퀴즈 생성하기 (저장)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
import { GoogleGenAI, Type } from "@google/genai";

// NOTE: In a production app, never expose the key directly. 
// Since this is a demo/prototype requested to be functional client-side, 
// we assume process.env.API_KEY is available or user provides it.
const apiKey = process.env.API_KEY || ''; 

// Helper to encode blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

export const generateHint = async (personNotes: string, personDept: string): Promise<string> => {
  if (!apiKey) return "API 키가 설정되지 않았습니다.";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `나는 신입사원 이름과 얼굴을 외우고 있어. 이 사람에 대한 기억하기 쉬운, 약간 엉뚱하거나 재미있는 힌트를 줘. 
      이름은 절대 말하지 마. 20단어 이내로 한국어로 대답해줘.
      정보: 부서-${personDept}, 특징-${personNotes}.`,
    });
    return response.text || "힌트가 없어요.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "힌트를 생성할 수 없습니다.";
  }
};

export const analyzeRawText = async (rawText: string): Promise<string> => {
   if (!apiKey) return "";
   try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `OCR 텍스트에서 신입사원 정보를 추출해서 JSON으로 줘. keys: name, dept, notes. Raw text: ${rawText}`,
    });
    return response.text || "";
   } catch (e) {
     return "";
   }
};

export interface ExtractedPerson {
  name: string;
  job_group: string;
  career: string;
  notes: string;
  gender: 'M' | 'F' | 'U';
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000 scale
}

const callGeminiForExtraction = async (imageBlob: Blob): Promise<ExtractedPerson[]> => {
  if (!apiKey) throw new Error("API Key missing");
  
  const base64Data = await blobToBase64(imageBlob);
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          { text: `
            Analyze this image. It is either a formal roster (grid) OR a natural group photo.
            
            Task:
            1. Detect EVERY face in the image.
            2. Extract text associated with each person if available.
            
            CRITICAL INSTRUCTION FOR FACE DETECTION:
            - Provide the bounding box for the **FACE ONLY**.
            - Do not include the shoulders or torso.
            - The bounding box must be TIGHT around the head.
            - box_2d format is [ymin, xmin, ymax, xmax] in 0-1000 normalized coordinates.
            
            Extract fields (if text is available near the face):
            1. Name (성명)
            2. Job Group (직군 - e.g. IT, Biz)
            3. Career (경력/회사)
            4. Notes (특이사항, 전공, 학교, 비고)
            5. Gender (M or F) - Infer from face or name.

            Return the result as a JSON array.
            ` 
          }
        ]
      },
      config: {
        systemInstruction: "You are a high-precision computer vision AI. You excel at detecting faces in document grids and natural scenes.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              job_group: { type: Type.STRING, description: "직군 (IT, Biz, Eng etc)" },
              career: { type: Type.STRING, description: "Previous company or experience info" },
              notes: { type: Type.STRING },
              gender: { type: Type.STRING, enum: ["M", "F", "U"], description: "Male, Female, Unknown" },
              box_2d: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "Tight bounding box of the face [ymin, xmin, ymax, xmax] in 0-1000 scale."
              }
            },
            required: ["box_2d"]
          }
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text) as ExtractedPerson[];
      return result.filter(p => 
        p.box_2d && 
        p.box_2d.length === 4 && 
        p.box_2d.every(n => typeof n === 'number')
      );
    }
    return [];
  } catch (e) {
    console.error("Extraction Failed", e);
    return [];
  }
};

export const extractRosterFromImage = async (imageBlob: Blob): Promise<ExtractedPerson[]> => {
  // 1. Check Image Size
  const url = URL.createObjectURL(imageBlob);
  let img: HTMLImageElement;
  try {
     img = await loadImage(url);
  } catch(e) {
     URL.revokeObjectURL(url);
     throw new Error("Failed to load image");
  }

  const { naturalWidth, naturalHeight } = img;
  
  // Strategy: If image is too tall (> 2000px), slice it. 
  // Gemini 2.0 Flash is capable, but detail loss on downscaling can affect small faces in large grids.
  const MAX_SINGLE_HEIGHT = 2000;
  
  if (naturalHeight <= MAX_SINGLE_HEIGHT) {
      URL.revokeObjectURL(url);
      return callGeminiForExtraction(imageBlob);
  }

  // 2. Slicing Logic
  // Slice into chunks of ~1500px with 500px overlap
  const CHUNK_HEIGHT = 1500;
  const OVERLAP = 500;
  
  const chunks: { blob: Blob, yOffset: number, height: number }[] = [];
  let y = 0;
  
  const canvas = document.createElement('canvas');
  canvas.width = naturalWidth;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
      URL.revokeObjectURL(url);
      return callGeminiForExtraction(imageBlob); // Fallback
  }

  while (y < naturalHeight) {
      let h = CHUNK_HEIGHT;
      // If remaining is small, just take it
      if (naturalHeight - y < CHUNK_HEIGHT * 1.2) {
          h = naturalHeight - y;
      }
      
      canvas.height = h;
      ctx.clearRect(0, 0, naturalWidth, h);
      ctx.drawImage(img, 0, y, naturalWidth, h, 0, 0, naturalWidth, h);
      
      const chunkBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (chunkBlob) {
          chunks.push({ blob: chunkBlob, yOffset: y, height: h });
      }
      
      if (y + h >= naturalHeight) break;
      y += (h - OVERLAP);
  }
  
  URL.revokeObjectURL(url);

  // 3. Parallel Processing
  const chunkResults = await Promise.all(
      chunks.map(async (chunk) => {
          const results = await callGeminiForExtraction(chunk.blob);
          
          // Map coordinates back to Global Space
          return results.map(p => {
              const [ymin, xmin, ymax, xmax] = p.box_2d;
              
              // 1. Chunk 0-1000 -> Chunk Pixels
              const chunkPxYmin = (ymin / 1000) * chunk.height;
              const chunkPxYmax = (ymax / 1000) * chunk.height;
              
              // 2. Chunk Pixels -> Global Pixels
              const globalPxYmin = chunkPxYmin + chunk.yOffset;
              const globalPxYmax = chunkPxYmax + chunk.yOffset;
              
              // 3. Global Pixels -> Global 0-1000
              const globalNormYmin = Math.round((globalPxYmin / naturalHeight) * 1000);
              const globalNormYmax = Math.round((globalPxYmax / naturalHeight) * 1000);
              
              return {
                  ...p,
                  box_2d: [globalNormYmin, xmin, globalNormYmax, xmax] as [number, number, number, number]
              };
          });
      })
  );

  const allPeople = chunkResults.flat();

  // 4. Deduplicate (Non-Maximum Suppression-ish)
  // Merge duplicates found in overlapping regions
  const uniquePeople: ExtractedPerson[] = [];
  
  for (const p of allPeople) {
      const [y1, x1, y2, x2] = p.box_2d;
      const cy = (y1 + y2) / 2;
      const cx = (x1 + x2) / 2;
      
      const duplicate = uniquePeople.find(existing => {
          const [ey1, ex1, ey2, ex2] = existing.box_2d;
          const ecy = (ey1 + ey2) / 2;
          const ecx = (ex1 + ex2) / 2;
          
          // Distance threshold: 20 units (2% of image height)
          // X units match exactly (same width), Y units normalized
          const dist = Math.sqrt(Math.pow(ecy - cy, 2) + Math.pow(ecx - cx, 2));
          return dist < 20;
      });
      
      if (!duplicate) {
          uniquePeople.push(p);
      } else {
          // If the new one has more info, update the existing one
          if (!duplicate.name && p.name) duplicate.name = p.name;
          if (!duplicate.notes && p.notes) duplicate.notes = p.notes;
          if (!duplicate.job_group && p.job_group) duplicate.job_group = p.job_group;
      }
  }

  return uniquePeople;
};
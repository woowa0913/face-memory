import * as pdfjsLib from 'pdfjs-dist';

// Set worker source to the same version as the library
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

export const convertPdfToImages = async (file: File): Promise<Blob[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: Blob[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    // Increase scale to 3.0 for better face detail extraction
    const viewport = page.getViewport({ scale: 3.0 }); 
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // High quality JPEG
      const blob = await new Promise<Blob | null>(resolve => 
        canvas.toBlob(resolve, 'image/jpeg', 0.95)
      );
      
      if (blob) {
        images.push(blob);
      }
    }
  }
  return images;
};
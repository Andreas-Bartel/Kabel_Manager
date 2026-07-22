/**
 * Komprimiert ein hochgeladenes Bild clientseitig über das HTML5 Canvas API.
 * Skaliert das Bild auf maximal 800px Breite/Höhe und exportiert es als komprimiertes JPEG (Base64).
 */
export function compressImage(file: File, maxDimension = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Berechne neue Dimensionen unter Beibehaltung des Seitenverhältnisses
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Canvas context konnte nicht erstellt werden."));
          return;
        }
        
        // Zeichne und komprimiere das Bild
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      
      img.onerror = (err) => {
        reject(err);
      };
    };
    
    reader.onerror = (err) => {
      reject(err);
    };
  });
}

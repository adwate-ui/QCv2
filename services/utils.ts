export const generateUUID = (): string => {
  // Use crypto.randomUUID if available (Secure Contexts)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for non-secure contexts (e.g., HTTP IP address)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const parseObservations = (text?: string): string[] => {
  if (!text) return [];
  // Normalize Windows CRLF
  const normalized = text.replace(/\r/g, '\n');

  // If text already contains newline-separated bullets/lines, split by line
  if (/\n/.test(normalized)) {
    return normalized
      .split(/\n+/)
      .map(l => l.replace(/^\s*[-–•\d\)\.]+\s*/, '').trim())
      .filter(Boolean);
  }

  // Otherwise try to split numbered lists like '1) ... 2) ...'
  const numbered = normalized.split(/\d+\)\s+/).map(s => s.trim()).filter(Boolean);
  if (numbered.length > 1) return numbered;

  // Fallback: split on sentence-ending punctuation but keep abbreviations (naive)
  const sentences = normalized.split(/(?<=[\]\.\?\!])\s+(?=[A-Z0-9])/)
    .map(s => s.trim())
    .filter(Boolean);
  return sentences;
};

/**
 * Fetches an image from a URL and converts it to a Base64 string.
 * This is necessary because Gemini API's inlineData expects raw Base64 image data, not a URL.
 * @param url The URL of the image to fetch.
 * @returns A Promise that resolves to the Base64 string of the image, or rejects if fetching fails.
 */
export const fetchAndEncodeImage = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from ${url}: ${response.statusText}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]); // Extract Base64 part
        } else {
          reject(new Error("Failed to read image as Data URL."));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error fetching and encoding image:", error);
    throw error;
  }
};
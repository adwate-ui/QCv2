
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
  const sentences = normalized.split(/(?<=[\.\?\!])\s+(?=[A-Z0-9])/)
    .map(s => s.trim())
    .filter(Boolean);
  return sentences;
};

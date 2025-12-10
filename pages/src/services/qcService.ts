import { GoogleGenAI } from "@google/genai";
import { QCAnalysisResult, BoundingBox, Discrepancy } from "../types";
import { fetchAndEncodeImage } from "./utils";

interface FeatureIdentificationResult {
  isDetail: boolean;
  featureKeyword: string;
}

interface DefectDetectionResult {
  score: number;
  summary: string;
  discrepancies: Array<{
    description: string;
    boundingBox: number[];
  }>;
}

/**
 * Identifies whether the QC image is a full product photo or a specific detail.
 * @param apiKey The Gemini API key.
 * @param qcImageUrl The URL of the QC image to analyze.
 * @returns A Promise that resolves to the feature identification result.
 */
const identifyFeature = async (apiKey: string, qcImageUrl: string): Promise<FeatureIdentificationResult> => {
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-2.5-flash';

  const imageData = await fetchAndEncodeImage(qcImageUrl);

  const parts = [
    { 
      text: 'Is this a photo of the full product or a specific detail (like a clasp, logo, zipper)? Return JSON: { isDetail: boolean, featureKeyword: string }. The featureKeyword should describe the specific feature shown (e.g., "clasp", "logo", "zipper", "stitching") or "full product" if it shows the entire item.'
    },
    {
      inlineData: { mimeType: 'image/jpeg', data: imageData }
    }
  ];

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      responseMimeType: "application/json"
    }
  });

  const responseText = response.text || '{}';
  
  try {
    const result: FeatureIdentificationResult = JSON.parse(responseText);
    return result;
  } catch (error) {
    console.error('Failed to parse feature identification response:', error);
    throw new Error('Invalid response format from Gemini API');
  }
};

/**
 * Checks if the main reference URL clearly shows a specific feature.
 * @param apiKey The Gemini API key.
 * @param mainReferenceUrl The URL of the main reference image.
 * @param featureKeyword The keyword describing the feature to look for.
 * @returns A Promise that resolves to true if the feature is visible, false otherwise.
 */
const checkFeatureInReference = async (
  apiKey: string,
  mainReferenceUrl: string, 
  featureKeyword: string
): Promise<boolean> => {
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-2.5-flash';

  const imageData = await fetchAndEncodeImage(mainReferenceUrl);

  const parts = [
    { 
      text: `Does this image clearly show the ${featureKeyword}? Return JSON: { isVisible: boolean, confidence: string }. The confidence should be "high", "medium", or "low".`
    },
    {
      inlineData: { mimeType: 'image/jpeg', data: imageData }
    }
  ];

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      responseMimeType: "application/json"
    }
  });

  const responseText = response.text || '{}';
  
  try {
    const result: { isVisible: boolean; confidence: string } = JSON.parse(responseText);
    // Consider the feature missing if it's not visible or confidence is low
    return result.isVisible && result.confidence !== 'low';
  } catch (error) {
    console.error('Failed to parse feature check response:', error);
    // Assume feature is not visible on parse error
    return false;
  }
};

/**
 * Searches for and downloads a new reference image using the Cloudflare worker.
 * @param productName The name of the product.
 * @param featureKeyword The keyword describing the feature.
 * @returns A Promise that resolves to the URL of the new reference image.
 */
const searchAndDownloadReference = async (
  productName: string,
  featureKeyword: string
): Promise<string> => {
  // Construct search query
  const query = `${productName} ${featureKeyword} official close up`;
  
  // Note: This is a placeholder. In production, you would:
  // 1. Call the Cloudflare worker's /search-image endpoint
  // 2. The worker would use Google Custom Search API or similar
  // 3. Download and return the best matching image
  
  // For now, we'll return the original mainReferenceUrl as fallback
  // since the search-image endpoint is not fully implemented
  console.warn(`Image search for "${query}" not fully implemented. Using original reference.`);
  
  // Placeholder implementation - would call:
  // const workerUrl = `https://your-worker.workers.dev/search-image?query=${encodeURIComponent(query)}`;
  // const response = await fetch(workerUrl);
  // const data = await response.json();
  // return data.imageUrl;
  
  throw new Error('Image search API not yet configured. Please implement /search-image endpoint.');
};

/**
 * Performs defect detection by comparing the comparison URL and QC image.
 * @param apiKey The Gemini API key.
 * @param comparisonUrl The URL of the reference image to compare against.
 * @param qcImageUrl The URL of the QC image to analyze.
 * @returns A Promise that resolves to the defect detection result.
 */
const detectDefects = async (
  apiKey: string,
  comparisonUrl: string,
  qcImageUrl: string
): Promise<QCAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-2.5-flash';

  const [referenceData, qcData] = await Promise.all([
    fetchAndEncodeImage(comparisonUrl),
    fetchAndEncodeImage(qcImageUrl)
  ]);

  const parts = [
    { text: 'REFERENCE IMAGE (First image):' },
    { inlineData: { mimeType: 'image/jpeg', data: referenceData } },
    { text: 'QC PHOTO TO ANALYZE (Second image):' },
    { inlineData: { mimeType: 'image/jpeg', data: qcData } },
    { 
      text: `Compare these two images. The first is the Reference, the second is the QC photo. Identify any defects (scratches, wrong colors, misalignment). 

Return a JSON object with:
- score (0-100): Overall quality score where 100 is perfect match, 0 is completely different
- summary (string): Brief summary of findings
- discrepancies (array): List of issues found, each with:
  - description (string): What the defect is
  - boundingBox (array of 4 numbers [ymin, xmin, ymax, xmax]): Location on a 0-1000 scale that outlines the defect on the QC image

Example format:
{
  "score": 85,
  "summary": "Minor scratches detected on the surface",
  "discrepancies": [
    {
      "description": "Scratch on upper left corner",
      "boundingBox": [100, 150, 200, 250]
    }
  ]
}

If no defects are found, return an empty discrepancies array and a high score.`
    }
  ];

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      responseMimeType: "application/json"
    }
  });

  const responseText = response.text || '{}';
  
  try {
    const rawResult: DefectDetectionResult = JSON.parse(responseText);
    
    // Convert the raw result to QCAnalysisResult format
    const discrepancies: Discrepancy[] = (rawResult.discrepancies || []).map(d => ({
      description: d.description,
      boundingBox: {
        ymin: d.boundingBox[0],
        xmin: d.boundingBox[1],
        ymax: d.boundingBox[2],
        xmax: d.boundingBox[3]
      }
    }));

    return {
      qualityScore: rawResult.score || 0,
      summary: rawResult.summary || 'Failed to analyze images',
      discrepancies
    };
  } catch (error) {
    console.error('Failed to parse defect detection response:', error);
    throw new Error('Invalid response format from Gemini API');
  }
};

/**
 * Main function that performs smart QC analysis with feature identification and reference checking.
 * @param apiKey The Gemini API key.
 * @param productName The name of the product being inspected.
 * @param mainReferenceUrl The URL of the main reference image.
 * @param qcImageUrl The URL of the QC image to analyze.
 * @returns A Promise that resolves to the QC analysis result.
 */
export async function performSmartQC(
  apiKey: string,
  productName: string,
  mainReferenceUrl: string,
  qcImageUrl: string
): Promise<QCAnalysisResult> {
  try {
    // Step 1: Feature Identification
    console.log('Step 1: Identifying feature type...');
    const featureInfo = await identifyFeature(apiKey, qcImageUrl);
    console.log('Feature identification result:', featureInfo);

    // Step 2: Reference Check
    console.log('Step 2: Checking reference image...');
    let comparisonUrl = mainReferenceUrl;

    if (featureInfo.isDetail) {
      console.log(`Detected detail image: ${featureInfo.featureKeyword}`);
      
      // Check if the main reference shows this feature
      const featureVisible = await checkFeatureInReference(
        apiKey,
        mainReferenceUrl, 
        featureInfo.featureKeyword
      );

      if (!featureVisible) {
        console.log('Feature not clearly visible in main reference, searching for better reference...');
        
        try {
          // Attempt to find a better reference image
          comparisonUrl = await searchAndDownloadReference(
            productName,
            featureInfo.featureKeyword
          );
          console.log('Found new reference image:', comparisonUrl);
        } catch (error) {
          console.warn('Could not find better reference, using original:', error);
          // Fall back to main reference if search fails
          comparisonUrl = mainReferenceUrl;
        }
      } else {
        console.log('Feature is visible in main reference, proceeding with original reference.');
      }
    } else {
      console.log('Full product image detected, using main reference.');
    }

    // Step 3: Defect Detection
    console.log('Step 3: Performing defect detection...');
    const result = await detectDefects(apiKey, comparisonUrl, qcImageUrl);
    console.log('Defect detection complete. Score:', result.qualityScore);

    return result;
  } catch (error) {
    console.error('Error in performSmartQC:', error);
    throw error;
  }
}

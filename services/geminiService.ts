import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AppSettings, ExpertMode, ModelTier, ProductProfile, QCReport } from "../types";
import { generateUUID } from "./utils";

// Helper to clean JSON string if md block is present
const cleanJson = (text: string) => {
  // Catch ```json ... ``` with potential spaces/newlines
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (match) return match[1];
  
  // Also catch generic code blocks if model forgot 'json' tag
  const matchGeneric = text.match(/```\s*([\s\S]*?)\s*```/);
  if (matchGeneric) return matchGeneric[1];

  // Return raw text if no blocks found (model might have output raw JSON)
  return text;
};

const getModelConfig = (tier: ModelTier) => {
  // User requested:
  // Fast: Gemini 2.5 Flash
  // Detailed: Gemini 3.0 Pro
  if (tier === ModelTier.DETAILED) {
    return {
      model: 'gemini-3-pro-preview',
    };
  }
  return {
    model: 'gemini-2.5-flash',
  };
};

const getSystemInstruction = (mode: ExpertMode, tier: ModelTier, task: 'ID' | 'QC'): string => {
  if (task === 'ID') {
    const expertNuance = mode === ExpertMode.EXPERT 
      ? "You identify products with forensic precision, noticing specific model years, reference numbers, and manufacturing origins."
      : "You identify products clearly and accurately.";

    return `You are the world's leading expert on luxury goods, consumer electronics, and rare collectibles. ${expertNuance} 
    
    CRITICAL INSTRUCTION: Your goal is to build a Master Profile for the **AUTHENTIC** version of the product shown. 
    - Always identify the specific luxury or established brand associated with the design (e.g., if it looks like a Rolex Submariner, identify it as a Rolex Submariner).
    - **NEVER** identify a product as "Generic", "Replica", "Knock-off", or "Unbranded" if the design is associated with a known brand.
    - Assume the user wants the specifications for the **genuine** article to use as a reference standard.
    - ALWAYS return a valid JSON object. If you are unsure of a field, provide your BEST EXPERT GUESS based on visual analysis. Do not return nulls or "Unknown".`;
  } else {
    // QC Task
    // Logic: 
    // Flash 2.5 (Fast) -> Layperson Persona (Normal) or Expert (Expert)
    // Pro 3.0 (Detailed) -> World Leading Brand Expert (Normal or Expert)
    
    if (tier === ModelTier.DETAILED) {
        // PRO 3.0 - The World Leading Expert
        return `You are the Chief Authenticator for the world's most prestigious luxury authentication house.
        - You are inspecting this item as a World Leading Brand Expert.
        - Your analysis must be exhaustive, covering minute details of craftsmanship, material quality, and brand-specific markers.
        - Structure your report with bullet points for clarity.
        - SCORING RULES:
          * Score > 80: PASS (Authentic / High Quality)
          * Score 61 - 80: CAUTION (Suspicious / Minor Defects)
          * Score <= 60: FAIL (Replica / Major Defects)
        
        ${mode === ExpertMode.EXPERT ? 
          "PERSONA: UNFORGIVING FORENSIC EXPERT. You are looking for microscopic flaws. You assume it is fake until proven real. Take 45-60 seconds to analyze." : 
          "PERSONA: SENIOR BRAND EXPERT. You are thorough and professional. Take 45 seconds to analyze."
        }`;
    } else {
        // FLASH 2.5
        return `You are a Quality Control Inspector.
        - You are inspecting this item as a ${mode === ExpertMode.EXPERT ? "Strict QC Specialist" : "Knowledgeable Layperson"}.
        - Structure your report with clear bullet points.
        - SCORING RULES:
          * Score > 80: PASS
          * Score 61 - 80: CAUTION
          * Score <= 60: FAIL
        
        ${mode === ExpertMode.EXPERT ? 
           "PERSONA: EXPERT. You are critical of small details. Be strict." : 
           "PERSONA: NORMAL. You are looking for obvious defects and general quality issues."
        }`;
    }
  }
};

export const identifyProduct = async (
  apiKey: string,
  imageDatas: string[], // base64 strings
  inputUrl: string | undefined,
  settings: AppSettings
): Promise<ProductProfile> => {
  const ai = new GoogleGenAI({ apiKey });
  const { model } = getModelConfig(settings.modelTier);

  const parts: any[] = imageDatas.map(data => ({
    inlineData: { mimeType: 'image/jpeg', data: data.split(',')[1] || data }
  }));

  let prompt = `Identify the **AUTHENTIC** product profile corresponding to this input. 
  Even if the image appears to be a replica or is low quality, provide the details (Brand, Specific Model, Specs) for the **GENUINE AUTHENTIC** article it represents.\n\n`;

  // Tier-specific prompting
  if (settings.modelTier === ModelTier.DETAILED) {
    prompt += `**INSTRUCTION (DETAILED MODE):**
    - Provide a **comprehensive, deeply researched** analysis.
    - **Name**: Include full model name, reference number if applicable.
    - **Material**: Detail specific alloys, fabrics, or leather grades.
    - **Features**: List extensive technical features.
    - **Price**: Provide a precise current market range.
    `;
  } else {
    prompt += `**INSTRUCTION (FAST MODE):**
    - Provide a **concise, direct** identification.
    - **Name**: Best guess for standard commercial name.
    - **Brand**: Best guess for the brand based on visual cues.
    - **Price**: Best guess estimated price range.
    - **IMPORTANT**: Provide your **BEST EXPERT GUESS** for all fields. Do not leave fields empty.
    `;
  }
  
  prompt += `\nRequired Fields: Brand, Name, Category, Price Estimate, Material, Features, Description.`;
  
  const tools: any[] = [];
  
  if (inputUrl) {
    prompt += `\n\nContext provided by user (Product URL): ${inputUrl}`;
    prompt += `\n\nOUTPUT: Return strictly a valid JSON object matching the requested fields.`;
  } else {
    // Enable Grounding
    tools.push({ googleSearch: {} });
    prompt += `\n\nUse Google Search to find the official product page. 
    Set the 'url' field in the JSON response to this specific direct link.
    OUTPUT: Return strictly a valid JSON object matching the requested fields inside a \`\`\`json code block.`;
  }

  parts.push({ text: prompt });

  const config: any = {
    systemInstruction: getSystemInstruction(settings.expertMode, settings.modelTier, 'ID'),
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ]
  };

  if (!inputUrl) {
    config.tools = tools;
  } else {
    config.responseMimeType = "application/json";
    config.responseSchema = {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        brand: { type: Type.STRING },
        category: { type: Type.STRING },
        priceEstimate: { type: Type.STRING },
        material: { type: Type.STRING },
        features: { type: Type.ARRAY, items: { type: Type.STRING } },
        description: { type: Type.STRING },
        url: { type: Type.STRING },
      },
      required: ['name', 'brand', 'category', 'features']
    };
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config
  });

  const text = response.text || "{}";
  try {
    const raw = JSON.parse(cleanJson(text));
    return {
      name: raw.name || "Unknown Product",
      brand: raw.brand || "Unknown Brand",
      category: raw.category || "Uncategorized",
      priceEstimate: raw.priceEstimate || "N/A",
      material: raw.material || "N/A",
      features: Array.isArray(raw.features) ? raw.features : ["Identified from visual analysis"],
      description: raw.description || "No description available",
      url: raw.url || inputUrl
    };
  } catch (e) {
    console.error("Failed to parse JSON", text);
    // Fallback object to prevent UI crash
    return {
        name: "Identification Failed",
        brand: "Unknown",
        category: "Review Needed",
        priceEstimate: "N/A",
        material: "N/A",
        features: ["Could not parse model response"],
        description: "Please retry identification.",
        url: inputUrl
    };
  }
};

export const runQCAnalysis = async (
  apiKey: string,
  profile: ProductProfile,
  refImages: string[],
  qcImages: string[],
  settings: AppSettings
): Promise<QCReport> => {
  const ai = new GoogleGenAI({ apiKey });
  const { model } = getModelConfig(settings.modelTier);

  const parts: any[] = [];

  // Add Ref Images
  refImages.forEach((img, idx) => {
    parts.push({ 
      text: `REFERENCE IMAGE ${idx + 1} (Authentic):`
    });
    parts.push({
      inlineData: { mimeType: 'image/jpeg', data: img.split(',')[1] || img }
    });
  });

  // Add Product Context
  parts.push({
    text: `AUTHENTIC PRODUCT PROFILE:\n${JSON.stringify(profile, null, 2)}\n\n`
  });

  // Add QC Images
  qcImages.forEach((img, idx) => {
    parts.push({ 
      text: `QC INSPECTION IMAGE ${idx + 1} (To be analyzed):`
    });
    parts.push({
      inlineData: { mimeType: 'image/jpeg', data: img.split(',')[1] || img }
    });
  });

  parts.push({
    text: `Perform a QC inspection comparing the CUMULATIVE SET of QC INSPECTION IMAGES (collected over multiple batches) against the REFERENCE IMAGES and PROFILE.
    
    SCORING RUBRIC:
    - PASS: > 80 (Good condition, authentic, no major defects)
    - CAUTION: 61 - 80 (Suspicious, minor defects, or inconclusive)
    - FAIL: <= 60 (Definite replica, damaged, or major defects)
    
    Output requirements:
    - Break down analysis by sections (Packaging, Materials, Hardware, Stitching, etc.)
    - Use bullet points in observations.
    - Provide a specific score (0-100) and grade for each section and Overall.`
  });

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      overallScore: { type: Type.NUMBER },
      overallGrade: { type: Type.STRING, enum: ["PASS", "FAIL", "CAUTION"] },
      summary: { type: Type.STRING },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sectionName: { type: Type.STRING },
            score: { type: Type.NUMBER },
            grade: { type: Type.STRING, enum: ["PASS", "FAIL", "CAUTION"] },
            observations: { type: Type.STRING }
          }
        }
      }
    }
  };

  // Configure thinking budget for Flash 2.5
  let thinkingConfig;
  if (settings.modelTier === ModelTier.FAST) {
    // Flash 2.5 supports Thinking
    // To match 30s (Normal) -> ~12k tokens
    // To match 40s (Expert) -> ~16k tokens
    thinkingConfig = {
      thinkingBudget: settings.expertMode === ExpertMode.EXPERT ? 16384 : 12288
    };
  }
  // Pro 3.0 relies on prompt complexity and model size for duration (45-60s)

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      systemInstruction: getSystemInstruction(settings.expertMode, settings.modelTier, 'QC'),
      responseMimeType: "application/json",
      responseSchema: schema,
      thinkingConfig,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    }
  });

  const result = JSON.parse(cleanJson(response.text || "{}"));
  
  return {
    id: generateUUID(),
    generatedAt: Date.now(),
    basedOnBatchIds: [], // To be filled by caller
    modelTier: settings.modelTier,
    expertMode: settings.expertMode,
    ...result
  };
};
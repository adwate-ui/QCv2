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
    return `You are the world's leading expert on luxury goods, consumer electronics, and rare collectibles. You identify products with forensic precision, noticing specific model years, reference numbers, and manufacturing origins.
    
    CRITICAL INSTRUCTION: Your goal is to build a Master Profile for the **AUTHENTIC** version of the product shown. 
    - Always identify the specific luxury or established brand associated with the design (e.g., if it looks like a Rolex Submariner, identify it as a Rolex Submariner).
    - **NEVER** identify a product as "Generic", "Replica", "Knock-off", or "Unbranded" if the design is associated with a known brand.
    - Assume the user wants the specifications for the **genuine** article to use as a reference standard.
    - If a URL is provided by the user, use it as the product's URL. If only images are provided, identify the product and then perform a web search to find the most likely official product page URL and include it in the response.
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
          "PERSONA: UNFORGIVING FORENSIC EXPERT. You are looking for microscopic flaws. You assume it is fake until proven real. Use web searches to find official product specifications, known manufacturing flaws, and common tells for replicas to inform your analysis. Take 45-60 seconds to analyze." : 
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

// Core identification logic, now separated for clarity and fallback purposes.
const _performIdentification = async (
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
    prompt += `**INSTRUCTION (PRO 3.0 MODE):**
    - Provide a **comprehensive, deeply researched** analysis. This should take approximately 45-60 seconds.
    - **Name**: Include full model name, reference number if applicable.
    - **Material**: Detail specific alloys, fabrics, or leather grades.
    - **Features**: List extensive technical features.
    - **Price**: Provide a precise current market range.
    `;
  } else {
    prompt += `**INSTRUCTION (FLASH 2.5 MODE):**
    - Provide a **concise, direct** identification. This should take approximately 30 seconds.
    - **Name**: Provide brand and model name.
    - **Material**: Identify primary material.
    - **Features**: List 2-3 key features.
    - **Price**: Provide an estimated MSRP or market price.
    `;
  }
  
  if (inputUrl) {
    prompt += `\n**Reference URL (use for context if helpful):** ${inputUrl}\n`;
  }

  prompt += `\nCRITICAL: Your final output must be a single, valid, raw JSON object that strictly conforms to the ProductProfile schema. Do not include any extra text, conversational pleasantries, or markdown formatting like \`\`\`json. Just the JSON object.`;
  
  parts.unshift({ text: prompt });

  const schema: Schema = {
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
      imageUrls: { type: Type.ARRAY, items: { type: Type.STRING } },
      qcUserComments: { type: Type.STRING }
    },
    required: ["name", "brand", "category", "priceEstimate", "material", "features", "description"]
  };
  
  // Configure thinking budget for Flash 2.5
  let thinkingConfig;
  if (settings.modelTier === ModelTier.FAST) {
    thinkingConfig = {
      thinkingBudget: 12288
    };
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      systemInstruction: getSystemInstruction(settings.expertMode, settings.modelTier, 'ID'),
      responseMimeType: "application/json",
      responseSchema: schema,
      thinkingConfig,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        }
      ]
    }
  });

  const responseText = response.text || "{}";
  
  // The API now directly returns JSON, so we can parse it.
  const profile: ProductProfile = JSON.parse(responseText);

  // Add URL to profile if it was provided
  // If model provided a URL, prefer it; otherwise attach inputUrl when present
  if ((profile as any).url) {
    profile.url = (profile as any).url;
  } else if (inputUrl) {
    profile.url = inputUrl;
  }

  // If model returned imageUrls, attach them (frontend can fetch thumbnails)
  if ((profile as any).imageUrls && Array.isArray((profile as any).imageUrls)) {
    (profile as any).imageUrls = (profile as any).imageUrls;
  }

  return profile;
};

// Main exported function with fallback logic
export const identifyProduct = async (
  apiKey: string,
  imageDatas: string[], // base64 strings
  inputUrl: string | undefined,
  settings: AppSettings
): Promise<ProductProfile> => {
  try {
    // First attempt with the original settings
    return await _performIdentification(apiKey, imageDatas, inputUrl, settings);
  } catch (error) {
    console.error("Initial identification failed:", error);

    // If the first attempt with the DETAILED model failed, try again with the FAST model.
    if (settings.modelTier === ModelTier.DETAILED) {
      console.warn("Detailed model failed. Attempting fallback with Fast model...");
      try {
        const fallbackSettings: AppSettings = { ...settings, modelTier: ModelTier.FAST };
        return await _performIdentification(apiKey, imageDatas, inputUrl, fallbackSettings);
      } catch (fallbackError) {
        console.error("Fallback identification also failed:", fallbackError);
        // If the fallback also fails, return the standard error object.
      }
    }

    // Return a standard error object if initial attempt failed (for FAST) or fallback failed (for DETAILED)
    return {
      name: "Identification Failed",
      brand: "Unknown",
      category: "Unknown",
      priceEstimate: "N/A",
      material: "N/A",
      features: ["Error during processing."],
      description: "Could not identify the product. The model may be unavailable or the request may have timed out. Please try again later.",
      url: inputUrl,
    };
  }
};

export const runQCAnalysis = async (
  apiKey: string,
  profile: ProductProfile,
  refImages: string[],
  qcImages: string[],
  qcImageIds: string[], // <-- ADD THIS
  settings: AppSettings,
  qcUserComments: string
): Promise<QCReport> => {
  try {
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

    // Add user comments if provided
    if (qcUserComments) {
      parts.push({
        text: `\n**USER COMMENTS TO CONSIDER:**\n${qcUserComments}\n`
      });
    }

    parts.push({
      text: `Perform a QC inspection comparing the CUMULATIVE SET of QC INSPECTION IMAGES (collected over multiple batches) against the REFERENCE IMAGES and PROFILE.
    
    SCORING RUBRIC:
    - PASS: > 80 (Good condition, authentic, no major defects)
    - CAUTION: 61 - 80 (Suspicious, minor defects, or inconclusive)
    - FAIL: <= 60 (Definite replica, damaged, or major defects)
    
    Output requirements:
    - Break down analysis by sections (e.g., for a bag: Packaging, Exterior Leather, Interior Lining, Hardware & Zippers, Stitching, Straps & Handles, Logos & Brand Stamps, Dust Bag, Authenticity Card).
    - Use bullet points in observations.
    - Provide a specific score on a scale of 0-100 and a grade for each section and for the overall assessment.
    - ALWAYS return your response as a valid, raw JSON object conforming to the QCReport schema. Do NOT wrap it in markdown backticks.`
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
              observations: { type: Type.ARRAY, items: { type: Type.STRING } }
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

    const config: any = {
        systemInstruction: getSystemInstruction(settings.expertMode, settings.modelTier, 'QC'),
        responseMimeType: "application/json",
        responseSchema: schema,
        thinkingConfig,
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
    };

    // CRITICAL FIX: The API does not support tools and response_mime_type together.
    // Since we require JSON output, we must conditionally omit tools for now.
    // if (settings.expertMode === ExpertMode.EXPERT) {
    //   config.tools = [{ googleSearch: {} }];
    // }

    let result: any = {};

    // Two-step Expert flow: allow web-search/tools in a first pass (unstructured),
    // then synthesize a structured JSON report in a second pass without tools.
    if (settings.expertMode === ExpertMode.EXPERT && settings.modelTier === ModelTier.DETAILED) {
      // First pass: allow tools (web search) but do not request JSON schema
      const firstConfig: any = {
        systemInstruction: getSystemInstruction(settings.expertMode, settings.modelTier, 'QC'),
        thinkingConfig,
        safetySettings: config.safetySettings,
        tools: [{ googleSearch: {} }]
      };

      const firstResp = await ai.models.generateContent({ model, contents: { parts }, config: firstConfig });
      const firstText = firstResp.text || "";

      // Second pass: request structured JSON using the prior analysis as context
      const partsForJson = [...parts, { text: `SYNTHESIZE THE ANALYSIS ABOVE INTO A VALID JSON REPORT MATCHING THE SCHEMA. Use the previous analysis results and web search findings to populate fields. Respond ONLY with valid JSON.` }, { text: firstText }];

      const secondConfig: any = {
        systemInstruction: getSystemInstruction(settings.expertMode, settings.modelTier, 'QC'),
        responseMimeType: "application/json",
        responseSchema: schema,
        thinkingConfig,
        safetySettings: config.safetySettings,
      };

      const secondResp = await ai.models.generateContent({ model, contents: { parts: partsForJson }, config: secondConfig });
      result = JSON.parse(cleanJson(secondResp.text || "{}"));
    } else {
      const response = await ai.models.generateContent({ model, contents: { parts }, config });
      result = JSON.parse(cleanJson(response.text || "{}"));
    }
    
    return {
      id: generateUUID(),
      generatedAt: Date.now(),
      basedOnBatchIds: [],
      qcImageIds: qcImageIds, // <-- ADD THIS
      modelTier: settings.modelTier,
      expertMode: settings.expertMode,
      ...result
    };
  } catch (error) {
    if (settings.modelTier === ModelTier.DETAILED) {
      console.warn("Detailed QC failed. Attempting fallback with Fast model...");
      const fallbackSettings = { ...settings, modelTier: ModelTier.FAST };
      return runQCAnalysis(apiKey, profile, refImages, qcImages, qcImageIds, fallbackSettings, qcUserComments);
    }
    throw error; // Re-throw if not detailed or if fallback fails
  }
};

import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AppSettings, ExpertMode, ModelTier, ProductProfile, QCReport } from "../types";
import { generateUUID, fetchAndEncodeImage } from "./utils";

const isURL = (str: string): boolean => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

// Normalize various price strings into a single `$<amount>` format.
const normalizePriceEstimate = (raw?: string): string => {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();

  // Remove common prefixes/suffixes
  let cleaned = s.replace(/(USD|US\$|eur|€|GBP|£|AUD|CAD)\b/gi, '')
    .replace(/[,]/g, '')
    .replace(/approx\.?/gi, '')
    .replace(/msrp\:?/gi, '')
    .replace(/~|≈/g, '')
    .trim();

  // If it's a range like "100-200" or "100 to 200", take the average
  const rangeMatch = cleaned.match(/(-?\d+(?:\.\d+)?)\s*(?:-|to|–|—)\s*(-?\d+(?:\.\d+)?)/i);
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1]);
    const b = parseFloat(rangeMatch[2]);
    if (!isNaN(a) && !isNaN(b)) {
      const avg = Math.round((a + b) / 2);
      return `$${avg}`;
    }
  }

  // Extract first number
  const numMatch = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (numMatch) {
    const val = parseFloat(numMatch[0]);
    if (!isNaN(val)) {
      // Round to nearest whole dollar
      const rounded = Math.round(val);
      return `$${rounded}`;
    }
  }

  // If nothing numeric found, fall back to original trimmed string
  return s;
};

// Normalize an entire ProductProfile object to have consistent field formats
// Normalize category to standard forms (singular, lowercase, consistent naming)
const normalizeCategory = (category: string): string => {
  if (!category) return 'Uncategorized';
  
  // Convert to lowercase and trim
  let normalized = category.toLowerCase().trim();
  
  // Remove common variations and standardize
  // Map plural to singular
  const pluralToSingular: Record<string, string> = {
    'watches': 'watch',
    'bags': 'bag',
    'handbags': 'bag',
    'purses': 'bag',
    'shoes': 'shoe',
    'sneakers': 'shoe',
    'boots': 'shoe',
    'electronics': 'electronic',
    'phones': 'phone',
    'tablets': 'tablet',
    'computers': 'computer',
    'laptops': 'computer',
    'accessories': 'accessory',
    'sunglasses': 'sunglass',
    'belts': 'belt',
    'wallets': 'wallet',
    'rings': 'ring',
    'necklaces': 'necklace',
    'bracelets': 'bracelet',
    'earrings': 'earring',
  };
  
  // Normalize common category variations
  const categoryAliases: Record<string, string> = {
    'wristwatch': 'watch',
    'timepiece': 'watch',
    'luxury watch': 'watch',
    'luxury watches': 'watch',
    'designer watch': 'watch',
    'designer watches': 'watch',
    'smart watch': 'smartwatch',
    'smart watches': 'smartwatch',
    'handbag': 'bag',
    'purse': 'bag',
    'tote': 'bag',
    'clutch': 'bag',
    'satchel': 'bag',
    'backpack': 'bag',
    'sneaker': 'shoe',
    'trainer': 'shoe',
    'boot': 'shoe',
    'sandal': 'shoe',
    'smartphone': 'phone',
    'mobile phone': 'phone',
    'cell phone': 'phone',
    'ipad': 'tablet',
    'laptop': 'computer',
    'desktop': 'computer',
    'eyewear': 'sunglass',
    'jewellery': 'jewelry',
    'jewel': 'jewelry',
  };
  
  // Apply plural to singular mapping
  if (pluralToSingular[normalized]) {
    normalized = pluralToSingular[normalized];
  }
  
  // Apply alias mapping
  if (categoryAliases[normalized]) {
    normalized = categoryAliases[normalized];
  }
  
  // Title-case the result
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const normalizeProfile = (profile: ProductProfile): ProductProfile => {
  const out: Partial<ProductProfile> = { ...profile };

  // Helper: safe trim
  const safeTrim = (v?: string) => (v && typeof v === 'string') ? v.trim() : v || '';

  // Name & Brand: trim
  out.name = safeTrim(profile.name);
  out.brand = safeTrim(profile.brand);

  // Category: normalize to standard form
  out.category = normalizeCategory(profile.category || 'Uncategorized');

  // Price: normalize and format in accounting style with no decimals and thousand separators
  if (profile.priceEstimate) {
    const raw = normalizePriceEstimate(profile.priceEstimate as string);
    // If normalizePriceEstimate returned a string like "$1234" or original fallback
    const digits = raw.match(/-?\d+/g);
    if (digits) {
      // parse first matched number
      const num = parseInt(digits.join(''), 10);
      // Format with commas and no decimals
      const formatted = `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num)}`;
      out.priceEstimate = formatted;
    } else {
      out.priceEstimate = safeTrim(raw as string);
    }
  } else {
    out.priceEstimate = '';
  }

  // Material: trim
  out.material = safeTrim(profile.material);

  // Features: ensure array of trimmed strings
  if (Array.isArray(profile.features)) {
    out.features = profile.features.map(f => (typeof f === 'string' ? f.trim() : String(f))).filter(Boolean);
  } else if (typeof (profile.features as any) === 'string') {
    out.features = (profile.features as any).split(',').map((s: string) => s.trim()).filter(Boolean);
  } else {
    out.features = [];
  }

  // Description: single-line trimmed
  out.description = safeTrim((profile.description || '').replace(/\s+/g, ' '));

  // URL: validate
  if (profile.url && isURL(profile.url)) {
    out.url = profile.url;
  } else {
    out.url = profile.url || '';
  }

  // imageUrls: ensure array of valid URLs
  if (Array.isArray(profile.imageUrls)) {
    out.imageUrls = profile.imageUrls.filter(u => typeof u === 'string' && isURL(u));
  } else {
    out.imageUrls = [];
  }

  // qcUserComments: trim
  (out as any).qcUserComments = safeTrim((profile as any).qcUserComments || '');

  return out as ProductProfile;
};

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

// Standard section names for different product categories
const STANDARD_SECTION_NAMES: Record<string, string[]> = {
  'watches': ['Dial & Hands', 'Case & Bezel', 'Crown & Pushers', 'Bracelet/Strap', 'Clasp', 'Movement', 'Case Back', 'Packaging', 'Documentation'],
  'bags': ['Exterior Material', 'Interior Lining', 'Hardware & Zippers', 'Stitching', 'Handles/Straps', 'Logo & Stamps', 'Dust Bag', 'Authenticity Card', 'Packaging'],
  'shoes': ['Upper Material', 'Sole', 'Stitching', 'Logo & Branding', 'Interior', 'Laces', 'Box & Packaging', 'Authenticity Card'],
  'electronics': ['Display/Screen', 'Body/Casing', 'Ports & Buttons', 'Camera/Lens', 'Software/Interface', 'Accessories', 'Packaging', 'Documentation'],
  'jewelry': ['Metal Quality', 'Gemstones', 'Clasp/Closure', 'Engravings', 'Finish/Polish', 'Chain/Band', 'Packaging', 'Certificate'],
  'clothing': ['Fabric Quality', 'Stitching', 'Labels & Tags', 'Hardware', 'Construction', 'Finish', 'Packaging'],
  'default': ['Overall Quality', 'Materials', 'Construction', 'Hardware', 'Branding', 'Finish', 'Packaging', 'Documentation']
};

// Constants for string similarity comparison
const MIN_TOKEN_LENGTH = 2;
const SIMILARITY_THRESHOLD = 0.7;

// Calculate similarity between two strings (0-1)
const stringSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  
  // Remove common punctuation and special characters for comparison
  const normalize = (s: string) => s
    .replace(/[&/\\#,+()$~%.'":*?<>{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  
  const n1 = normalize(s1);
  const n2 = normalize(s2);
  
  if (n1 === n2) return 0.95;
  
  // Check for substring matches
  if (n1.includes(n2) || n2.includes(n1)) return 0.85;
  
  // Token-based Jaccard similarity
  const tokens1 = new Set(n1.split(' ').filter(t => t.length > MIN_TOKEN_LENGTH));
  const tokens2 = new Set(n2.split(' ').filter(t => t.length > MIN_TOKEN_LENGTH));
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
};

// Normalize a section name to match standard names
const normalizeSectionName = (sectionName: string, category: string = 'default'): string => {
  const trimmed = sectionName.trim();
  
  // Get standard names for this category
  const standardNames = STANDARD_SECTION_NAMES[category.toLowerCase()] || STANDARD_SECTION_NAMES['default'];
  
  // Try to find a matching standard name
  let bestMatch = trimmed;
  let bestScore = SIMILARITY_THRESHOLD; // Threshold for considering a match
  
  for (const standardName of standardNames) {
    const similarity = stringSimilarity(trimmed, standardName);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = standardName;
    }
  }
  
  // Also check against watch-specific terms
  if (category.toLowerCase().includes('watch') || category.toLowerCase().includes('timepiece')) {
    for (const standardName of STANDARD_SECTION_NAMES['watches']) {
      const similarity = stringSimilarity(trimmed, standardName);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = standardName;
      }
    }
  }
  
  return bestMatch;
};

// Get standard sections prompt for a category
const getStandardSectionsPrompt = (category: string): string => {
  const cat = category.toLowerCase();
  
  if (cat.includes('watch') || cat.includes('timepiece')) {
    return 'Dial & Hands, Case & Bezel, Crown & Pushers, Bracelet/Strap, Clasp, Movement, Case Back, Packaging, Documentation';
  } else if (cat.includes('bag') || cat.includes('handbag') || cat.includes('purse')) {
    return 'Exterior Material, Interior Lining, Hardware & Zippers, Stitching, Handles/Straps, Logo & Stamps, Dust Bag, Authenticity Card, Packaging';
  } else if (cat.includes('shoe') || cat.includes('sneaker') || cat.includes('boot')) {
    return 'Upper Material, Sole, Stitching, Logo & Branding, Interior, Laces, Box & Packaging, Authenticity Card';
  } else if (cat.includes('electron') || cat.includes('phone') || cat.includes('tablet') || cat.includes('computer')) {
    return 'Display/Screen, Body/Casing, Ports & Buttons, Camera/Lens, Software/Interface, Accessories, Packaging, Documentation';
  } else if (cat.includes('jewelry') || cat.includes('necklace') || cat.includes('bracelet') || cat.includes('ring')) {
    return 'Metal Quality, Gemstones, Clasp/Closure, Engravings, Finish/Polish, Chain/Band, Packaging, Certificate';
  } else if (cat.includes('clothing') || cat.includes('apparel') || cat.includes('jacket') || cat.includes('shirt')) {
    return 'Fabric Quality, Stitching, Labels & Tags, Hardware, Construction, Finish, Packaging';
  }
  
  return 'Overall Quality, Materials, Construction, Hardware, Branding, Finish, Packaging, Documentation';
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
    - **IMAGE SEARCH**: When you identify a product, perform a Google Image Search for the product (using brand + model name). Extract 3-5 high-quality product image URLs from official sources, e-commerce sites, or reputable retailers. Include these URLs in the 'imageUrls' field of your response.
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
  imageDatas: string[], // base64 strings or URLs
  inputUrl: string | undefined,
  settings: AppSettings
): Promise<ProductProfile> => {
  const ai = new GoogleGenAI({ apiKey });
  const { model } = getModelConfig(settings.modelTier);

  const processedImageDatas = await Promise.all(imageDatas.map(async (data) => {
    if (isURL(data)) {
      return await fetchAndEncodeImage(data);
    }
    return data.split(',')[1] || data;
  }));

  const parts: any[] = processedImageDatas.map(data => ({
    inlineData: { mimeType: 'image/jpeg', data }
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
    if (imageDatas.length === 0) {
      prompt += `\n**Action Required**: No images were provided. Analyze the content of the Reference URL to identify the product. Then, perform a web search to find and return at least 3-5 high-quality image URLs for this product in the 'imageUrls' field of your response.`;
    }
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

  // Enable Google Search when we have a URL but no images, or when we need to find image URLs
  const needsImageSearch = imageDatas.length === 0 || inputUrl;
  
  let responseText = "{}";
  
  if (needsImageSearch) {
    // Two-pass approach: First pass with Google Search (no JSON schema), then synthesize JSON
    const firstConfig: any = {
      systemInstruction: getSystemInstruction(settings.expertMode, settings.modelTier, 'ID'),
      thinkingConfig,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        }
      ],
      tools: [{ googleSearch: {} }]
    };

    const firstResponse = await ai.models.generateContent({
      model,
      contents: { parts },
      config: firstConfig
    });
    
    const firstText = firstResponse.text || "";
    
    // Second pass: request structured JSON using the prior analysis as context
    const partsForJson = [
      ...parts,
      { text: `\n\nBased on the above analysis and web search results, generate a JSON response conforming to the ProductProfile schema. Include the 'imageUrls' field with 3-5 high-quality product image URLs found from your web search. Respond ONLY with valid JSON matching the schema.` },
      { text: firstText }
    ];

    const secondConfig: any = {
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
    };

    const secondResponse = await ai.models.generateContent({
      model,
      contents: { parts: partsForJson },
      config: secondConfig
    });
    
    responseText = secondResponse.text || "{}";
  } else {
    // Single pass when we have images
    const configOptions: any = {
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
    };

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: configOptions
    });

    responseText = response.text || "{}";
  }
  
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

  // Normalize entire profile to consistent formats
  try {
    return normalizeProfile(profile);
  } catch (e) {
    console.warn('Profile normalization failed', e);
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
    for (const [idx, img] of refImages.entries()) {
      parts.push({
        text: `REFERENCE IMAGE ${idx + 1} (Authentic):`
      });
      let processedImgData;
      if (isURL(img)) {
        processedImgData = await fetchAndEncodeImage(img);
      } else {
        processedImgData = img.split(',')[1] || img;
      }
      parts.push({
        inlineData: { mimeType: 'image/jpeg', data: processedImgData }
      });
    }

    // Add Product Context
    parts.push({
      text: `AUTHENTIC PRODUCT PROFILE:\n${JSON.stringify(profile, null, 2)}\n\n`
    });

    // Add QC Images
    for (const [idx, img] of qcImages.entries()) {
      parts.push({
        text: `QC INSPECTION IMAGE ${idx + 1} (To be analyzed):`
      });
      let processedImgData;
      if (isURL(img)) {
        processedImgData = await fetchAndEncodeImage(img);
      } else {
        processedImgData = img.split(',')[1] || img;
      }
      parts.push({
        inlineData: { mimeType: 'image/jpeg', data: processedImgData }
      });
    }

    // Add user comments if provided
    if (qcUserComments) {
      parts.push({
        text: `\n**USER COMMENTS TO CONSIDER:**\n${qcUserComments}\n`
      });
    }

    const standardSections = getStandardSectionsPrompt(profile.category || 'default');
    
    parts.push({
      text: `Perform a QC inspection comparing the CUMULATIVE SET of QC INSPECTION IMAGES (collected over multiple batches) against the REFERENCE IMAGES and PROFILE.
    
    SCORING RUBRIC:
    - PASS: > 80 (Good condition, authentic, no major defects)
    - CAUTION: 61 - 80 (Suspicious, minor defects, or inconclusive)
    - FAIL: <= 60 (Definite replica, damaged, or major defects)
    
    Output requirements:
    - Break down analysis by sections. Use these STANDARD SECTION NAMES consistently: ${standardSections}
    - CRITICAL: Always use the exact section names provided above. Do NOT create variations like "luxury watches" vs "luxury timepiece" or "Exterior Leather" vs "Leather Exterior". Use the standard names exactly as given.
    - Use bullet points in observations.
    - Provide a specific score on a scale of 0-100 and a grade for each section and for the overall assessment.
    - Include a "requestForMoreInfo" section suggesting what additional images or information could improve the analysis.
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
        },
        requestForMoreInfo: { type: Type.ARRAY, items: { type: Type.STRING } }
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
    
    // Normalize section names to prevent duplicates
    if (result.sections && Array.isArray(result.sections)) {
      result.sections = result.sections.map((section: any) => ({
        ...section,
        sectionName: normalizeSectionName(section.sectionName, profile.category || 'default')
      }));
    }
    
    return {
      id: generateUUID(),
      generatedAt: Date.now(),
      basedOnBatchIds: [],
      qcImageIds: qcImageIds, // <-- ADD THIS
      modelTier: settings.modelTier,
      expertMode: settings.expertMode,
      userComments: qcUserComments, // Store initial user comments
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

export const runFinalQCAnalysis = async (
  apiKey: string,
  profile: ProductProfile,
  refImages: string[],
  qcImages: string[],
  qcImageIds: string[],
  settings: AppSettings,
  preliminaryReport: QCReport,
  userComments: string,
): Promise<QCReport> => {
  // This function is similar to runQCAnalysis but includes the preliminary report and user feedback.
  // For brevity, we'll reuse the main logic and just add the new context.
  
  const ai = new GoogleGenAI({ apiKey });
  const { model } = getModelConfig(settings.modelTier);

  const parts: any[] = [];

  // Add Ref Images
  refImages.forEach((img, idx) => {
    parts.push({ text: `REFERENCE IMAGE ${idx + 1} (Authentic):` });
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: img.split(',')[1] || img } });
  });

  // Add Product Context
  parts.push({ text: `AUTHENTIC PRODUCT PROFILE:\n${JSON.stringify(profile, null, 2)}\n\n` });

  // Add QC Images
  qcImages.forEach((img, idx) => {
    parts.push({ text: `QC INSPECTION IMAGE ${idx + 1} (To be analyzed):` });
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: img.split(',')[1] || img } });
  });

  // Add Preliminary Report and User Comments
  parts.push({ text: `\n**PRELIMINARY QC REPORT:**\n${JSON.stringify(preliminaryReport, null, 2)}\n` });
  parts.push({ text: `\n**USER'S ADDITIONAL COMMENTS:**\n${userComments}\n` });

  const standardSections = getStandardSectionsPrompt(profile.category || 'default');
  
  parts.push({
    text: `Generate a FINAL QC REPORT based on all the provided information, including the preliminary report and the user's new comments.
    
    Output requirements:
    - Incorporate the user's feedback into your final analysis.
    - Use these STANDARD SECTION NAMES consistently: ${standardSections}
    - CRITICAL: Always use the exact section names provided above to maintain consistency with the preliminary report.
    - Provide a specific score (0-100) and grade for each section and Overall.
    - Include a "requestForMoreInfo" section suggesting what additional images or information could improve the analysis.
    - ALWAYS return your response as a valid, raw JSON object conforming to the QCReport schema.`
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
      },
      requestForMoreInfo: { type: Type.ARRAY, items: { type: Type.STRING } },
      userComments: { type: Type.STRING }
    }
  };

  const config: any = {
      systemInstruction: getSystemInstruction(settings.expertMode, settings.modelTier, 'QC'),
      responseMimeType: "application/json",
      responseSchema: schema,
  };

  const response = await ai.models.generateContent({ model, contents: { parts }, config });
  const result = JSON.parse(cleanJson(response.text || "{}"));
  
  // Normalize section names to prevent duplicates
  if (result.sections && Array.isArray(result.sections)) {
    result.sections = result.sections.map((section: any) => ({
      ...section,
      sectionName: normalizeSectionName(section.sectionName, profile.category || 'default')
    }));
  }
  
  return {
    id: generateUUID(),
    generatedAt: Date.now(),
    basedOnBatchIds: [],
    qcImageIds: qcImageIds,
    modelTier: settings.modelTier,
    expertMode: settings.expertMode,
    userComments: userComments, // Ensure user comments are highlighted
    ...result
  };
};

/**
 * Search for section-specific close-up images using Google Search
 * @param apiKey - Gemini API key
 * @param productProfile - Product profile information
 * @param sectionName - Name of the section to search images for (e.g., "Dial & Hands", "Clasp")
 * @param modelTier - Model tier to use (FAST or DETAILED)
 * @returns Promise resolving to an array of image URLs
 */
export const searchSectionSpecificImages = async (
  apiKey: string,
  productProfile: ProductProfile,
  sectionName: string,
  modelTier: ModelTier = ModelTier.FAST
): Promise<string[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const { model } = getModelConfig(modelTier);

    // Construct search prompt
    const searchPrompt = `Find high-quality close-up images of the ${sectionName} section for the authentic ${productProfile.brand} ${productProfile.name}.

Product Details:
- Brand: ${productProfile.brand}
- Model: ${productProfile.name}
- Category: ${productProfile.category}
- Material: ${productProfile.material}

Search for images that show:
1. Clear, detailed close-up views of the ${sectionName}
2. From official product pages, authorized retailers, or authentication guides
3. High resolution and well-lit
4. Showing authentic product details

Return 3-5 relevant image URLs that would be useful for quality control comparison of the ${sectionName}.`;

    // Configure for web search
    const config: any = {
      systemInstruction: 'You are an expert at finding reference images for product authentication. Use Google Search to find the most relevant, high-quality close-up images.',
      tools: [{ googleSearch: {} }],
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        }
      ]
    };

    if (modelTier === ModelTier.FAST) {
      config.thinkingConfig = { thinkingBudget: 8192 };
    }

    const parts = [{ text: searchPrompt }];
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config
    });

    if (!response || !response.text) {
      console.warn(`[Image Search] No response text received for ${sectionName}`);
      return [];
    }

    const responseText = response.text;
    
    // Extract URLs from the response text
    // Look for URLs in the format http:// or https://
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+\.(jpg|jpeg|png|webp|gif)/gi;
    const matches = responseText.match(urlRegex);
    
    if (!matches || matches.length === 0) {
      console.warn(`[Image Search] No image URLs found for ${sectionName}`);
      return [];
    }

    // Filter and validate URLs
    const validUrls = matches
      .filter((url, index, self) => self.indexOf(url) === index) // Remove duplicates
      .slice(0, 5); // Limit to 5 images

    console.log(`[Image Search] Found ${validUrls.length} images for ${sectionName}`);
    return validUrls;
  } catch (error) {
    console.error(`[Image Search] Failed to search images for ${sectionName}:`, error);
    return [];
  }
};

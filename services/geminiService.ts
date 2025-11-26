import { GoogleGenAI, Type, Schema } from "@google/genai";
import { UserStats, MeasurementResult } from "../types";

// Helper to get API Key safely
const getApiKey = () => {
  // Check process.env (Node/Webpack) and import.meta.env (Vite)
  if (typeof process !== 'undefined' && process.env?.API_KEY) {
    return process.env.API_KEY;
  }
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env.API_KEY || import.meta.env.VITE_API_KEY;
  }
  return undefined;
};

// Lazy initialization of Gemini Client
let aiInstance: GoogleGenAI | null = null;
const getAI = () => {
  if (!aiInstance) {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.error("Gemini API Key is missing. Check your environment variables (API_KEY or VITE_API_KEY).");
      // Fallback or let it throw naturally from SDK if desired, but explicit error is better
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiInstance;
};

export const analyzeApplicationLogs = async (logs: any[]): Promise<string> => {
  const prompt = `
    You are a Senior Mobile QA Engineer and DevOps Specialist.
    Analyze the following JSON application logs from a React PWA used for camera-based body scanning.
    
    The user is reporting issues. Look for:
    1. Camera permission denials or hardware access failures.
    2. WebGL context losses.
    3. Network timeouts or API errors.
    4. Abnormal user flow (e.g., getting stuck on a step).
    
    Logs:
    ${JSON.stringify(logs, null, 2)}
    
    Provide a concise, technical summary of what went wrong and a recommended fix.
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt
    });
    return response.text || "No analysis generated.";
  } catch (e: any) {
    return `Analysis failed: ${e.message}`;
  }
};

export const analyzeBodyMeasurements = async (
  frontImageBase64: string,
  sideImageBase64: string,
  stats: UserStats,
  modelId: string = "gemini-3-pro-preview"
): Promise<MeasurementResult> => {
  
  const prompt = `
    You are an expert anthropometrist and technical tailor. 
    Analyze the attached TWO images (Front & Side) to calculate precise body measurements.
    
    GROUND TRUTH:
    - User Provided Height: ${stats.height} cm
    ${stats.weight ? `- Weight: ${stats.weight} kg` : ''}
    ${stats.gender ? `- Gender: ${stats.gender}` : ''}
    
    TASK:
    1. TRANSPARENCY & SCALING: 
       - Identify the top of the head and bottom of the feet in the Front image.
       - Calculate "scaling_factor" (pixels_per_cm) based on the User Provided Height vs the subject's pixel height.
       - Independently estimate the subject's height ("estimated_height_cm") based on head-to-body proportions to cross-check the user provided value.

    2. LANDMARKS:
       - Identify specific anatomical landmarks (x,y coordinates normalized 0-1) for both Front and Side views.
       - You MUST return "landmarks_front" and "landmarks_side" with the specific points defined in the schema.

    3. MEASUREMENT:
       - Measure raw pixel widths (Front) and depths (Side) for key areas (Chest, Waist, Hips, Thigh, etc.).
       - Apply geometric formulas (e.g., Ramanujan approximation for ellipse circumference) to convert pixel dimensions to cm circumferences using the scaling_factor.
    
    4. REASONING:
       - Provide a "thought_summary" (2-3 sentences) explaining how you determined the fit and any adjustments made for posture or clothing.

    5. QUALITY:
       - Assess image quality, pose, and lighting.
    
    Return strict JSON matching the provided schema.
  `;

  // Define the output schema strictly
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      // Measurements
      neck: { type: Type.NUMBER },
      shoulder: { type: Type.NUMBER },
      chest: { type: Type.NUMBER },
      bicep: { type: Type.NUMBER },
      wrist: { type: Type.NUMBER },
      sleeve: { type: Type.NUMBER },
      waist: { type: Type.NUMBER },
      hips: { type: Type.NUMBER },
      inseam: { type: Type.NUMBER },
      outseam: { type: Type.NUMBER },
      thigh: { type: Type.NUMBER },
      calf: { type: Type.NUMBER },
      ankle: { type: Type.NUMBER },
      torso_length: { type: Type.NUMBER },

      // Transparency Fields
      scaling_factor: { type: Type.NUMBER, description: "Calculated pixels per cm" },
      estimated_height_cm: { type: Type.NUMBER, description: "AI estimated height based on proportions" },
      thought_summary: { type: Type.STRING, description: "Natural language summary of reasoning" },
      
      // Landmarks - Flattened Top Level as requested
      landmarks_front: {
         type: Type.OBJECT,
         properties: {
           head_top: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
           neck_base: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
           shoulder_left: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
           shoulder_right: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
           waist_left: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
           waist_right: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
           hip_left: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
           hip_right: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
           knee_left: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
           knee_right: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
           ankle_left: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
           ankle_right: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
           feet_center: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} }
         }
      },
      landmarks_side: {
         type: Type.OBJECT,
         properties: {
            neck_point: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
            chest_front: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
            chest_back: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
            waist_front: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
            waist_back: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
            hip_front: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
            hip_back: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
            knee: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
            ankle: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
            back_spine: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} }
         }
      },

      // Meta
      confidence: { type: Type.NUMBER },
      notes: { type: Type.STRING },
      body_shape: { type: Type.STRING },
      
      // Technical / Transparency Data (Legacy/Detailed)
      technical_analysis: {
        type: Type.OBJECT,
        properties: {
          scaling: {
            type: Type.OBJECT,
            properties: {
              pixel_height: { type: Type.NUMBER, description: "Height of subject in pixels in front view" },
              real_height_cm: { type: Type.NUMBER },
              cm_per_pixel: { type: Type.NUMBER }
            }
          },
          raw_measurements: {
            type: Type.OBJECT,
            description: "Raw pixel measurements for key areas",
            properties: {
              chest: { type: Type.OBJECT, properties: { width_px: { type: Type.NUMBER }, depth_px: { type: Type.NUMBER } } },
              waist: { type: Type.OBJECT, properties: { width_px: { type: Type.NUMBER }, depth_px: { type: Type.NUMBER } } },
              hips: { type: Type.OBJECT, properties: { width_px: { type: Type.NUMBER }, depth_px: { type: Type.NUMBER } } }
            }
          },
          formulas: {
            type: Type.OBJECT,
            description: "String representation of formulas used",
            properties: {
              chest: { type: Type.STRING },
              waist: { type: Type.STRING },
              hips: { type: Type.STRING }
            }
          }
        }
      },

      // Quality
      quality_assessment: {
        type: Type.OBJECT,
        properties: {
          overall_score: { type: Type.NUMBER },
          front_image_quality: { type: Type.NUMBER, description: "1-10 score" },
          side_image_quality: { type: Type.NUMBER, description: "1-10 score" },
          pose_consistency: { type: Type.NUMBER, description: "1-10 score" },
          lighting_quality: { type: Type.NUMBER, description: "1-10 score" },
          issues_detected: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of specific issues like 'blurry', 'baggy clothes', 'poor lighting'"
          }
        }
      },

      percentiles: {
        type: Type.OBJECT,
        properties: {
          chest: { type: Type.NUMBER },
          waist: { type: Type.NUMBER },
          hips: { type: Type.NUMBER }
        }
      },
      fit_concerns: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            area: { type: Type.STRING },
            issue: { type: Type.STRING },
            severity: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
            advice: { type: Type.STRING }
          }
        }
      }
    },
    required: [
      "neck", "shoulder", "chest", "bicep", "wrist", "sleeve", 
      "waist", "hips", 
      "inseam", "outseam", "thigh", "calf", "ankle", 
      "confidence", "technical_analysis", "quality_assessment",
      "scaling_factor", "thought_summary", "landmarks_front", "landmarks_side"
    ],
  };

  try {
    const frontData = frontImageBase64.split(',')[1] || frontImageBase64;
    const sideData = sideImageBase64.split(',')[1] || sideImageBase64;

    const config: any = {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.2,
    };

    // Apply Thinking Config ONLY for 2.5 Flash
    if (modelId.includes('gemini-2.5-flash')) {
      config.thinkingConfig = { thinkingBudget: 12000 }; 
      console.log("Using Thinking Budget: 12000 for model:", modelId);
    }

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: frontData } },
          { inlineData: { mimeType: "image/jpeg", data: sideData } },
          { text: prompt }
        ]
      },
      config: config
    });

    if (response.text) {
      const text = response.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : text;
      
      try {
        const result = JSON.parse(jsonString) as MeasurementResult;
        
        // Attach usage metadata if available
        if (response.usageMetadata) {
          result.usage_metadata = {
            promptTokenCount: response.usageMetadata.promptTokenCount,
            candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
            totalTokenCount: response.usageMetadata.totalTokenCount,
            // @ts-ignore - thinkingTokenCount might not be in the default type definition yet
            thinkingTokenCount: response.usageMetadata.thinkingTokenCount
          };
          result.token_count = response.usageMetadata.totalTokenCount;
        }

        // --- Persist model ID in the result object ---
        result.model_name = modelId;
        
        // Backfill legacy landmarks structure if visualizer relies on it
        if (!result.landmarks && result.landmarks_front && result.landmarks_side) {
          result.landmarks = {
            front: result.landmarks_front,
            side: result.landmarks_side
          };
        }

        return result;
      } catch (e) {
        console.error("Failed to parse JSON", e);
        throw new Error("Invalid response format from AI");
      }
    }
    throw new Error("No response text generated");
    
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
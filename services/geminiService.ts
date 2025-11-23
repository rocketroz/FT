import { GoogleGenAI, Type, Schema } from "@google/genai";
import { UserStats, MeasurementResult } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    - Height: ${stats.height} cm
    ${stats.weight ? `- Weight: ${stats.weight} kg` : ''}
    ${stats.gender ? `- Gender: ${stats.gender}` : ''}
    
    TASK:
    1. Identify anatomical landmarks in pixel coordinates for both views.
    2. Calculate "pixels_per_cm" scaling factor using the subject's full height in the image vs real height.
    3. Measure raw pixel widths (Front) and depths (Side) for key areas (Chest, Waist, Hips, Thigh, etc.).
    4. Apply geometric formulas (e.g., Ramanujan approximation for ellipse circumference) to convert pixel dimensions to cm circumferences.
    5. Assess image quality, pose, and lighting.
    
    REQUIREMENTS:
    - Return specific mathematical formulas used for each major circumference.
    - Return raw pixel values before conversion.
    - List any detected issues (blur, baggy clothes, bad pose).
    - Provide coordinates for key landmarks for visual validation.
    
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

      // Meta
      confidence: { type: Type.NUMBER },
      notes: { type: Type.STRING },
      thought_summary: { type: Type.STRING },
      body_shape: { type: Type.STRING },
      
      // Technical / Transparency Data
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

      // Landmarks
      landmarks: {
        type: Type.OBJECT,
        properties: {
          front: {
             type: Type.OBJECT,
             description: "Key landmarks in front view (normalized 0-1)",
             properties: {
               head_top: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
               shoulder_left: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
               shoulder_right: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
               waist_left: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
               waist_right: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
               feet_center: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} }
             }
          },
          side: {
             type: Type.OBJECT,
             description: "Key landmarks in side view (normalized 0-1)",
             properties: {
                neck_point: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
                chest_point: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
                waist_back: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} },
                hip_point: { type: Type.OBJECT, properties: {x: {type: Type.NUMBER}, y: {type: Type.NUMBER}} }
             }
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
      "confidence", "technical_analysis", "quality_assessment"
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
    if (modelId === 'gemini-2.5-flash') {
      config.thinkingConfig = { thinkingBudget: 12000 }; 
      console.log("Using Thinking Budget: 12000");
    }

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
            totalTokenCount: response.usageMetadata.totalTokenCount
          };
        }

        // Attach model name
        result.model_name = modelId;

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
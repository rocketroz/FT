import { GoogleGenAI, Type, Schema } from "@google/genai";
import { UserStats, MeasurementResult } from "../types";

// Initialize Gemini Client
// Note: In a real production app, API calls should go through a backend proxy to hide the key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeBodyMeasurements = async (
  frontImageBase64: string,
  sideImageBase64: string,
  stats: UserStats
): Promise<MeasurementResult> => {
  
  const modelId = "gemini-2.5-flash"; // Good balance of speed and vision capabilities

  const prompt = `
    You are an expert anthropometrist and professional tailor AI. 
    Analyze the attached TWO images of a person (Image 1: Front View, Image 2: Side View) to estimate body measurements for clothing fitting.
    
    Use the following GROUND TRUTH data to scale the image pixels to real-world units:
    - Height: ${stats.height} cm
    ${stats.weight ? `- Weight: ${stats.weight} kg` : ''}
    ${stats.gender ? `- Gender: ${stats.gender}` : ''}
    ${stats.age ? `- Age: ${stats.age}` : ''}

    INSTRUCTIONS:
    1. Identify key body landmarks in BOTH images.
    2. Use the Front View for widths (shoulders, hips, waist width).
    3. Use the Side View for depths (chest depth, waist depth, glute prominence).
    4. Combine Front (width) and Side (depth) to calculate accurate circumferences (Chest, Waist, Hips, Thighs) using an ellipse approximation or body shape modeling.
    5. Use the user's provided Height as the absolute vertical scale reference.
    6. Return the measurements in Centimeters (cm).
    7. Provide a confidence score (0-100) based on image clarity and pose consistency between the two views.
    8. Provide a short analysis note about the body shape or fit recommendation.

    Return strict JSON.
  `;

  // Define the output schema strictly
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      // Upper Body
      neck: { type: Type.NUMBER, description: "Neck circumference in cm" },
      shoulder: { type: Type.NUMBER, description: "Shoulder to shoulder width in cm" },
      chest: { type: Type.NUMBER, description: "Chest circumference in cm" },
      bicep: { type: Type.NUMBER, description: "Upper arm/Bicep circumference in cm" },
      wrist: { type: Type.NUMBER, description: "Wrist circumference in cm" },
      sleeve: { type: Type.NUMBER, description: "Sleeve length (shoulder to wrist) in cm" },
      
      // Core
      waist: { type: Type.NUMBER, description: "Natural waist circumference in cm" },
      hips: { type: Type.NUMBER, description: "Hip circumference at widest point in cm" },
      
      // Lower Body
      inseam: { type: Type.NUMBER, description: "Inseam length in cm" },
      outseam: { type: Type.NUMBER, description: "Outseam length (waist to floor) in cm" },
      thigh: { type: Type.NUMBER, description: "Thigh circumference at widest point in cm" },
      calf: { type: Type.NUMBER, description: "Calf circumference at widest point in cm" },
      ankle: { type: Type.NUMBER, description: "Ankle circumference in cm" },

      confidence: { type: Type.NUMBER, description: "Confidence score 0-100" },
      notes: { type: Type.STRING, description: "Analysis notes" },
    },
    required: [
      "neck", "shoulder", "chest", "bicep", "wrist", "sleeve", 
      "waist", "hips", 
      "inseam", "outseam", "thigh", "calf", "ankle", 
      "confidence", "notes"
    ],
  };

  try {
    // Extract base64 data (remove header if present)
    const frontData = frontImageBase64.split(',')[1] || frontImageBase64;
    const sideData = sideImageBase64.split(',')[1] || sideImageBase64;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: frontData
            }
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: sideData
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2, // Low temperature for more analytical/deterministic results
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as MeasurementResult;
    }
    throw new Error("No response text generated");
    
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
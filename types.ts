
export enum Gender {
  Male = 'Male',
  Female = 'Female',
  Other = 'Other'
}

export interface UserStats {
  height: number; // in cm
  weight?: number; // in kg
  age?: number;
  gender?: Gender;
  unitSystem: 'metric' | 'imperial';
}

export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  thinkingTokenCount?: number;
}

export interface LandmarkPoint {
  x: number;
  y: number;
}

export interface LandmarkSet {
  // Common / Front
  head_top?: LandmarkPoint;
  neck_base?: LandmarkPoint;
  shoulder_left?: LandmarkPoint;
  shoulder_right?: LandmarkPoint;
  waist_left?: LandmarkPoint;
  waist_right?: LandmarkPoint;
  hip_left?: LandmarkPoint;
  hip_right?: LandmarkPoint;
  knee_left?: LandmarkPoint;
  knee_right?: LandmarkPoint;
  ankle_left?: LandmarkPoint;
  ankle_right?: LandmarkPoint;
  feet_center?: LandmarkPoint;

  // Side Specific
  neck_point?: LandmarkPoint;
  chest_front?: LandmarkPoint;
  chest_back?: LandmarkPoint; // inferred
  waist_front?: LandmarkPoint;
  waist_back?: LandmarkPoint;
  hip_front?: LandmarkPoint;
  hip_back?: LandmarkPoint;
  knee?: LandmarkPoint;
  ankle?: LandmarkPoint;
  
  // Back Specific (if needed, mostly side spine)
  back_spine?: LandmarkPoint;
}

export interface MeasurementResult {
  // Core Measurements (cm)
  chest: number;
  waist: number;
  hips: number;
  shoulder: number;
  sleeve: number;
  neck: number;
  
  // Extended measurements
  bicep: number;
  wrist: number;
  inseam: number;
  outseam: number;
  thigh: number;
  calf: number;
  ankle: number;
  
  // Derived/Computed
  torso_length?: number;
  
  // Meta
  confidence: number; // 0-100
  notes: string;
  body_shape?: string;
  percentiles?: Record<string, number>;
  
  // --- Transparency & Tracking Fields ---
  model_name?: string; // e.g. "gemini-3-pro-preview"
  scaling_factor?: number; // pixels per cm
  estimated_height_cm?: number; // AI's independent estimate
  thought_summary?: string; // Natural language reasoning
  token_count?: number; 
  
  // Explicit Landmark Sets
  landmarks_front?: LandmarkSet;
  landmarks_side?: LandmarkSet;

  // Legacy structure for backward compatibility (optional)
  landmarks?: {
    front: LandmarkSet;
    side: LandmarkSet;
  };

  // Detailed Technical Analysis (Legacy support & specific formula logging)
  technical_analysis?: {
    scaling: {
      pixel_height: number;
      real_height_cm: number;
      cm_per_pixel: number;
    };
    raw_measurements: Record<string, { width_px?: number; depth_px?: number; length_px?: number }>;
    formulas: Record<string, string>;
  };

  // Quality Assurance
  quality_assessment?: {
    overall_score: number;
    front_image_quality: number; // 1-10
    side_image_quality: number; // 1-10
    pose_consistency: number; // 1-10
    lighting_quality: number; // 1-10
    issues_detected: string[];
  };

  fit_concerns?: Array<{
    area: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    advice: string;
  }>;

  // API Metadata
  usage_metadata?: UsageMetadata;
}

export interface CaptureMetadata {
  method: 'camera' | 'upload';
  facingMode: 'user' | 'environment' | 'unknown';
  deviceLabel: string;
  userAgent: string;
  timestamp: string;
  screenResolution: string;
  cameraSettings?: MediaTrackSettings;
  capabilities?: MediaTrackCapabilities;
}

export enum AppStep {
  Intro = 0,
  Stats = 1,
  CameraFront = 2,
  CameraSide = 3,
  Processing = 4,
  Results = 5,
  Auth = 6,
  Admin = 7
}

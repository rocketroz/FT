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
  thought_summary?: string;
  body_shape?: string;
  percentiles?: Record<string, number>;
  model_name?: string; // New field for A/B testing
  
  // Detailed Technical Analysis
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

  // Landmarks (Normalized 0-1)
  landmarks?: {
    front: Record<string, {x: number, y: number}>;
    side: Record<string, {x: number, y: number}>;
  };

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
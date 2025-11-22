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

export interface MeasurementResult {
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

  confidence: number; // 0-100
  notes: string;
}

export enum AppStep {
  Intro = 0,
  Stats = 1,
  CameraFront = 2,
  CameraSide = 3,
  Processing = 4,
  Results = 5
}
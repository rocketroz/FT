import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Camera, Volume2, VolumeX, Upload, Image as ImageIcon, X, Check, Info, AlertTriangle, SwitchCamera } from 'lucide-react';
import { CaptureMetadata } from '../types';

interface Props {
  onCapture: (imageBase64: string, metadata: CaptureMetadata) => void;
  onBack: () => void;
  mode: 'front' | 'side';
}

const SHUTTER_SOUND = "data:audio/wav;base64,UklGRi5AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQBAAAAA/v///wAAAAAAAAAAAA==";

// Path definitions extracted for reuse in AR Mask and Reference Guides
const PATH_FRONT = "M50 12 C56 12 60 16 60 22 C60 28 57 30 55 32 L82 62 L75 70 L58 52 L56 85 L62 190 L48 190 L46 100 L44 85 L42 85 L40 100 L38 190 L24 190 L30 85 L28 52 L11 70 L5 62 L31 32 C29 30 26 28 26 22 C26 16 30 12 36 12 C40 12 46 12 50 12 Z";
const PATH_SIDE = "M50 12 C55 12 58 16 58 22 C58 28 56 30 54 32 C58 36 60 45 58 60 C56 75 54 85 54 95 L56 140 L58 190 L40 190 L42 140 L44 95 L44 60 C42 45 40 36 40 32 C38 30 36 28 36 22 C36 16 40 12 46 12 Z";
const PATH_SIDE_ARM = "M48 32 L52 32 L54 60 L52 80 L48 80 L46 60 Z";

export const CameraCapture: React.FC<Props> = ({ onCapture, onBack, mode }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Refs to track component state for async operations
  const sequenceStartedRef = useRef(false);
  const isMountedRef = useRef(true);
  const autoStartTriggeredRef = useRef(false);

  const [captureMethod, setCaptureMethod] = useState<'camera' | 'upload'>('camera');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  
  // Camera State
  const [countdown, setCountdown] = useState<number | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Upload State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Help/Guide State
  const [showGuide, setShowGuide] = useState(false);

  // Mount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset sequence state when mode changes
  useEffect(() => {
    sequenceStartedRef.current = false;
    autoStartTriggeredRef.current = false;
    setCountdown(null);
    setIsCameraReady(false);
  }, [mode]);

  // Cleanup text-to-speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // ----------------------------------------------------------------------
  // Camera Logic
  // ----------------------------------------------------------------------

  const startCamera = useCallback(async () => {
    if (captureMethod !== 'camera') return;

    // Clean up previous stream if exists to prevent conflicts
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode: facingMode,
          width: { ideal: 3840 }, // Request 4K if available, fall back gracefully
          height: { ideal: 2160 },
          // Attempt to request continuous focus in initial constraints (supported by some browsers)
          // @ts-ignore
          focusMode: 'continuous' 
        } 
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!isMountedRef.current) {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }

      // --- ADVANCED FOCUS LOGIC ---
      // Try to apply continuous focus if the device supports it
      const videoTrack = mediaStream.getVideoTracks()[0];
      
      // Check capabilities safely
      if (typeof videoTrack.getCapabilities === 'function') {
        const capabilities = videoTrack.getCapabilities();
        // @ts-ignore: focusMode is not in standard TS definition yet for all browsers
        if (capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
          try {
            await videoTrack.applyConstraints({
              advanced: [{ focusMode: 'continuous' } as any]
            });
            console.log("Continuous autofocus enabled");
          } catch (focusErr) {
            console.log("Could not apply focus constraint", focusErr);
          }
        }
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      if (isMountedRef.current) {
        setError("Unable to access camera. Please try the Upload option.");
      }
      console.error(err);
    }
  }, [captureMethod, facingMode]);

  useEffect(() => {
    if (captureMethod === 'camera') {
      startCamera();
    } else {
      // Stop camera if switching to upload
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setStream(null);
      }
      setIsCameraReady(false);
    }
    
    return () => {
      // Clean up handled by startCamera logic or component unmount
    };
  }, [captureMethod, startCamera]);

  const handleVideoCanPlay = () => {
    setIsCameraReady(true);
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    // Reset any ongoing countdowns
    setCountdown(null);
    window.speechSynthesis.cancel();
    sequenceStartedRef.current = false;
  };

  const speak = useCallback((text: string): Promise<void> => {
    if (!audioEnabled) return Promise.resolve();

    return new Promise((resolve) => {
      window.speechSynthesis.cancel(); // Cancel any previous speech immediately
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.onend = () => resolve();
      // Handle error/cancel cases to ensure promise resolves
      utterance.onerror = () => resolve();
      
      if (isMountedRef.current) {
        window.speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    });
  }, [audioEnabled]);

  const playShutterSound = useCallback(() => {
    if (!audioEnabled) return;
    try {
      const audio = new Audio(SHUTTER_SOUND);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.value = 800;
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  }, [audioEnabled]);

  const takePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current && isMountedRef.current) {
      playShutterSound();
      setCountdown(null);
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Flip context horizontally if using front camera for natural mirror effect
      const isMirrored = facingMode === 'user';

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (isMirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.95); // Higher quality for analysis
        
        // Gather Metadata
        let deviceLabel = 'unknown';
        let trackSettings: MediaTrackSettings | undefined = undefined;
        let capabilities: MediaTrackCapabilities | undefined = undefined;

        if (streamRef.current) {
          const track = streamRef.current.getVideoTracks()[0];
          if (track) {
            deviceLabel = track.label;
            trackSettings = track.getSettings();
            if (typeof track.getCapabilities === 'function') {
              capabilities = track.getCapabilities();
            }
          }
        }

        const metadata: CaptureMetadata = {
          method: 'camera',
          facingMode: facingMode,
          deviceLabel: deviceLabel,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          cameraSettings: trackSettings,
          capabilities: capabilities
        };

        onCapture(imageBase64, metadata);
      }
    }
  }, [onCapture, playShutterSound, facingMode]);

  const startCaptureSequence = useCallback(async () => {
    if (sequenceStartedRef.current) return;
    sequenceStartedRef.current = true;

    if (mode === 'front') {
      await speak("Step back. Arms 45 degrees out. A-Pose.");
      if (!isMountedRef.current) return;
      await speak("3... 2... 1...");
    } else {
      await speak("Turn left 90 degrees. Arms by sides. 3... 2... 1...");
    }
    
    if (!isMountedRef.current) return;

    let count = 3;
    setCountdown(count);

    const interval = setInterval(() => {
      if (!isMountedRef.current) {
        clearInterval(interval);
        return;
      }
      
      count--;
      setCountdown(count);
      
      if (count === 0) {
        clearInterval(interval);
        takePhoto();
        sequenceStartedRef.current = false;
      }
    }, 1000);
  }, [mode, speak, takePhoto]);

  // Auto-start sequence when in side mode and CAMERA IS READY
  useEffect(() => {
    if (
      mode === 'side' && 
      captureMethod === 'camera' && 
      isCameraReady && 
      !autoStartTriggeredRef.current
    ) {
      autoStartTriggeredRef.current = true;
      startCaptureSequence();
    }
  }, [mode, captureMethod, isCameraReady, startCaptureSequence]);

  // ----------------------------------------------------------------------
  // Upload Logic
  // ----------------------------------------------------------------------

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmUpload = () => {
    if (uploadedImage) {
       const metadata: CaptureMetadata = {
          method: 'upload',
          facingMode: 'unknown',
          deviceLabel: 'File Upload',
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          screenResolution: `${window.screen.width}x${window.screen.height}`,
        };
      onCapture(uploadedImage, metadata);
    }
  };

  // ----------------------------------------------------------------------
  // Visual Assets (Mannequins)
  // ----------------------------------------------------------------------

  const MannequinFront = () => (
    <g>
      {/* Body Fill */}
      <path d={PATH_FRONT} fill="#94a3b8" />
      {/* Orange Center Line */}
      <line x1="43" y1="12" x2="43" y2="190" stroke="#f97316" strokeWidth="1" strokeDasharray="4 2" />
      
      {/* Key Landmark Lines */}
      <line x1="31" y1="32" x2="55" y2="32" stroke="#cbd5e1" strokeWidth="0.5" />
      <line x1="28" y1="52" x2="58" y2="52" stroke="#cbd5e1" strokeWidth="0.5" />
      <line x1="30" y1="85" x2="56" y2="85" stroke="#cbd5e1" strokeWidth="0.5" />
    </g>
  );

  const MannequinSide = () => (
    <g>
      {/* Body Fill */}
      <path d={PATH_SIDE} fill="#94a3b8" />
       {/* Arm at side */}
      <path d={PATH_SIDE_ARM} fill="#64748b" />
      {/* Orange Center Line (Side view spine approximation) */}
      <line x1="49" y1="12" x2="49" y2="190" stroke="#f97316" strokeWidth="1" strokeDasharray="4 2" />
    </g>
  );

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col z-50">
      
      {/* --- Header --- */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="pointer-events-auto flex gap-2">
          <button onClick={onBack} className="text-white p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all">
            <ArrowLeft size={24} />
          </button>
          
          {/* Mode Toggle */}
          <div className="flex bg-black/50 backdrop-blur-md rounded-full p-1 border border-white/10">
            <button 
              onClick={() => setCaptureMethod('camera')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${captureMethod === 'camera' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Camera size={14} /> Camera
            </button>
            <button 
              onClick={() => setCaptureMethod('upload')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${captureMethod === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Upload size={14} /> Upload
            </button>
          </div>
        </div>

        <div className="pointer-events-auto flex gap-2">
           <button 
            onClick={() => setShowGuide(!showGuide)} 
            className={`text-white p-2 rounded-full backdrop-blur-md transition-all ${showGuide ? 'bg-blue-600' : 'bg-white/10'}`}
          >
            <Info size={24} />
          </button>
          {captureMethod === 'camera' && (
            <button 
              onClick={() => setAudioEnabled(!audioEnabled)} 
              className={`text-white p-2 rounded-full backdrop-blur-md transition-all ${audioEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/50'}`}
            >
              {audioEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </button>
          )}
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <div className="relative flex-1 bg-black overflow-hidden flex flex-col items-center justify-center">
        
        {/* --- CAMERA VIEW --- */}
        {captureMethod === 'camera' && (
          <>
            {error ? (
              <div className="flex flex-col items-center text-white p-6 text-center">
                <AlertTriangle size={48} className="text-amber-500 mb-4" />
                <p className="mb-4 text-lg font-medium">{error}</p>
                <button onClick={() => setCaptureMethod('upload')} className="bg-blue-600 px-6 py-2 rounded-lg hover:bg-blue-500 transition-colors">
                  Switch to Upload Mode
                </button>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  onCanPlay={handleVideoCanPlay}
                  className={`absolute inset-0 w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
                {/* AR Mask Overlay (Inverted Cutout) */}
                <div className="absolute inset-0 pointer-events-none">
                  <svg className="w-full h-full" viewBox="0 0 100 200" preserveAspectRatio="none">
                    <path
                      d={`M0 0 H100 V200 H0 Z ${mode === 'front' ? PATH_FRONT : PATH_SIDE}`}
                      fill="rgba(0, 0, 0, 0.65)" 
                      fillRule="evenodd"
                    />
                    
                    <path 
                      d={mode === 'front' ? PATH_FRONT : PATH_SIDE}
                      fill="none" 
                      stroke="white" 
                      strokeWidth="0.8"
                      strokeDasharray="4 2"
                      className="drop-shadow-md"
                    />
                    
                    <line 
                      x1="50" y1="0" 
                      x2="50" y2="200" 
                      stroke="rgba(255,255,255,0.4)" 
                      strokeWidth="0.5" 
                      strokeDasharray="2 2" 
                    />
                  </svg>
                </div>

                {/* Instruction Text Overlay */}
                <div className="absolute bottom-32 left-0 right-0 text-center z-20">
                  <span className="inline-block bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-bold border border-white/10 shadow-lg">
                     {mode === 'front' ? 'Align body inside the shape' : 'Align side profile inside the shape'}
                  </span>
                </div>

                {/* Countdown */}
                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-30">
                    <div className="text-9xl font-bold text-white animate-pulse">
                      {countdown}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* --- UPLOAD VIEW --- */}
        {captureMethod === 'upload' && (
          <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 overflow-y-auto">
            
            {!uploadedImage ? (
              <div className="max-w-md w-full space-y-6 mt-12">
                {/* Reference Guide */}
                <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl">
                   <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-3">
                      <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
                        <ImageIcon size={20} />
                      </div>
                      <div>
                        <h3 className="text-white font-bold">Reference Pose</h3>
                        <p className="text-xs text-slate-400">Match this sample exactly</p>
                      </div>
                   </div>
                   
                   <div className="flex gap-6">
                      <div className="w-32 h-48 bg-slate-900 rounded-lg border border-slate-600 relative overflow-hidden">
                         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-900"></div>
                         <svg viewBox="0 0 86 200" className="h-full w-full p-2 relative z-10">
                            {mode === 'front' ? <MannequinFront /> : <MannequinSide />}
                         </svg>
                         <div className="absolute bottom-2 left-0 right-0 text-center">
                            <span className="text-[10px] font-bold bg-black/50 text-white px-2 py-1 rounded-full border border-white/10">
                              {mode === 'front' ? 'A-POSE' : 'SIDE PROFILE'}
                            </span>
                         </div>
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-center space-y-3">
                        <div>
                           <h4 className="text-slate-200 font-bold text-sm mb-1">Required Position</h4>
                           <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
                            {mode === 'front' ? (
                              <>
                                <li>Arms 45° away from body</li>
                                <li>Feet shoulder-width apart</li>
                                <li>Wear fitted clothing</li>
                                <li>Entire body in frame</li>
                              </>
                            ) : (
                              <>
                                <li>Stand perfectly sideways</li>
                                <li>Arms relaxed at sides</li>
                                <li>Feet together</li>
                                <li>Look straight ahead</li>
                              </>
                            )}
                           </ul>
                        </div>
                      </div>
                   </div>
                </div>

                {/* Upload Area */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative border-2 border-dashed border-slate-600 hover:border-blue-500 bg-slate-800/30 hover:bg-slate-800 rounded-2xl p-8 text-center cursor-pointer transition-all"
                >
                  <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                  <div className="w-14 h-14 bg-slate-700 group-hover:bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 transition-colors text-white shadow-lg">
                    <Upload size={28} />
                  </div>
                  <p className="text-white font-bold text-lg">Upload {mode === 'front' ? 'Front' : 'Side'} Photo</p>
                  <p className="text-slate-400 text-sm mt-1">Tap to browse gallery</p>
                </div>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in">
                <div className="relative max-h-[65vh] w-full max-w-lg rounded-lg overflow-hidden shadow-2xl border border-slate-700 bg-black">
                  <img src={uploadedImage} alt="Preview" className="w-full h-full object-contain" />
                  <button 
                    onClick={() => setUploadedImage(null)}
                    className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-full hover:bg-red-600 transition-colors backdrop-blur-sm"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="mt-6 flex flex-col w-full max-w-xs gap-3">
                  <button 
                    onClick={confirmUpload}
                    className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                  >
                    <Check size={20} /> Use This Photo
                  </button>
                  <button 
                    onClick={() => setUploadedImage(null)}
                    className="w-full py-3.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700"
                  >
                    Choose Different Photo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- HELP OVERLAY --- */}
        {showGuide && (
          <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md p-6 flex items-center justify-center animate-fade-in">
            <div className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 relative shadow-2xl">
               <button 
                onClick={() => setShowGuide(false)} 
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={24} />
              </button>
              
              <h3 className="text-xl font-bold text-white mb-1 text-center">Pose Guide</h3>
              <p className="text-slate-400 text-xs text-center mb-6">Follow the mannequin exactly</p>
              
              <div className="flex justify-center mb-6">
                <div className="w-40 h-64 bg-slate-800 rounded-2xl border border-slate-600 relative overflow-hidden shadow-inner">
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 to-black"></div>
                  <svg viewBox="0 0 86 200" className="w-full h-full p-4 relative z-10">
                    {mode === 'front' ? <MannequinFront /> : <MannequinSide />}
                  </svg>
                  
                  {/* Dimensions / Lines overlay decoration */}
                  <div className="absolute top-4 left-2 w-2 h-[1px] bg-blue-500"></div>
                  <div className="absolute top-4 left-2 h-full w-[1px] bg-blue-500/30"></div>
                  <div className="absolute bottom-4 right-2 w-2 h-[1px] bg-blue-500"></div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3 items-start bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <div className="mt-0.5 bg-green-500/20 text-green-400 p-1.5 rounded-lg">
                    <Check size={16} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Correct Posture</h4>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                      {mode === 'front' 
                        ? "Stand tall. Arms out at 45° (A-Pose). Feet shoulder-width apart. Wear tight clothes."
                        : "Stand sideways. Feet together. Arms relaxed naturally at your side."}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 items-start bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <div className="mt-0.5 bg-blue-500/20 text-blue-400 p-1.5 rounded-lg">
                    <Camera size={16} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Camera Position</h4>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                      Phone at waist height, held vertically. Ensure even lighting and no shadows.
                    </p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowGuide(false)}
                className="w-full mt-6 bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
              >
                I Understand
              </button>
            </div>
          </div>
        )}

      </div>

      {/* --- Footer Controls (Only for Camera Mode) --- */}
      {captureMethod === 'camera' && (
        <div className="bg-slate-900 p-8 pb-12 flex justify-center items-center gap-8 z-20 border-t border-slate-800">
          <button 
            onClick={toggleCamera}
            className="p-4 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-all"
          >
            <SwitchCamera size={24} />
          </button>

          <button 
            onClick={startCaptureSequence}
            disabled={countdown !== null}
            className={`
              w-20 h-20 rounded-full border-4 border-white flex items-center justify-center
              transition-all transform active:scale-95 shadow-lg shadow-blue-900/50
              ${countdown !== null ? 'bg-red-500 border-red-300' : 'bg-blue-600 border-white hover:bg-blue-500'}
            `}
          >
            <Camera size={32} className="text-white" />
          </button>
          
          <div className="w-14"></div> 
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
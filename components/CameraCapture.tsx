import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Camera, Volume2, VolumeX, Upload, Image as ImageIcon, X, Check, Info, AlertTriangle, SwitchCamera, Timer } from 'lucide-react';
import { CaptureMetadata } from '../types';
import { logger } from '../services/logger';

interface Props {
  onCapture: (imageBase64: string, metadata: CaptureMetadata) => void;
  onBack: () => void;
  mode: 'front' | 'side';
}

const SHUTTER_SOUND = "data:audio/wav;base64,UklGRi5AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQBAAAAA/v///wAAAAAAAAAAAA==";

// Flat 2D "Ghost" Silhouette (No Perspective, Proportional Scaling)
const PATH_FRONT = "M50 10 A 11 11 0 1 1 50 32 A 11 11 0 1 1 50 10 Z M32 40 L68 40 L85 85 L78 88 L62 60 L62 95 L64 185 L54 185 L53 105 L47 105 L46 185 L36 185 L38 95 L38 60 L22 88 L15 85 Z";

// Side view - symmetric/generic profile (facing either way)
// Centered at x=50. Symmetric shape representing side profile thickness without directional features like nose/feet direction.
const PATH_SIDE = "M50 10 Q62 10 62 22 Q62 34 56 37 L58 42 Q64 50 62 75 Q61 110 61 120 L59 185 L62 192 L38 192 L41 185 L39 120 Q39 110 38 75 Q36 50 42 42 L44 37 Q38 34 38 22 Q38 10 50 10 Z";
const PATH_SIDE_ARM = "M47 45 L53 45 L54 105 L46 105 Z";

export const CameraCapture: React.FC<Props> = ({ onCapture, onBack, mode }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
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
  const [flash, setFlash] = useState(false);

  // Upload State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Help/Guide State
  const [showGuide, setShowGuide] = useState(false);

  // Mount tracking
  useEffect(() => {
    isMountedRef.current = true;
    logger.info(`Camera component mounted for ${mode} view`, { captureMethod, facingMode });
    
    // Initialize Audio Context on mount (requires interaction to unlock usually, but good to prep)
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContext();

    return () => {
      isMountedRef.current = false;
      window.speechSynthesis.cancel();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      logger.info(`Camera component unmounted`);
    };
  }, [mode]);

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
  // Audio Logic
  // ----------------------------------------------------------------------

  const resumeAudioContext = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  const playBeep = useCallback((frequency = 800, type: OscillatorType = 'sine', duration = 0.1) => {
    if (!audioEnabled || !audioContextRef.current) return;
    
    resumeAudioContext();
    
    const osc = audioContextRef.current.createOscillator();
    const gain = audioContextRef.current.createGain();
    
    osc.connect(gain);
    gain.connect(audioContextRef.current.destination);
    
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + duration);
    
    osc.start();
    osc.stop(audioContextRef.current.currentTime + duration);
  }, [audioEnabled, resumeAudioContext]);

  const playShutterSound = useCallback(() => {
    if (!audioEnabled) return;
    
    // Play a generated 'camera click' sound which is more reliable than loading external files
    if (audioContextRef.current) {
      resumeAudioContext();
      const t = audioContextRef.current.currentTime;
      const osc = audioContextRef.current.createOscillator();
      const gain = audioContextRef.current.createGain();
      
      osc.connect(gain);
      gain.connect(audioContextRef.current.destination);
      
      // Simulating a mechanical shutter noise with noise buffer would be complex, 
      // sticking to a high-freq crisp beep followed by a low thud.
      
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
      
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      
      osc.start(t);
      osc.stop(t + 0.15);
    }
  }, [audioEnabled, resumeAudioContext]);

  const speak = useCallback((text: string, force = false): Promise<void> => {
    if (!audioEnabled && !force) return Promise.resolve();

    return new Promise((resolve) => {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0; 
      utterance.pitch = 1.1; // Slightly higher pitch is clearer
      utterance.volume = 1.0;
      
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve(); // Always resolve
      
      if (isMountedRef.current) {
        window.speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    });
  }, [audioEnabled]);

  // ----------------------------------------------------------------------
  // Camera Logic
  // ----------------------------------------------------------------------

  const startCamera = useCallback(async () => {
    if (captureMethod !== 'camera') return;

    logger.info("Initializing camera", { facingMode });

    // Clean up previous stream
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      streamRef.current = null;
    }

    try {
      // Prioritize "environment" (rear) camera as it's higher quality for body scans
      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode: facingMode,
          width: { ideal: 3840 }, 
          height: { ideal: 2160 },
          // @ts-ignore
          focusMode: 'continuous' 
        } 
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!isMountedRef.current) {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }

      // Try advanced focus
      const videoTrack = mediaStream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
      const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};

      logger.info("Camera started successfully", { 
        label: videoTrack.label, 
        width: settings.width, 
        height: settings.height,
        capabilities 
      });

      if (typeof videoTrack.getCapabilities === 'function') {
        // @ts-ignore
        if (capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
          try {
            // @ts-ignore
            await videoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          } catch (e) { console.log(e) }
        }
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err: any) {
      logger.error("Camera access failed", { error: err.message, name: err.name });
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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setStream(null);
      }
      setIsCameraReady(false);
    }
  }, [captureMethod, startCamera]);

  const handleVideoCanPlay = () => {
    setIsCameraReady(true);
  };

  const toggleCamera = () => {
    logger.info("Toggling camera facing mode");
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    setCountdown(null);
    window.speechSynthesis.cancel();
    sequenceStartedRef.current = false;
  };

  const takePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current && isMountedRef.current) {
      logger.info("Taking photo");

      // 1. Audio Feedback
      playShutterSound();
      
      // 2. Visual Feedback (Flash)
      setFlash(true);
      setTimeout(() => setFlash(false), 300);

      setCountdown(null);
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
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
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.95);
        
        // Metadata
        let deviceLabel = 'unknown';
        if (streamRef.current) {
          const track = streamRef.current.getVideoTracks()[0];
          if (track) deviceLabel = track.label;
        }

        const metadata: CaptureMetadata = {
          method: 'camera',
          facingMode: facingMode,
          deviceLabel: deviceLabel,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          screenResolution: `${window.screen.width}x${window.screen.height}`,
        };
        
        logger.info("Photo captured and processed", { resolution: `${canvas.width}x${canvas.height}` });

        // Small delay to allow flash to render before moving on
        setTimeout(() => {
          onCapture(imageBase64, metadata);
        }, 400);
      }
    }
  }, [onCapture, playShutterSound, facingMode]);

  const startCaptureSequence = useCallback(async () => {
    if (sequenceStartedRef.current) return;
    sequenceStartedRef.current = true;
    logger.info("Starting capture sequence", { duration: 10 });
    resumeAudioContext(); // Ensure audio is unlocked

    // --- PHASE 1: PREPARATION ---
    const prepDuration = 10; // Give them 10 seconds to walk back
    setCountdown(prepDuration);

    if (mode === 'front') {
      await speak("Place phone at waist height. Step back. Face camera. Arms out.");
    } else {
      await speak("Turn 90 degrees left. Arms by side. Look straight ahead.");
    }
    
    if (!isMountedRef.current) return;

    // --- PHASE 2: COUNTDOWN ---
    let remaining = prepDuration;
    
    // We use a recursive timeout pattern for better control than setInterval with async speech
    const tick = async () => {
      if (!isMountedRef.current) return;
      
      setCountdown(remaining);
      
      if (remaining > 3) {
        // Just a beep for early countdown
        playBeep(800, 'sine', 0.1); 
      } else if (remaining > 0) {
        // Voice for 3, 2, 1
        playBeep(1200, 'square', 0.1); // High pitch alert
        if (remaining === 3) speak("Three");
        if (remaining === 2) speak("Two");
        if (remaining === 1) speak("One");
      } else if (remaining === 0) {
        // Final moment
        await speak("Hold still");
        if (!isMountedRef.current) return;
        takePhoto();
        sequenceStartedRef.current = false;
        return; // Stop recursion
      }

      remaining--;
      setTimeout(tick, 1000);
    };

    tick();

  }, [mode, speak, takePhoto, playBeep, resumeAudioContext]);

  // Auto-start side mode if requested logic is active (optional, currently manual start is safer for audio)
  
  // ----------------------------------------------------------------------
  // Upload Logic
  // ----------------------------------------------------------------------

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      logger.info("File uploaded by user", { size: file.size, type: file.type });
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmUpload = () => {
    if (uploadedImage) {
       logger.info("User confirmed uploaded image");
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
  // Visual Assets
  // ----------------------------------------------------------------------

  const MannequinFront = () => (
    <g>
      <path d={PATH_FRONT} fill="#94a3b8" />
      <line x1="50" y1="10" x2="50" y2="190" stroke="#f97316" strokeWidth="1" strokeDasharray="4 2" />
    </g>
  );

  const MannequinSide = () => (
    <g>
      <path d={PATH_SIDE} fill="#94a3b8" />
      <path d={PATH_SIDE_ARM} fill="#64748b" />
      <line x1="50" y1="12" x2="50" y2="190" stroke="#f97316" strokeWidth="1" strokeDasharray="4 2" />
    </g>
  );

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col z-50">
      
      {/* Flash Overlay */}
      <div className={`absolute inset-0 z-[100] bg-white pointer-events-none transition-opacity duration-300 ${flash ? 'opacity-100' : 'opacity-0'}`} />

      {/* --- Header --- */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="pointer-events-auto flex gap-2">
          <button onClick={onBack} className="text-white p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all">
            <ArrowLeft size={24} />
          </button>
          
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
                
                {/* AR Mask Overlay - "Positive" Ghost Style */}
                <div className="absolute inset-0 pointer-events-none">
                  <svg className="w-full h-full" viewBox="0 0 100 200" preserveAspectRatio="xMidYMid meet">
                    <path 
                      d={mode === 'front' ? PATH_FRONT : PATH_SIDE}
                      fill="rgba(255, 255, 255, 0.25)" 
                      stroke="rgba(255, 255, 255, 0.9)" 
                      strokeWidth="0.8"
                      className="drop-shadow-lg"
                    />
                    {mode === 'side' && (
                       <path 
                         d={PATH_SIDE_ARM} 
                         fill="rgba(255, 255, 255, 0.25)" 
                         stroke="rgba(255, 255, 255, 0.9)" 
                         strokeWidth="0.8" 
                       />
                    )}
                  </svg>
                </div>

                {/* Status / Instructions */}
                <div className="absolute bottom-32 left-0 right-0 text-center z-20 px-4">
                  {countdown === null ? (
                     <div className="inline-block bg-black/60 backdrop-blur-md text-white px-6 py-3 rounded-2xl border border-white/10 shadow-lg">
                        <p className="font-bold text-lg mb-1">{mode === 'front' ? 'Front A-Pose' : 'Side Profile'}</p>
                        <p className="text-sm text-slate-300">
                          {mode === 'front' ? 'Arms out 45°. Feet shoulder width.' : 'Turn 90°. Arms by sides.'}
                        </p>
                     </div>
                  ) : (
                     <div className="inline-block bg-blue-600/90 backdrop-blur-md text-white px-8 py-4 rounded-2xl shadow-xl animate-pulse">
                        <p className="text-xs font-bold uppercase tracking-widest mb-1">Get in position</p>
                        <p className="text-4xl font-black">{countdown}</p>
                     </div>
                  )}
                </div>

                {/* Big Center Countdown */}
                {countdown !== null && countdown <= 3 && countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-30">
                    <div className="text-[12rem] font-black text-white drop-shadow-2xl animate-bounce">
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
                 <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer bg-slate-800 p-8 rounded-2xl border-2 border-dashed border-slate-600 hover:border-blue-500 text-center transition-all">
                    <Upload size={48} className="mx-auto text-slate-400 mb-4" />
                    <p className="text-white font-bold">Select Photo</p>
                    <p className="text-slate-400 text-sm">Tap to browse</p>
                 </div>
                 <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center">
                 <img src={uploadedImage} alt="Preview" className="max-h-[70vh] object-contain mb-4" />
                 <div className="flex gap-4">
                    <button onClick={confirmUpload} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold">Use Photo</button>
                    <button onClick={() => setUploadedImage(null)} className="bg-slate-700 text-white px-8 py-3 rounded-xl">Retry</button>
                 </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* --- Footer Controls --- */}
      {captureMethod === 'camera' && (
        <div className="bg-slate-900 p-8 pb-12 flex justify-center items-center gap-8 z-20 border-t border-slate-800">
          <button onClick={toggleCamera} className="p-4 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-all">
            <SwitchCamera size={24} />
          </button>

          <button 
            onClick={startCaptureSequence}
            disabled={countdown !== null}
            className={`
              w-24 h-24 rounded-full border-4 border-white flex flex-col items-center justify-center
              transition-all transform active:scale-95 shadow-lg shadow-blue-900/50
              ${countdown !== null ? 'bg-red-500 border-red-300' : 'bg-blue-600 border-white hover:bg-blue-500'}
            `}
          >
            {countdown !== null ? (
               <span className="text-2xl font-bold text-white">{countdown}</span>
            ) : (
               <>
                 <Camera size={32} className="text-white mb-1" />
                 <span className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Start</span>
               </>
            )}
          </button>
          
          <button 
             onClick={() => setShowGuide(true)}
             className="p-4 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
          >
            <Info size={24} />
          </button>
        </div>
      )}

      {/* Hidden Canvas for Capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* --- Help Overlay --- */}
      {showGuide && (
         <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md p-6 flex items-center justify-center animate-fade-in">
            <div className="max-w-sm w-full bg-slate-900 rounded-3xl p-6 relative">
               <button onClick={() => setShowGuide(false)} className="absolute top-4 right-4 text-white"><X /></button>
               <h3 className="text-xl font-bold text-white mb-4 text-center">How to Capture</h3>
               <div className="flex justify-center mb-6">
                  <div className="w-32 h-48 bg-slate-800 rounded-lg p-2 border border-slate-700">
                     <svg viewBox="0 0 100 200" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                        {mode === 'front' ? <MannequinFront /> : <MannequinSide />}
                     </svg>
                  </div>
               </div>
               <ul className="text-slate-300 text-sm space-y-3 list-disc pl-5">
                  <li>Use the <b>Timer</b> to get in position.</li>
                  <li>Wait for the <b>Beeps</b> and Voice countdown.</li>
                  <li>Stand back until your whole body fits the frame.</li>
                  <li>Hold still when you hear "One".</li>
               </ul>
               <button onClick={() => setShowGuide(false)} className="w-full mt-6 bg-blue-600 py-3 rounded-xl text-white font-bold">Got it</button>
            </div>
         </div>
      )}
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { AppStep, UserStats, MeasurementResult, CaptureMetadata } from './types';
import { StatsForm } from './components/StatsForm';
import { CameraCapture } from './components/CameraCapture';
import { ResultsView } from './components/ResultsView';
import { SettingsModal } from './components/SettingsModal'; 
import { AdminDashboard } from './components/AdminDashboard';
import { analyzeBodyMeasurements } from './services/geminiService';
import { ScanLine, ArrowRight, Activity, Settings } from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.Intro);
  const [stats, setStats] = useState<UserStats | null>(null);
  
  // Model Config State
  const [activeModel, setActiveModel] = useState<string>('gemini-3-pro-preview');

  // Capture State
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [frontMeta, setFrontMeta] = useState<CaptureMetadata | null>(null);
  
  const [sideImage, setSideImage] = useState<string | null>(null);
  const [sideMeta, setSideMeta] = useState<CaptureMetadata | null>(null);

  const [results, setResults] = useState<MeasurementResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); 

  // Load preferred model from local storage on mount
  useEffect(() => {
    const savedModel = localStorage.getItem('fit_twin_model_preference');
    if (savedModel) {
      setActiveModel(savedModel);
    }
  }, []);

  const handleModelChange = (model: string) => {
    setActiveModel(model);
    localStorage.setItem('fit_twin_model_preference', model);
  };

  const handleStatsSubmit = (data: UserStats) => {
    setStats(data);
    setStep(AppStep.CameraFront);
  };

  const handleFrontCapture = (image: string, meta: CaptureMetadata) => {
    setFrontImage(image);
    setFrontMeta(meta);
    setStep(AppStep.CameraSide);
  };

  const handleSideCapture = async (image: string, meta: CaptureMetadata) => {
    setSideImage(image);
    setSideMeta(meta);
    setStep(AppStep.Processing);
    setLoading(true);

    try {
      if (stats && frontImage && frontMeta) {
        // Analyze with Gemini (now including enhanced fields and active model)
        console.log(`Analyzing with model: ${activeModel}`);
        const analysis = await analyzeBodyMeasurements(frontImage, image, stats, activeModel);
        setResults(analysis);
        setStep(AppStep.Results);
      } else {
        throw new Error("Missing front image or stats");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to analyze images. Please try again.");
      setStep(AppStep.CameraFront); // Restart capture process
      setFrontImage(null);
      setSideImage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(AppStep.Intro);
    setStats(null);
    setFrontImage(null);
    setSideImage(null);
    setResults(null);
  };

  // Special route for Admin
  if (step === AppStep.Admin) {
    return <AdminDashboard onBack={() => setStep(AppStep.Intro)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 print:hidden">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 cursor-pointer" onClick={() => setStep(AppStep.Intro)}>
            <ScanLine size={28} strokeWidth={2.5} />
            <span className="font-bold text-xl tracking-tight text-slate-900">Fit <span className="text-blue-600">Twin</span></span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
              <span className={step === AppStep.Stats ? 'text-blue-600' : ''}>1. Profile</span>
              <span className={step === AppStep.CameraFront || step === AppStep.CameraSide ? 'text-blue-600' : ''}>2. Capture</span>
              <span className={step === AppStep.Results ? 'text-blue-600' : ''}>3. Results</span>
            </div>

            {/* Settings Button */}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all"
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onNavigateToAdmin={() => {
          setIsSettingsOpen(false);
          setStep(AppStep.Admin);
        }}
        currentModel={activeModel}
        onModelChange={handleModelChange}
      />

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-8">
        
        {/* STEP 0: INTRO */}
        {step === AppStep.Intro && (
          <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold border border-blue-100">
              <Activity size={16} /> AI-Powered Photogrammetry
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Body measurements <br/> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500">
                from two photos.
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Get accurate tailoring measurements in seconds. No measuring tape required. Just stand (Front & Side), snap, and let our Gemini Vision AI analyze your geometry.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-12 text-left">
              {[
                { title: 'Calibrate', desc: 'Input your height and weight to set the ground truth scale.' },
                { title: 'Capture', desc: 'Take two photos (Front & Side) using our guided silhouette camera.' },
                { title: 'Measure', desc: 'AI calculates skeletal structure, body volume, and fit concerns.' }
              ].map((item, i) => (
                <div key={i} className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold mb-4">
                    {i + 1}
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-500 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-4">
              <button 
                onClick={() => setStep(AppStep.Stats)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xl font-bold py-5 px-10 rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex items-center gap-3 mx-auto"
              >
                Start Measurement <ArrowRight />
              </button>
              
              <div className="text-xs text-slate-400 font-medium">
                Using Model: <span className="text-slate-600 font-bold">{activeModel}</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: STATS */}
        {step === AppStep.Stats && (
          <div className="w-full max-w-md animate-fade-in-up">
             <StatsForm onNext={handleStatsSubmit} />
          </div>
        )}

        {/* STEP 2A: CAMERA FRONT */}
        {step === AppStep.CameraFront && (
          <div className="w-full animate-fade-in">
            <CameraCapture 
              mode="front"
              onCapture={handleFrontCapture} 
              onBack={() => setStep(AppStep.Stats)} 
            />
          </div>
        )}

        {/* STEP 2B: CAMERA SIDE */}
        {step === AppStep.CameraSide && (
          <div className="w-full animate-fade-in">
            <CameraCapture 
              mode="side"
              onCapture={handleSideCapture} 
              onBack={() => {
                setFrontImage(null);
                setStep(AppStep.CameraFront);
              }} 
            />
          </div>
        )}

        {/* STEP 3: PROCESSING */}
        {step === AppStep.Processing && (
          <div className="text-center animate-pulse">
             <div className="w-24 h-24 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-8"></div>
             <h2 className="text-2xl font-bold text-slate-900">Analyzing Geometry...</h2>
             <p className="text-slate-500 mt-2 mb-4">Processing Front and Side views with Gemini Reasoning.</p>
             <span className="inline-block px-3 py-1 bg-slate-200 rounded-full text-xs font-bold text-slate-600">
               Running on {activeModel}
             </span>
             <div className="mt-8 max-w-xs mx-auto bg-slate-200 h-2 rounded-full overflow-hidden">
               <div className="h-full bg-blue-600 animate-[width_2s_ease-in-out_infinite]" style={{width: '60%'}}></div>
             </div>
          </div>
        )}

        {/* STEP 4: RESULTS */}
        {step === AppStep.Results && results && stats && frontImage && sideImage && (
          <div className="w-full flex flex-col items-center">
            <ResultsView 
              results={results} 
              stats={stats} 
              onReset={handleReset} 
              image={frontImage} 
              sideImage={sideImage}
              frontMeta={frontMeta}
              sideMeta={sideMeta}
            />
          </div>
        )}

      </main>

      <footer className="py-6 text-center text-slate-400 text-sm print:hidden">
        &copy; 2025 Fit Twin. Powered by Google Gemini.
      </footer>
    </div>
  );
};

export default App;
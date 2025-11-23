import React, { useRef, useEffect, useState } from 'react';
import { MeasurementResult, UserStats } from '../types';
import { Share2, RefreshCcw, AlertCircle, CheckCircle2, Download, FileDown, Box, CloudUpload, Printer, Globe, Brain, Terminal, ChevronDown, ChevronUp, Ruler, Gauge, AlertTriangle, Cpu } from 'lucide-react';
import { BodyVisualizer, BodyVisualizerHandle } from './BodyVisualizer';
import { AuthForm } from './AuthForm';
import { getUser, saveScanResult } from '../services/supabaseService';

interface Props {
  results: MeasurementResult;
  stats: UserStats;
  onReset: () => void;
  image: string;
  frontMeta: any;
  sideMeta: any;
  sideImage: string;
}

export const ResultsView: React.FC<Props> = ({ results, stats, onReset, image, sideImage, frontMeta, sideMeta }) => {
  const visualizerRef = useRef<BodyVisualizerHandle>(null);
  const printImageRef = useRef<HTMLImageElement>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const user = await getUser();
    setIsLoggedIn(!!user);
  };

  const handleSaveToCloud = async () => {
    if (!isLoggedIn) {
      setShowAuth(true);
      return;
    }
    
    setSaveStatus('saving');
    
    let objBlob = null;
    let usdzBlob = null;
    
    if (visualizerRef.current) {
      objBlob = await visualizerRef.current.getOBJBlob();
      usdzBlob = await visualizerRef.current.getUSDZBlob();
    }

    const result = await saveScanResult(
      stats, 
      results, 
      { front: image, side: sideImage },
      { front: frontMeta, side: sideMeta },
      { objBlob, usdzBlob }
    );

    if (result) {
      setSaveStatus('saved');
    } else {
      setSaveStatus('error');
    }
  };

  const formatValue = (val: number | undefined) => {
    if (val === undefined) return { inches: "--", cm: "--" };
    const inches = (val / 2.54).toFixed(1);
    const cm = val.toFixed(1);
    return { inches, cm };
  };

  const HighlightMetric = ({ label, value, subLabel }: { label: string, value: number | undefined, subLabel?: string }) => {
    const { inches, cm } = formatValue(value);
    return (
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</span>
        <div className="text-3xl font-extrabold text-slate-900 leading-none">
          {inches}<span className="text-base font-medium text-slate-400">"</span>
        </div>
        <div className="text-xs text-slate-400 font-medium mt-1">{cm} cm</div>
        {subLabel && <div className="mt-2 text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{subLabel}</div>}
      </div>
    );
  };

  const MeasurementRow = ({ label, value }: { label: string, value: number }) => {
    const { inches, cm } = formatValue(value);
    return (
      <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 px-2 rounded transition-colors">
        <span className="text-slate-600 font-medium text-sm">{label}</span>
        <div className="text-right">
          <span className="text-slate-900 font-bold">{inches}"</span> <span className="text-slate-400 text-xs">/ {cm}cm</span>
        </div>
      </div>
    );
  };

  // Quality Indicator Component
  const QualityBar = ({ label, score }: { label: string, score: number }) => (
    <div className="mb-2">
      <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1">
        <span>{label}</span>
        <span>{score}/10</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`h-full ${score > 7 ? 'bg-green-500' : score > 4 ? 'bg-amber-500' : 'bg-red-500'}`} 
          style={{ width: `${score * 10}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-in pb-12 print:pb-0 relative px-4">
      {/* Auth Overlay */}
      {showAuth && !isLoggedIn && (
        <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center h-screen fixed">
           <div className="relative">
             <button onClick={() => setShowAuth(false)} className="absolute -top-2 -right-2 bg-slate-200 rounded-full p-1 hover:bg-slate-300">
               <span className="sr-only">Close</span>
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
             </button>
             <AuthForm onAuthSuccess={() => { setIsLoggedIn(true); setShowAuth(false); handleSaveToCloud(); }} />
           </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-slate-900">Analysis Complete</h2>
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold border border-green-200">
              {results.confidence}% Confidence
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <p className="text-slate-500">
              {results.body_shape ? `Identified Body Shape: ${results.body_shape}` : 'Measurements derived from Gemini Vision Analysis'}
            </p>
            {results.model_name && (
              <span className="hidden sm:inline text-slate-300">|</span>
            )}
            {results.model_name && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit">
                 <Cpu size={12} /> {results.model_name}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3 no-print">
          <button onClick={onReset} className="px-4 py-2 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
            <RefreshCcw size={16} /> New Scan
          </button>
          <button onClick={handleSaveToCloud} disabled={saveStatus === 'saving' || saveStatus === 'saved'} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-white shadow-md transition-all ${saveStatus === 'saved' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {saveStatus === 'saved' ? <CheckCircle2 size={16} /> : <CloudUpload size={16} />}
            {saveStatus === 'saved' ? 'Saved' : 'Save Results'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: VISUALIZER (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden relative">
              <div className="h-[500px] w-full bg-slate-50">
                 <BodyVisualizer ref={visualizerRef} measurements={results} stats={stats} />
              </div>
              
              {/* Controls */}
              <div className="p-4 border-t border-slate-100 bg-white grid grid-cols-2 gap-2">
                <button onClick={() => visualizerRef.current?.downloadGLB()} className="flex items-center justify-center gap-2 p-2 rounded-lg border hover:bg-slate-50 text-xs font-bold text-slate-600"><Globe size={14} /> GLB</button>
                <button onClick={() => visualizerRef.current?.downloadUSDZ()} className="flex items-center justify-center gap-2 p-2 rounded-lg border hover:bg-slate-50 text-xs font-bold text-slate-600"><Box size={14} /> USDZ</button>
                <button onClick={() => visualizerRef.current?.downloadSTL()} className="flex items-center justify-center gap-2 p-2 rounded-lg border hover:bg-slate-50 text-xs font-bold text-slate-600"><Printer size={14} /> STL</button>
                <button onClick={() => visualizerRef.current?.downloadPng()} className="flex items-center justify-center gap-2 p-2 rounded-lg border hover:bg-slate-50 text-xs font-bold text-slate-600"><FileDown size={14} /> PNG</button>
              </div>
           </div>

           {/* Stylist Note */}
           {results.notes && (
             <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl text-blue-900 text-sm leading-relaxed shadow-sm">
               <h4 className="font-bold flex items-center gap-2 mb-2"><Brain size={16} /> AI Stylist Assessment</h4>
               {results.notes}
             </div>
           )}
        </div>

        {/* MIDDLE COLUMN: KEY METRICS (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           {/* Highlights */}
           <div className="grid grid-cols-2 gap-4">
              <HighlightMetric label="Chest" value={results.chest} subLabel={results.percentiles?.chest ? `Top ${100 - results.percentiles.chest}%` : undefined} />
              <HighlightMetric label="Waist" value={results.waist} subLabel={results.percentiles?.waist ? `Top ${100 - results.percentiles.waist}%` : undefined} />
              <HighlightMetric label="Hips" value={results.hips} subLabel={results.percentiles?.hips ? `Top ${100 - results.percentiles.hips}%` : undefined} />
              <HighlightMetric label="Shoulders" value={results.shoulder} />
           </div>

           {/* Detailed List */}
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-900 mb-4">Detailed Measurements</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Upper Body</h4>
                  <MeasurementRow label="Neck" value={results.neck} />
                  <MeasurementRow label="Sleeve Length" value={results.sleeve} />
                  <MeasurementRow label="Bicep" value={results.bicep} />
                  <MeasurementRow label="Wrist" value={results.wrist} />
                  {results.torso_length && <MeasurementRow label="Torso Length" value={results.torso_length} />}
                </div>
                
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 mt-4">Lower Body</h4>
                  <MeasurementRow label="Inseam" value={results.inseam} />
                  <MeasurementRow label="Outseam" value={results.outseam} />
                  <MeasurementRow label="Thigh" value={results.thigh} />
                  <MeasurementRow label="Calf" value={results.calf} />
                  <MeasurementRow label="Ankle" value={results.ankle} />
                </div>
              </div>
           </div>
        </div>

        {/* RIGHT COLUMN: INSIGHTS & DEBUG (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           
           {/* Fit Concerns */}
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertCircle size={20} className="text-amber-500" /> Fit Insights
              </h3>
              
              {results.fit_concerns && results.fit_concerns.length > 0 ? (
                <div className="space-y-3">
                  {results.fit_concerns.map((concern, idx) => (
                    <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                       <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-slate-800 text-sm">{concern.area}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            concern.severity === 'high' ? 'bg-red-100 text-red-600' : 
                            concern.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 
                            'bg-blue-100 text-blue-600'
                          }`}>{concern.severity}</span>
                       </div>
                       <p className="text-xs text-slate-600 mb-2">{concern.issue}</p>
                       <div className="text-xs text-slate-500 italic border-l-2 border-slate-300 pl-2">
                         "{concern.advice}"
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">No specific fit concerns identified.</p>
              )}
           </div>

           {/* Transparency / Debug Section */}
           <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-800">
              <button 
                onClick={() => setShowDebug(!showDebug)}
                className="w-full flex items-center justify-between p-4 text-white font-bold hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Terminal size={18} className="text-green-400" /> 
                  <span>Transparency Mode</span>
                </div>
                {showDebug ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              
              {showDebug && (
                <div className="p-4 bg-black/50 text-xs font-mono text-slate-300 border-t border-slate-800 max-h-[600px] overflow-y-auto">
                   
                   <div className="mb-4 text-xs">
                      <span className="text-slate-500">MODEL USED:</span> <span className="text-blue-400 font-bold">{results.model_name || 'Unknown'}</span>
                   </div>

                   {/* Quality Scorecard */}
                   {results.quality_assessment && (
                     <div className="mb-6 bg-slate-800/50 p-3 rounded-lg border border-white/5">
                        <h5 className="text-green-400 font-bold mb-3 flex items-center gap-2"><Gauge size={12}/> QUALITY SCORECARD</h5>
                        <QualityBar label="Overall Confidence" score={results.confidence / 10} />
                        <QualityBar label="Front Image Quality" score={results.quality_assessment.front_image_quality} />
                        <QualityBar label="Side Image Quality" score={results.quality_assessment.side_image_quality} />
                        <QualityBar label="Pose Consistency" score={results.quality_assessment.pose_consistency} />
                        
                        {results.quality_assessment.issues_detected && results.quality_assessment.issues_detected.length > 0 && (
                          <div className="mt-3 text-red-400">
                             <span className="font-bold text-[10px] uppercase">Detected Issues:</span>
                             <ul className="list-disc pl-4 mt-1">
                               {results.quality_assessment.issues_detected.map((issue, i) => (
                                 <li key={i}>{issue}</li>
                               ))}
                             </ul>
                          </div>
                        )}
                     </div>
                   )}

                   {/* Technical Analysis */}
                   {results.technical_analysis && (
                     <div className="mb-6">
                        <h5 className="text-green-400 font-bold mb-2 flex items-center gap-2"><Ruler size={12}/> INTERMEDIATE CALCULATIONS</h5>
                        
                        <div className="mb-2 pl-2 border-l border-slate-700">
                          <span className="block text-slate-500 font-bold">Scaling Factor</span>
                          <span className="block">{results.technical_analysis.scaling.cm_per_pixel.toFixed(4)} cm/pixel</span>
                          <span className="block text-[10px] text-slate-600">
                            (Real Height {results.technical_analysis.scaling.real_height_cm}cm / {results.technical_analysis.scaling.pixel_height}px)
                          </span>
                        </div>

                        {results.technical_analysis.formulas && Object.entries(results.technical_analysis.formulas).map(([key, formula]) => (
                          <div key={key} className="mb-2 pl-2 border-l border-slate-700">
                            <span className="block text-slate-500 font-bold capitalize">{key} Formula</span>
                            <span className="block text-[10px] text-amber-200">{formula}</span>
                            {results.technical_analysis?.raw_measurements?.[key] && (
                               <span className="block text-[10px] text-slate-500 mt-0.5">
                                 Width: {results.technical_analysis.raw_measurements[key].width_px}px | 
                                 Depth: {results.technical_analysis.raw_measurements[key].depth_px}px
                               </span>
                            )}
                          </div>
                        ))}
                     </div>
                   )}

                   {/* Token Usage */}
                   {results.usage_metadata && (
                     <div className="mb-6 p-2 bg-slate-800 rounded border border-slate-700 flex justify-between">
                        <div className="text-center">
                          <span className="block font-bold text-white">{results.usage_metadata.promptTokenCount}</span>
                          <span className="block text-[9px] text-slate-500 uppercase">Input Tokens</span>
                        </div>
                        <div className="text-center">
                          <span className="block font-bold text-white">{results.usage_metadata.candidatesTokenCount}</span>
                          <span className="block text-[9px] text-slate-500 uppercase">Output Tokens</span>
                        </div>
                        <div className="text-center">
                          <span className="block font-bold text-green-400">{results.usage_metadata.totalTokenCount}</span>
                          <span className="block text-[9px] text-slate-500 uppercase">Total Cost</span>
                        </div>
                     </div>
                   )}

                   {results.thought_summary && (
                     <div className="mb-4">
                       <h5 className="text-green-400 font-bold mb-1">// REASONING TRACE</h5>
                       <p className="whitespace-pre-wrap leading-relaxed text-slate-400">{results.thought_summary}</p>
                     </div>
                   )}

                   <div>
                     <h5 className="text-green-400 font-bold mb-1">// RAW JSON</h5>
                     <pre className="text-[10px] text-slate-500 overflow-x-auto">
                       {JSON.stringify(results, null, 2)}
                     </pre>
                   </div>
                </div>
              )}
           </div>

        </div>

      </div>
      
      {/* Hidden print element for 3D snapshot */}
      <div className="hidden print-only fixed top-0 left-0 w-full h-[500px] z-[-1]">
         <img ref={printImageRef} className="w-full h-full object-contain" alt="Model" />
      </div>
    </div>
  );
};
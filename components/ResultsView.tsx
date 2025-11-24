
import React, { useRef, useEffect, useState } from 'react';
import { MeasurementResult, UserStats } from '../types';
import { Share2, RefreshCcw, AlertCircle, CheckCircle2, Download, FileDown, Box, CloudUpload, Printer, Globe, Brain, Terminal, ChevronDown, ChevronUp, Ruler, Gauge, AlertTriangle, Cpu, Zap, Scan, Layers } from 'lucide-react';
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

    if (result.success) {
      setSaveStatus('saved');
    } else {
      setSaveStatus('error');
      // Show explicit error to user
      alert(`Save Failed: ${result.error?.message || "Unknown error"}. Check console for details.`);
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

  const isGemini25 = results.model_name?.includes('2.5');

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-in pb-12 print:pb-0 relative px-4">
      {/* Auth Overlay */}
      {showAuth && !isLoggedIn && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="relative w-full max-w-sm">
             <button 
               onClick={() => setShowAuth(false)} 
               className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors"
             >
               <span className="sr-only">Close</span>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
             </button>
             <AuthForm onAuthSuccess={() => { setIsLoggedIn(true); setShowAuth(false); handleSaveToCloud(); }} />
           </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-3xl font-bold text-slate-900">Analysis Complete</h2>
            
            {/* Prominent Model Badge */}
            {results.model_name && (
              <div className={`
                flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide border shadow-sm
                ${isGemini25 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200'}
              `}>
                 {isGemini25 ? <Zap size={14} fill="currentColor" /> : <Cpu size={14} />}
                 {results.model_name}
              </div>
            )}

            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold border border-green-200">
              {results.confidence}% Confidence
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <p className="text-slate-500">
              {results.body_shape ? `Identified Body Shape: ${results.body_shape}` : 'Measurements derived from Gemini Vision Analysis'}
            </p>
          </div>
        </div>

        <div className="flex gap-3 no-print">
          <button onClick={onReset} className="px-4 py-2 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
            <RefreshCcw size={16} /> New Scan
          </button>
          <button 
            onClick={handleSaveToCloud} 
            disabled={saveStatus === 'saving' || saveStatus === 'saved'} 
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-white shadow-md transition-all 
              ${saveStatus === 'saved' ? 'bg-green-600' : 
                saveStatus === 'error' ? 'bg-red-600 hover:bg-red-700' : 
                'bg-blue-600 hover:bg-blue-700'}`}
          >
            {saveStatus === 'saved' ? <CheckCircle2 size={16} /> : 
             saveStatus === 'error' ? <AlertCircle size={16} /> : 
             <CloudUpload size={16} />}
            {saveStatus === 'saved' ? 'Saved' : 
             saveStatus === 'error' ? 'Retry Save' : 
             'Save Results'}
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

                   {/* Logic Check */}
                   <div className="mb-6 bg-slate-800/50 p-3 rounded-lg border border-white/5">
                      <h5 className="text-green-400 font-bold mb-3 flex items-center gap-2"><Scan size={12}/> LOGIC CHECK</h5>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                         <div>
                            <span className="block text-slate-500">Provided Height</span>
                            <span className="block font-bold">{stats.height} cm</span>
                         </div>
                         <div>
                            <span className="block text-slate-500">AI Est. Height</span>
                            <span className={`block font-bold ${Math.abs((results.estimated_height_cm || 0) - stats.height) > 5 ? 'text-amber-400' : 'text-green-400'}`}>
                              {results.estimated_height_cm || 'N/A'} cm
                            </span>
                         </div>
                      </div>
                      <div className="text-slate-500 border-t border-white/10 pt-2 mt-2">
                         Scaling Factor: <span className="text-white">{results.scaling_factor?.toFixed(4)} px/cm</span>
                      </div>
                   </div>

                   {/* Reasoning Trace */}
                   {results.thought_summary && (
                     <div className="mb-6">
                       <h5 className="text-green-400 font-bold mb-1">// THOUGHT SUMMARY</h5>
                       <p className="whitespace-pre-wrap leading-relaxed text-slate-400 border-l-2 border-green-400/30 pl-3">{results.thought_summary}</p>
                     </div>
                   )}

                   {/* Landmarks Count */}
                   <div className="mb-6">
                      <h5 className="text-green-400 font-bold mb-1">// LANDMARKS DETECTED</h5>
                      <div className="flex gap-4 text-slate-400">
                         {/* Fallback to legacy check or new fields */}
                         <span>Front: {results.landmarks_front ? Object.keys(results.landmarks_front).length : (results.landmarks?.front ? Object.keys(results.landmarks.front).length : 0)} pts</span>
                         <span>Side: {results.landmarks_side ? Object.keys(results.landmarks_side).length : (results.landmarks?.side ? Object.keys(results.landmarks.side).length : 0)} pts</span>
                      </div>
                   </div>

                   {/* Token Usage */}
                   {results.usage_metadata && (
                     <div className="mb-6 p-2 bg-slate-800 rounded border border-slate-700 flex justify-between">
                        <div className="text-center">
                          <span className="block font-bold text-white">{results.usage_metadata.promptTokenCount}</span>
                          <span className="block text-[9px] text-slate-500 uppercase">Input</span>
                        </div>
                        <div className="text-center">
                          <span className="block font-bold text-white">{results.usage_metadata.candidatesTokenCount}</span>
                          <span className="block text-[9px] text-slate-500 uppercase">Output</span>
                        </div>
                        {/* Thinking tokens if available */}
                        {results.usage_metadata.thinkingTokenCount ? (
                          <div className="text-center">
                             <span className="block font-bold text-amber-400">{results.usage_metadata.thinkingTokenCount}</span>
                             <span className="block text-[9px] text-slate-500 uppercase">Thought</span>
                          </div>
                        ) : null}
                        <div className="text-center">
                          <span className="block font-bold text-green-400">{results.usage_metadata.totalTokenCount}</span>
                          <span className="block text-[9px] text-slate-500 uppercase">Total</span>
                        </div>
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

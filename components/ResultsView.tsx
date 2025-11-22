import React, { useRef } from 'react';
import { MeasurementResult, UserStats } from '../types';
import { Share2, RefreshCcw, AlertCircle, CheckCircle2, Download, FileDown, Box } from 'lucide-react';
import { BodyVisualizer, BodyVisualizerHandle } from './BodyVisualizer';

interface Props {
  results: MeasurementResult;
  stats: UserStats;
  onReset: () => void;
  image: string;
}

export const ResultsView: React.FC<Props> = ({ results, stats, onReset, image }) => {
  const visualizerRef = useRef<BodyVisualizerHandle>(null);
  const printImageRef = useRef<HTMLImageElement>(null);

  const handlePrint = () => {
    // Capture 3D canvas state to image before printing
    if (visualizerRef.current && printImageRef.current) {
      const canvas = visualizerRef.current.getCanvas();
      if (canvas) {
        printImageRef.current.src = canvas.toDataURL('image/png');
      }
    }
    // Small delay to allow image src to update
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const MeasurementRow = ({ label, value, color }: { label: string, value: number, color?: string }) => {
    const cm = value.toFixed(1);
    const inches = (value / 2.54).toFixed(1);
    
    return (
      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-blue-50 hover:border-blue-100 transition-colors group break-inside-avoid">
        <div className="flex items-center gap-2">
          {color && <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color }}></div>}
          <span className="text-slate-600 font-medium group-hover:text-blue-700">{label}</span>
        </div>
        <div className="text-right">
          <div className="font-bold text-slate-900 text-lg leading-none">
            {inches}<span className="text-xs text-slate-400 font-normal ml-0.5">in</span>
          </div>
          <div className="text-xs text-slate-400 font-medium mt-0.5">
            {cm} cm
          </div>
        </div>
      </div>
    );
  };

  // Map measurements to colors used in 3D view
  const colors = {
    neck: '#6366f1',    // Indigo
    chest: '#d946ef',   // Fuchsia
    waist: '#06b6d4',   // Cyan
    hips: '#eab308',    // Yellow
    thigh: '#64748b',   // Slate
    calf: '#3b82f6',    // Blue
    ankle: '#a16207',   // Brown
    bicep: '#15803d',   // Green
    wrist: '#f97316',   // Orange
    head: '#22c55e',    // Green
  };

  return (
    <div className="max-w-6xl mx-auto w-full animate-fade-in pb-12 print:pb-0 print:max-w-none">
      {/* Print Styles */}
      <style>{`
        @media print {
          @page { margin: 0.5cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>

      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row print:shadow-none print:border print:border-slate-200">
          
        {/* Visual Column (Left) */}
        <div className="relative w-full lg:w-1/2 bg-slate-50 border-r border-slate-100 flex flex-col print:w-1/2">
            
            {/* 3D Visualizer */}
            <div className="h-[500px] w-full relative no-print">
               <BodyVisualizer ref={visualizerRef} measurements={results} stats={stats} />
               
               {/* Overlay Controls */}
               <div className="absolute bottom-4 left-4 flex gap-2">
                  <button 
                    onClick={() => visualizerRef.current?.downloadObj()}
                    className="bg-white/90 backdrop-blur text-slate-700 p-2 rounded-lg shadow border border-slate-200 hover:bg-blue-50 transition-colors text-xs font-bold flex items-center gap-1"
                    title="Download 3D Model (.obj)"
                  >
                    <Box size={16} /> .OBJ
                  </button>
                  <button 
                    onClick={() => visualizerRef.current?.downloadPng()}
                    className="bg-white/90 backdrop-blur text-slate-700 p-2 rounded-lg shadow border border-slate-200 hover:bg-blue-50 transition-colors text-xs font-bold flex items-center gap-1"
                    title="Download Image (.png)"
                  >
                    <FileDown size={16} /> .PNG
                  </button>
               </div>
            </div>

            {/* Print-only static image replacement for the 3D canvas */}
            <div className="hidden print-only h-[500px] w-full">
               <img ref={printImageRef} className="w-full h-full object-contain" alt="3D Model Snapshot" />
            </div>

            <div className="p-6 border-t border-slate-200 bg-white">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Download size={20} className="text-blue-600" /> Downloads
                </h3>
                <div className="grid grid-cols-2 gap-3 no-print">
                   <button 
                    onClick={() => visualizerRef.current?.downloadObj()}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-sm font-bold text-slate-600"
                   >
                     <Box size={18} /> Download 3D Model
                   </button>
                   <button 
                    onClick={() => visualizerRef.current?.downloadPng()}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-sm font-bold text-slate-600"
                   >
                     <FileDown size={18} /> Download Image
                   </button>
                </div>
            </div>
        </div>

        {/* Data Column (Right) */}
        <div className="w-full lg:w-1/2 p-6 md:p-8 flex flex-col print:w-1/2">
          <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Fit Profile</h2>
                <p className="text-sm text-slate-500">AI-Generated Measurement Report</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600">{results.confidence}%</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Confidence Score</div>
              </div>
          </div>

          <div className="flex-grow space-y-6">
            
            {/* Section: Upper Body */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">Upper Body</h4>
              <div className="grid grid-cols-2 gap-3">
                <MeasurementRow label="Neck" value={results.neck} color={colors.neck} />
                <MeasurementRow label="Chest" value={results.chest} color={colors.chest} />
                <MeasurementRow label="Shoulders" value={results.shoulder} />
                <MeasurementRow label="Sleeve" value={results.sleeve} />
                <MeasurementRow label="Bicep" value={results.bicep} color={colors.bicep} />
                <MeasurementRow label="Wrist" value={results.wrist} color={colors.wrist} />
              </div>
            </div>

            {/* Section: Torso */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">Torso & Hips</h4>
              <div className="grid grid-cols-2 gap-3">
                <MeasurementRow label="Waist" value={results.waist} color={colors.waist} />
                <MeasurementRow label="Hips" value={results.hips} color={colors.hips} />
              </div>
            </div>

            {/* Section: Lower Body */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">Lower Body</h4>
              <div className="grid grid-cols-2 gap-3">
                <MeasurementRow label="Thigh" value={results.thigh} color={colors.thigh} />
                <MeasurementRow label="Calf" value={results.calf} color={colors.calf} />
                <MeasurementRow label="Ankle" value={results.ankle} color={colors.ankle} />
                <MeasurementRow label="Inseam" value={results.inseam} />
                <MeasurementRow label="Outseam" value={results.outseam} />
              </div>
            </div>
          </div>

          {results.notes && (
            <div className="mt-6 mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800 text-sm leading-relaxed print:bg-transparent print:border-slate-200">
              <strong>AI Stylist Note:</strong> {results.notes}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 mt-auto no-print">
            <button 
              onClick={onReset}
              className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCcw size={18} /> New Scan
            </button>
            <button 
              onClick={handlePrint}
              className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <Share2 size={18} /> Export PDF
            </button>
          </div>
          
          <div className="mt-6 flex items-start gap-2 text-xs text-slate-400">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p>
              AI estimates for sizing purposes. Not for medical use.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

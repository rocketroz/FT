
import React, { useEffect, useState } from 'react';
import { getScans } from '../services/supabaseService';
import { ArrowLeft, RefreshCw, Calendar, User, Ruler, FileText, CheckCircle, AlertTriangle, Cpu } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ onBack }) => {
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState<any | null>(null);

  const fetchScans = async () => {
    setLoading(true);
    const data = await getScans(50);
    setScans(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchScans();
  }, []);

  const getMeasurementJson = (scan: any) => {
    // Handling potential nested JSON structure differences depending on how it was saved
    if (typeof scan.measurements === 'string') {
        try { return JSON.parse(scan.measurements); } catch { return {}; }
    }
    // New structure stores full_json
    if (scan.full_json) return scan.full_json;
    return scan.measurements;
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
             <button onClick={onBack} className="p-2 bg-white rounded-full shadow hover:bg-slate-50 transition-colors">
               <ArrowLeft size={20} className="text-slate-600" />
             </button>
             <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          </div>
          <button onClick={fetchScans} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* List Column */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-150px)]">
             <div className="p-4 border-b border-slate-100 bg-slate-50">
               <h3 className="font-bold text-slate-700">Recent Scans</h3>
               <p className="text-xs text-slate-500">Last 50 entries</p>
             </div>
             <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {scans.length === 0 && !loading && (
                  <div className="p-8 text-center text-slate-400 text-sm">No scans found.</div>
                )}
                {scans.map((scan) => {
                  const m = getMeasurementJson(scan);
                  const modelName = m.model_name || 'unknown';
                  return (
                    <div 
                      key={scan.id} 
                      onClick={() => setSelectedScan({...scan, parsed: m})}
                      className={`p-3 rounded-lg cursor-pointer transition-all border ${
                        selectedScan?.id === scan.id 
                          ? 'bg-blue-50 border-blue-200 shadow-sm' 
                          : 'bg-white border-slate-100 hover:border-blue-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-slate-800 text-sm">
                          {scan.gender || 'Unknown'} 
                          <span className="text-slate-400 font-normal"> • {Math.round(scan.height)}cm</span>
                        </span>
                        <span className="text-[10px] text-slate-400">{new Date(scan.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                         <div className="flex items-center gap-2 text-xs text-slate-500">
                            <User size={12} /> {scan.user_id === 'anon' ? 'Anonymous' : scan.user_id?.substring(0,8)}
                         </div>
                         {/* Model Badge in List */}
                         <div className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${modelName.includes('2.5') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                           {modelName.replace('gemini-', '').replace('-preview', '')}
                         </div>
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>

          {/* Detail Column */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-150px)]">
             {selectedScan ? (
               <div className="flex flex-col h-full">
                 <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800">Scan Details</h3>
                      <p className="text-xs text-slate-500 font-mono">{selectedScan.id}</p>
                    </div>
                    <div className="flex gap-2 text-sm">
                       <a href={selectedScan.front_image_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Front Img</a>
                       <span className="text-slate-300">|</span>
                       <a href={selectedScan.side_image_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Side Img</a>
                    </div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                       <div className="p-4 bg-slate-50 rounded-lg">
                          <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Metrics</h4>
                          <div className="space-y-1 text-sm">
                             <div className="flex justify-between"><span>Chest:</span> <b>{selectedScan.parsed.chest?.toFixed(1)}</b></div>
                             <div className="flex justify-between"><span>Waist:</span> <b>{selectedScan.parsed.waist?.toFixed(1)}</b></div>
                             <div className="flex justify-between"><span>Hips:</span> <b>{selectedScan.parsed.hips?.toFixed(1)}</b></div>
                          </div>
                       </div>
                       <div className="p-4 bg-slate-50 rounded-lg">
                          <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Metadata</h4>
                          <div className="space-y-1 text-sm">
                             <div className="flex justify-between"><span>Method:</span> <span className="text-slate-600">{selectedScan.capture_method}</span></div>
                             <div className="flex justify-between"><span>Confidence:</span> <span className="text-slate-600">{selectedScan.parsed.confidence}%</span></div>
                             
                             <div className="flex justify-between pt-2 mt-2 border-t border-slate-200">
                               <span>Model:</span> 
                               <span className={`font-bold text-xs ${selectedScan.parsed.model_name?.includes('2.5') ? 'text-amber-600' : 'text-blue-600'}`}>
                                 {selectedScan.parsed.model_name}
                               </span>
                             </div>

                             {selectedScan.parsed.usage_metadata && (
                               <div className="flex justify-between">
                                 <span>Tokens:</span> 
                                 <span className="text-green-600 font-mono text-xs">{selectedScan.parsed.usage_metadata.totalTokenCount}</span>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>

                    {selectedScan.parsed.technical_analysis && (
                      <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h4 className="text-xs font-bold text-blue-600 uppercase mb-3 flex items-center gap-2">
                           <FileText size={14}/> Technical Transparency
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                              <span className="block text-xs font-bold text-slate-500 mb-1">Formulas Used</span>
                              <div className="space-y-2">
                                {Object.entries(selectedScan.parsed.technical_analysis.formulas || {}).map(([k, v]) => (
                                  <div key={k} className="text-xs">
                                     <span className="font-bold capitalize">{k}:</span> <span className="font-mono text-slate-600">{v as string}</span>
                                  </div>
                                ))}
                              </div>
                           </div>
                           <div>
                              <span className="block text-xs font-bold text-slate-500 mb-1">Quality Breakdown</span>
                              {selectedScan.parsed.quality_assessment && (
                                <ul className="text-xs space-y-1">
                                  <li>Front Img: <b>{selectedScan.parsed.quality_assessment.front_image_quality}/10</b></li>
                                  <li>Side Img: <b>{selectedScan.parsed.quality_assessment.side_image_quality}/10</b></li>
                                  <li>Pose: <b>{selectedScan.parsed.quality_assessment.pose_consistency}/10</b></li>
                                </ul>
                              )}
                           </div>
                        </div>
                      </div>
                    )}

                    <div className="mb-6">
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Thoughts & Reasoning</h4>
                      <div className="p-4 bg-slate-900 text-slate-300 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                        {selectedScan.parsed.thought_summary || "No thinking data available."}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Full JSON</h4>
                      <pre className="p-4 bg-slate-100 rounded-lg text-[10px] overflow-x-auto">
                        {JSON.stringify(selectedScan.parsed, null, 2)}
                      </pre>
                    </div>
                 </div>
               </div>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <Ruler size={48} className="mb-4 opacity-20" />
                  <p>Select a scan to view details</p>
               </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};

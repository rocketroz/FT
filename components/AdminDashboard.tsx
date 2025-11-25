import React, { useEffect, useState } from 'react';
import { getScans, supabase } from '../services/supabaseService';
import { analyzeApplicationLogs } from '../services/geminiService';
import { ArrowLeft, RefreshCw, Calendar, User, Ruler, FileText, CheckCircle, AlertTriangle, Cpu, Terminal, Bug, Smartphone, Search, Filter, X } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'scans' | 'logs'>('scans');
  const [scans, setScans] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState<any | null>(null);
  const [logFilter, setLogFilter] = useState<string | null>(null);
  
  // Analysis State
  const [analyzingLogs, setAnalyzingLogs] = useState(false);
  const [logAnalysisResult, setLogAnalysisResult] = useState<string | null>(null);

  const fetchScans = async () => {
    setLoading(true);
    const data = await getScans(50);
    setScans(data || []); // Ensure array
    setLoading(false);
  };

  const fetchLogs = async () => {
    if (!supabase) return;
    setLoading(true);
    
    let query = supabase
      .from('debug_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
      
    if (logFilter) {
      query = query.eq('session_id', logFilter);
    }
    
    const { data, error } = await query;
    
    if (data) setLogs(data);
    setLoading(false);
  };

  const handleAnalyzeLogs = async () => {
    if (logs.length === 0) return;
    setAnalyzingLogs(true);
    setLogAnalysisResult(null);
    const result = await analyzeApplicationLogs(logs.slice(0, 30)); // Analyze last 30 logs
    setLogAnalysisResult(result);
    setAnalyzingLogs(false);
  };

  useEffect(() => {
    if (activeTab === 'scans') fetchScans();
    else fetchLogs();
  }, [activeTab, logFilter]); // Re-fetch when filter changes

  const getMeasurementJson = (scan: any) => {
    // Handling potential nested JSON structure differences depending on how it was saved
    if (typeof scan.measurements === 'string') {
        try { return JSON.parse(scan.measurements); } catch { return {}; }
    }
    // New structure stores full_json
    if (scan.full_json) return scan.full_json;
    return scan.measurements || {};
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
          
          <div className="flex gap-4">
             <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-1 flex">
               <button 
                 onClick={() => setActiveTab('scans')}
                 className={`px-4 py-1.5 rounded text-sm font-bold transition-all ${activeTab === 'scans' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 Measurements
               </button>
               <button 
                 onClick={() => setActiveTab('logs')}
                 className={`px-4 py-1.5 rounded text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'logs' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 <Bug size={14}/> Live Logs
                 {logFilter && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
               </button>
             </div>

             <button onClick={activeTab === 'scans' ? fetchScans : () => fetchLogs()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
             </button>
          </div>
        </div>

        {/* --- SCANS VIEW --- */}
        {activeTab === 'scans' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* List Column */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-150px)]">
               <div className="p-4 border-b border-slate-100 bg-slate-50">
                 <h3 className="font-bold text-slate-700">Recent Scans</h3>
                 <p className="text-xs text-slate-500">Last 50 entries</p>
               </div>
               <div className="overflow-y-auto flex-1 p-2 space-y-2">
                  {(!scans || scans.length === 0) && !loading && (
                    <div className="p-8 text-center text-slate-400 text-sm">No scans found.</div>
                  )}
                  {scans?.map((scan) => {
                    const m = getMeasurementJson(scan);
                    const modelName = scan.model_name || m.model_name || 'unknown';
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
                      <div className="flex gap-2">
                         {/* DEBUG BUTTON */}
                         {selectedScan.session_id && (
                           <button 
                              onClick={() => { setLogFilter(selectedScan.session_id); setActiveTab('logs'); }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors"
                           >
                              <Bug size={14} /> Debug Session
                           </button>
                         )}
                         <div className="flex gap-2 text-sm ml-2 items-center">
                            {selectedScan.public_url ? (
                              <a href={selectedScan.public_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Front Img</a>
                            ) : (
                              <span className="text-slate-400 italic">Images linked below</span>
                            )}
                         </div>
                      </div>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-6">
                      
                      {/* Schema Mismatch Warning */}
                      {(!selectedScan.chest && selectedScan.parsed?.chest) && (
                        <div className="mb-4 bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
                            <AlertTriangle size={14} />
                            <span>
                               <strong>Schema Mismatch Detected:</strong> Main columns (e.g., chest, waist) are empty in DB. Displaying data from JSON backup. 
                               Check your Supabase column definitions.
                            </span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 mb-6">
                         <div className="p-4 bg-slate-50 rounded-lg">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Metrics</h4>
                            <div className="space-y-1 text-sm">
                               <div className="flex justify-between"><span>Chest:</span> <b>{selectedScan.chest?.toFixed(1) || selectedScan.parsed.chest?.toFixed(1)}</b></div>
                               <div className="flex justify-between"><span>Waist:</span> <b>{selectedScan.waist?.toFixed(1) || selectedScan.parsed.waist?.toFixed(1)}</b></div>
                               <div className="flex justify-between"><span>Hips:</span> <b>{selectedScan.hips?.toFixed(1) || selectedScan.parsed.hips?.toFixed(1)}</b></div>
                            </div>
                         </div>
                         <div className="p-4 bg-slate-50 rounded-lg">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Metadata</h4>
                            <div className="space-y-1 text-sm">
                               <div className="flex justify-between"><span>Method:</span> <span className="text-slate-600">{selectedScan.capture_method || selectedScan.parsed.capture_method}</span></div>
                               <div className="flex justify-between"><span>Confidence:</span> <span className="text-slate-600">{selectedScan.confidence || selectedScan.parsed.confidence}%</span></div>
                               
                               <div className="flex justify-between pt-2 mt-2 border-t border-slate-200">
                                 <span>Model:</span> 
                                 <span className={`font-bold text-xs ${selectedScan.model_name?.includes('2.5') ? 'text-amber-600' : 'text-blue-600'}`}>
                                   {selectedScan.model_name || selectedScan.parsed.model_name}
                                 </span>
                               </div>

                               {(selectedScan.token_count || selectedScan.parsed.usage_metadata) && (
                                 <div className="flex justify-between">
                                   <span>Tokens:</span> 
                                   <span className="text-green-600 font-mono text-xs">{selectedScan.token_count || selectedScan.parsed.usage_metadata?.totalTokenCount}</span>
                                 </div>
                               )}
                               
                               {selectedScan.api_cost_usd && (
                                 <div className="flex justify-between">
                                   <span>Est Cost:</span> 
                                   <span className="text-slate-500 text-xs">${Number(selectedScan.api_cost_usd).toFixed(6)}</span>
                                 </div>
                               )}
                            </div>
                         </div>
                      </div>
                      
                      {/* Transparency Fields from DB columns or JSON */}
                      <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                           <h4 className="text-xs font-bold text-blue-600 uppercase mb-3 flex items-center gap-2">
                             <FileText size={14}/> Technical Transparency
                          </h4>
                          
                          <div className="grid grid-cols-1 gap-2 text-sm">
                             <div className="flex justify-between border-b border-slate-200 pb-1">
                                <span className="text-slate-500">Scaling Factor:</span>
                                <span className="font-mono">{selectedScan.scaling_factor || selectedScan.parsed.scaling_factor}</span>
                             </div>
                             <div className="flex justify-between border-b border-slate-200 pb-1">
                                <span className="text-slate-500">AI Est. Height:</span>
                                <span className="font-mono">{selectedScan.estimated_height_cm || selectedScan.parsed.estimated_height_cm} cm</span>
                             </div>
                             {(selectedScan.thinking_tokens || selectedScan.parsed.thinking_tokens || selectedScan.parsed.usage_metadata?.thinkingTokenCount) && (
                               <div className="flex justify-between border-b border-slate-200 pb-1">
                                  <span className="text-slate-500">Thinking Tokens:</span>
                                  <span className="font-mono text-amber-600">{selectedScan.thinking_tokens || selectedScan.parsed.thinking_tokens || selectedScan.parsed.usage_metadata?.thinkingTokenCount}</span>
                               </div>
                             )}
                          </div>
                      </div>

                      <div className="mb-6">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Thoughts & Reasoning</h4>
                        <div className="p-4 bg-slate-900 text-slate-300 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                          {selectedScan.thought_summary || selectedScan.parsed.thought_summary || "No thinking data available."}
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
        )}

        {/* --- LIVE LOGS VIEW --- */}
        {activeTab === 'logs' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-150px)]">
            
            {/* Logs Stream (3 cols) */}
            <div className="lg:col-span-3 bg-slate-900 rounded-xl shadow-lg border border-slate-800 flex flex-col overflow-hidden">
               <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <h3 className="text-green-400 font-mono text-sm font-bold flex items-center gap-2">
                      <Terminal size={14}/> Remote Logs Stream
                    </h3>
                    {logFilter && (
                      <div className="flex items-center gap-2 bg-blue-900/50 px-2 py-0.5 rounded text-xs text-blue-200 border border-blue-800">
                         <Filter size={10} /> Session: {logFilter.substring(0,8)}...
                         <button onClick={() => setLogFilter(null)} className="hover:text-white"><X size={12} /></button>
                      </div>
                    )}
                 </div>
                 <span className="text-[10px] text-slate-500 uppercase tracking-widest">{logs.length} events</span>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
                  {logs.length === 0 && (
                    <div className="text-slate-500 text-center mt-10">
                       {logFilter ? "No logs found for this session." : "Waiting for logs from mobile devices..."}
                    </div>
                  )}
                  {logs.map((log) => (
                    <div key={log.id} className="group hover:bg-white/5 p-1 rounded transition-colors flex gap-3">
                       <span className="text-slate-500 shrink-0 w-20">
                         {new Date(log.created_at).toLocaleTimeString([], {hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}
                       </span>
                       <span className={`shrink-0 font-bold w-12 text-center uppercase ${
                         log.level === 'error' ? 'text-red-500 bg-red-500/10' : 
                         log.level === 'warn' ? 'text-amber-500' : 'text-blue-400'
                       }`}>
                         {log.level}
                       </span>
                       <div className="flex-1 break-all">
                         <span className="text-slate-300">{log.message}</span>
                         {log.data && (
                           <span className="block text-slate-500 mt-1 pl-2 border-l border-slate-700">
                             {JSON.stringify(log.data)}
                           </span>
                         )}
                         <div className="text-[9px] text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            Session: {log.session_id?.substring(0,8)} | Device: {log.device_info?.platform}
                         </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* AI Analysis Panel (1 col) */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
               <div className="p-4 bg-indigo-600 text-white">
                 <h3 className="font-bold flex items-center gap-2">
                   <Bug size={18}/> Gemini Debugger
                 </h3>
                 <p className="text-indigo-100 text-xs mt-1">
                   Analyze log patterns to find root causes of mobile failures.
                 </p>
               </div>
               
               <div className="p-4 flex-1 flex flex-col">
                  {logAnalysisResult ? (
                    <div className="flex-1 overflow-y-auto">
                       <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Analysis Result</h4>
                       <div className="prose prose-sm text-slate-700 text-xs">
                         <p className="whitespace-pre-wrap">{logAnalysisResult}</p>
                       </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-4">
                       <Search size={32} className="mb-2 opacity-20"/>
                       <p className="text-xs">Click the button below to have Gemini analyze the {logFilter ? "filtered" : "recent"} logs.</p>
                    </div>
                  )}

                  <button 
                    onClick={handleAnalyzeLogs}
                    disabled={analyzingLogs || logs.length === 0}
                    className="mt-4 w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {analyzingLogs ? (
                      <><RefreshCw size={14} className="animate-spin"/> Analyzing...</>
                    ) : (
                      'Analyze Session'
                    )}
                  </button>
               </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
import React, { useState } from 'react';
import { UserStats, Gender } from '../types';
import { ChevronRight, Ruler, Weight, User, Calendar, ArrowRightLeft } from 'lucide-react';

interface Props {
  onNext: (stats: UserStats) => void;
}

export const StatsForm: React.FC<Props> = ({ onNext }) => {
  // Default to Imperial as requested
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('imperial');
  
  // Metric Values
  const [heightCm, setHeightCm] = useState<string>('175');
  const [weightKg, setWeightKg] = useState<string>('');

  // Imperial Values
  const [heightFt, setHeightFt] = useState<string>('5');
  const [heightIn, setHeightIn] = useState<string>('9');
  const [weightLbs, setWeightLbs] = useState<string>('');

  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<Gender | undefined>(undefined);

  const toggleUnitSystem = () => {
    if (unitSystem === 'metric') {
      // Convert Metric to Imperial for display
      const cm = parseFloat(heightCm) || 0;
      const totalInches = cm / 2.54;
      const ft = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);
      setHeightFt(ft.toString());
      setHeightIn(inches.toString());

      const kg = parseFloat(weightKg);
      if (!isNaN(kg)) {
        setWeightLbs(Math.round(kg * 2.20462).toString());
      } else {
        setWeightLbs('');
      }
      
      setUnitSystem('imperial');
    } else {
      // Convert Imperial to Metric for display
      const ft = parseFloat(heightFt) || 0;
      const inches = parseFloat(heightIn) || 0;
      const totalCm = ((ft * 12) + inches) * 2.54;
      setHeightCm(Math.round(totalCm).toString());

      const lbs = parseFloat(weightLbs);
      if (!isNaN(lbs)) {
        setWeightKg(Math.round(lbs / 2.20462).toString());
      } else {
        setWeightKg('');
      }

      setUnitSystem('metric');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalHeight = 0;
    let finalWeight: number | undefined = undefined;

    if (unitSystem === 'metric') {
      finalHeight = parseFloat(heightCm);
      if (weightKg) finalWeight = parseFloat(weightKg);
    } else {
      const ft = parseFloat(heightFt) || 0;
      const inches = parseFloat(heightIn) || 0;
      finalHeight = ((ft * 12) + inches) * 2.54;
      if (weightLbs) finalWeight = parseFloat(weightLbs) * 0.453592;
    }

    onNext({
      height: finalHeight,
      weight: finalWeight,
      age: age ? parseInt(age) : undefined,
      gender,
      unitSystem
    });
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Updated Alignment to text-left */}
      <div className="bg-blue-600 p-6 text-left relative">
        <h2 className="text-2xl font-bold text-white">Your Body Profile</h2>
        <p className="text-blue-100 mt-2">This data calibrates the AI for accurate measurement.</p>
        
        {/* Enhanced Pop for Toggle Button */}
        <button 
          onClick={toggleUnitSystem}
          className="absolute top-6 right-6 px-4 py-2 bg-white hover:bg-blue-50 text-blue-700 rounded-lg shadow-lg transition-all transform hover:scale-105 flex items-center gap-2 text-sm font-bold border-2 border-blue-800/10"
        >
          <ArrowRightLeft size={16} />
          {unitSystem === 'metric' ? 'METRIC' : 'IMPERIAL'}
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        
        {/* Height - Thick Red Border Added */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Ruler size={18} className="text-blue-500" /> Height {unitSystem === 'metric' ? '(cm)' : '(ft/in)'} <span className="text-red-500">*</span>
          </label>
          {unitSystem === 'metric' ? (
            <input
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="w-full p-4 bg-slate-50 border-4 border-red-500 rounded-xl focus:ring-2 focus:ring-red-200 focus:border-red-500 outline-none transition-all text-lg font-semibold text-slate-800 placeholder-slate-400"
              placeholder="175"
              required
            />
          ) : (
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={heightFt}
                  onChange={(e) => setHeightFt(e.target.value)}
                  className="w-full p-4 bg-slate-50 border-4 border-red-500 rounded-xl focus:ring-2 focus:ring-red-200 focus:border-red-500 outline-none transition-all text-lg font-semibold text-slate-800 placeholder-slate-400"
                  placeholder="5"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">ft</span>
              </div>
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={heightIn}
                  onChange={(e) => setHeightIn(e.target.value)}
                  className="w-full p-4 bg-slate-50 border-4 border-red-500 rounded-xl focus:ring-2 focus:ring-red-200 focus:border-red-500 outline-none transition-all text-lg font-semibold text-slate-800 placeholder-slate-400"
                  placeholder="9"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">in</span>
              </div>
            </div>
          )}
        </div>

        {/* Weight */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Weight size={18} className="text-blue-500" /> Weight {unitSystem === 'metric' ? '(kg)' : '(lbs)'} <span className="text-slate-400 font-normal text-xs ml-auto">(Optional)</span>
          </label>
          <input
            type="number"
            value={unitSystem === 'metric' ? weightKg : weightLbs}
            onChange={(e) => unitSystem === 'metric' ? setWeightKg(e.target.value) : setWeightLbs(e.target.value)}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-lg font-semibold text-slate-800 placeholder-slate-400"
            placeholder=""
          />
        </div>

         {/* Age */}
         <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Calendar size={18} className="text-blue-500" /> Age <span className="text-slate-400 font-normal text-xs ml-auto">(Optional)</span>
          </label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-lg font-semibold text-slate-800 placeholder-slate-400"
            placeholder=""
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <User size={18} className="text-blue-500" /> Gender <span className="text-slate-400 font-normal text-xs ml-auto">(Optional)</span>
          </label>
          <div className="grid grid-cols-3 gap-4">
            {Object.values(Gender).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g === gender ? undefined : g)}
                className={`p-3 rounded-xl border-2 font-medium transition-all ${
                  gender === g 
                    ? 'border-blue-600 bg-blue-50 text-blue-700' 
                    : 'border-slate-200 text-slate-500 hover:border-blue-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        >
          Next Step <ChevronRight />
        </button>
      </form>
    </div>
  );
};
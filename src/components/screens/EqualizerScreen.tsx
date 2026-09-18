import React, { useState } from 'react';
import {
  Sliders,
  Power,
  RotateCcw,
  Save,
  Download,
  Upload,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { ThemeColors, EqualizerBand } from '../../types';
import { mainAudioEngine } from '../../audio/AudioEngine';
import { BUILTIN_PRESETS } from '../../audio/EqualizerPresets';

interface EqualizerScreenProps {
  themeColors: ThemeColors;
  isArabic: boolean;
}

export const EqualizerScreen: React.FC<EqualizerScreenProps> = ({ themeColors, isArabic }) => {
  const [eqEnabled, setEqEnabled] = useState(mainAudioEngine.eqEnabled);
  const [bands, setBands] = useState<EqualizerBand[]>(mainAudioEngine.getBands());
  const [selectedPreset, setSelectedPreset] = useState(mainAudioEngine.currentPreset);
  const [bassBoost, setBassBoost] = useState(mainAudioEngine.bassBoostLevel);
  const [trebleBoost, setTrebleBoost] = useState(mainAudioEngine.trebleBoostLevel);
  const [preampDb, setPreampDb] = useState(mainAudioEngine.currentPreampDb);
  const [customPresetName, setCustomPresetName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const handleToggleEq = () => {
    const next = !eqEnabled;
    setEqEnabled(next);
    mainAudioEngine.setEqEnabled(next);
  };

  const handleBandChange = (bandId: number, val: number) => {
    mainAudioEngine.setBandLevel(bandId, val);
    setBands([...mainAudioEngine.getBands()]);
    setSelectedPreset('Custom');
  };

  const handlePresetSelect = (presetName: string) => {
    setSelectedPreset(presetName);
    mainAudioEngine.applyPreset(presetName);
    setBands([...mainAudioEngine.getBands()]);
  };

  const handleReset = () => {
    handlePresetSelect('Flat');
    handleBassBoostChange(0);
    handleTrebleBoostChange(0);
    handlePreampChange(0);
  };

  const handleBassBoostChange = (v: number) => {
    setBassBoost(v);
    mainAudioEngine.setBassBoostLevel(v);
  };

  const handleTrebleBoostChange = (v: number) => {
    setTrebleBoost(v);
    mainAudioEngine.setTrebleBoostLevel(v);
  };

  const handlePreampChange = (v: number) => {
    setPreampDb(v);
    mainAudioEngine.setPreampDb(v);
  };

  // Export JSON preset
  const handleExportJson = () => {
    const data = {
      presetName: selectedPreset,
      bands: bands.map((b) => b.currentLevelDb),
      bassBoost,
      trebleBoost,
      preampDb,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EQ_Preset_${selectedPreset.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON preset
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json.bands)) {
          mainAudioEngine.applyCustomBands(json.bands);
          setBands([...mainAudioEngine.getBands()]);
        }
        if (typeof json.bassBoost === 'number') handleBassBoostChange(json.bassBoost);
        if (typeof json.trebleBoost === 'number') handleTrebleBoostChange(json.trebleBoost);
        if (typeof json.preampDb === 'number') handlePreampChange(json.preampDb);
        setSelectedPreset(json.presetName || 'Imported');
      } catch (err) {
        console.error('Failed to parse EQ JSON:', err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      id="equalizer-screen"
      className="flex-1 flex flex-col h-full overflow-y-auto select-none p-4 space-y-4"
      style={{
        backgroundColor: themeColors.background,
        color: themeColors.textPrimary,
      }}
    >
      {/* Header with Master Switch & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-6 h-6" style={{ color: themeColors.primary }} />
          <div>
            <h1 className="text-lg font-black tracking-wide">
              {isArabic ? 'المعادل الصوتي الاحترافي' : '10-BAND STUDIO EQUALIZER'}
            </h1>
            <p className="text-xs" style={{ color: themeColors.textMuted }}>
              Dolby & Bass Enhancement, Treble Clarity, 15 Built-in Presets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Master Enable/Bypass Switch */}
          <button
            onClick={handleToggleEq}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all shadow-sm ${
              eqEnabled ? 'hover:brightness-110' : 'opacity-60'
            }`}
            style={{
              backgroundColor: eqEnabled ? themeColors.primary : themeColors.surfaceVariant,
              borderColor: eqEnabled ? themeColors.primary : themeColors.border,
              color: eqEnabled ? '#ffffff' : themeColors.textPrimary,
            }}
          >
            <Power className="w-4 h-4" />
            <span>{eqEnabled ? (isArabic ? 'المعادل مفعّل' : 'DSP ACTIVE') : (isArabic ? 'معطل' : 'BYPASS')}</span>
          </button>

          {/* Reset button */}
          <button
            onClick={handleReset}
            className="p-1.5 rounded-xl border hover:bg-white/5 transition-colors"
            style={{ borderColor: themeColors.border }}
            title="Reset to Flat"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Export / Import JSON */}
          <button
            onClick={handleExportJson}
            className="p-1.5 rounded-xl border hover:bg-white/5 transition-colors"
            style={{ borderColor: themeColors.border }}
            title="Export EQ Preset (JSON)"
          >
            <Download className="w-4 h-4" />
          </button>

          <label
            className="p-1.5 rounded-xl border hover:bg-white/5 transition-colors cursor-pointer"
            style={{ borderColor: themeColors.border }}
            title="Import EQ Preset (JSON)"
          >
            <Upload className="w-4 h-4" />
            <input type="file" accept=".json" className="hidden" onChange={handleImportJson} />
          </label>
        </div>
      </div>

      {/* Presets List */}
      <div
        className="p-3.5 rounded-2xl border shadow-lg flex flex-col gap-2"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
      >
        <span className="text-xs font-bold tracking-wider opacity-70">
          {isArabic ? 'الإعدادات المسبقة (PRESETS)' : 'EQ PRESETS'}
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {Object.keys(BUILTIN_PRESETS).map((pName) => {
            const isSelected = selectedPreset === pName;
            return (
              <button
                key={pName}
                onClick={() => handlePresetSelect(pName)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-semibold border transition-all ${
                  isSelected ? 'shadow-sm' : 'hover:bg-white/5 opacity-70'
                }`}
                style={{
                  backgroundColor: isSelected ? themeColors.primary : themeColors.surfaceVariant,
                  borderColor: isSelected ? themeColors.primary : themeColors.border,
                  color: isSelected ? '#ffffff' : themeColors.textPrimary,
                }}
              >
                {pName}
              </button>
            );
          })}
        </div>
      </div>

      {/* 10 Vertical Bands Card */}
      <div
        className={`p-6 rounded-2xl border shadow-xl flex flex-col transition-opacity ${
          eqEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
        }`}
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
      >
        <div className="flex justify-between items-center mb-6">
          <span className="text-xs font-bold tracking-wider opacity-60">
            FREQUENCY RESPONSE (-12 dB ~ +12 dB)
          </span>
          <span className="text-xs font-mono font-bold" style={{ color: themeColors.primary }}>
            {selectedPreset}
          </span>
        </div>

        {/* Sliders Container */}
        <div className="grid grid-cols-10 gap-2 sm:gap-4 items-end h-56 pb-2">
          {bands.map((band) => (
            <div key={band.id} className="flex flex-col items-center h-full justify-between">
              {/* Current dB level */}
              <span className="text-[10px] font-mono font-bold opacity-80 h-4">
                {band.currentLevelDb > 0 ? `+${band.currentLevelDb}` : band.currentLevelDb}
              </span>

              {/* Vertical Slider */}
              <div className="relative flex-1 flex items-center justify-center my-2">
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={band.currentLevelDb}
                  onChange={(e) => handleBandChange(band.id, Number(e.target.value))}
                  className="w-36 h-2 rounded-lg appearance-none cursor-pointer transform -rotate-90 origin-center"
                  style={{
                    accentColor: themeColors.primary,
                    backgroundColor: themeColors.surfaceVariant,
                  }}
                />
              </div>

              {/* Frequency Label */}
              <span className="text-[10px] font-semibold text-center opacity-70 whitespace-nowrap">
                {band.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Audio Enhancers (Bass Boost, Treble Boost, Preamp Gain) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bass Boost */}
        <div
          className="p-4 rounded-2xl border shadow-lg flex flex-col gap-2"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }}
        >
          <div className="flex justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" style={{ color: themeColors.primary }} />
              {isArabic ? 'تضخيم الباس (BASS BOOST)' : 'BASS BOOST'}
            </span>
            <span className="font-mono">{Math.round(bassBoost * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={bassBoost}
            onChange={(e) => handleBassBoostChange(Number(e.target.value))}
            className="w-full h-2 rounded appearance-none cursor-pointer"
            style={{
              accentColor: themeColors.primary,
              backgroundColor: themeColors.surfaceVariant,
            }}
          />
        </div>

        {/* Treble Boost */}
        <div
          className="p-4 rounded-2xl border shadow-lg flex flex-col gap-2"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }}
        >
          <div className="flex justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" style={{ color: themeColors.secondary }} />
              {isArabic ? 'وضوح الصوت الحاد (TREBLE)' : 'TREBLE BOOST'}
            </span>
            <span className="font-mono">{Math.round(trebleBoost * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={trebleBoost}
            onChange={(e) => handleTrebleBoostChange(Number(e.target.value))}
            className="w-full h-2 rounded appearance-none cursor-pointer"
            style={{
              accentColor: themeColors.secondary,
              backgroundColor: themeColors.surfaceVariant,
            }}
          />
        </div>

        {/* Preamp Gain */}
        <div
          className="p-4 rounded-2xl border shadow-lg flex flex-col gap-2"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }}
        >
          <div className="flex justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" style={{ color: themeColors.tertiary }} />
              {isArabic ? 'مضخم الصوت المسبق (PREAMP)' : 'PREAMP GAIN'}
            </span>
            <span className="font-mono">{preampDb} dB</span>
          </div>
          <input
            type="range"
            min={0}
            max={12}
            step={0.5}
            value={preampDb}
            onChange={(e) => handlePreampChange(Number(e.target.value))}
            className="w-full h-2 rounded appearance-none cursor-pointer"
            style={{
              accentColor: themeColors.tertiary,
              backgroundColor: themeColors.surfaceVariant,
            }}
          />
        </div>
      </div>
    </div>
  );
};

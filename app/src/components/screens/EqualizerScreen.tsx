import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Power,
  RotateCcw,
  Save,
  Download,
  Upload,
  Sparkles,
  Volume2,
  Trash2,
  BookmarkPlus,
  X,
  Check,
} from 'lucide-react';
import { ThemeColors, EqualizerBand, CustomPreset } from '../../types';
import { mainAudioEngine } from '../../audio/AudioEngine';
import { BUILTIN_PRESETS } from '../../audio/EqualizerPresets';
import { db } from '../../storage/db';

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
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [customPresetName, setCustomPresetName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load custom presets and active EQ settings from persistent storage
  useEffect(() => {
    let mounted = true;

    db.getCustomPresets()
      .then((presets) => {
        if (mounted) setCustomPresets(presets);
      })
      .catch((err) => console.warn('Could not load custom presets:', err));

    db.getSetting<{
      enabled?: boolean;
      preset?: string;
      bands?: number[];
      bassBoost?: number;
      trebleBoost?: number;
      preampDb?: number;
    } | null>('active_eq_state', null)
      .then((saved) => {
        if (!mounted || !saved) return;
        if (typeof saved.enabled === 'boolean') {
          setEqEnabled(saved.enabled);
          mainAudioEngine.setEqEnabled(saved.enabled);
        }
        if (Array.isArray(saved.bands) && saved.bands.length > 0) {
          mainAudioEngine.applyCustomBands(saved.bands);
          setBands([...mainAudioEngine.getBands()]);
        }
        if (typeof saved.bassBoost === 'number') {
          setBassBoost(saved.bassBoost);
          mainAudioEngine.setBassBoostLevel(saved.bassBoost);
        }
        if (typeof saved.trebleBoost === 'number') {
          setTrebleBoost(saved.trebleBoost);
          mainAudioEngine.setTrebleBoostLevel(saved.trebleBoost);
        }
        if (typeof saved.preampDb === 'number') {
          setPreampDb(saved.preampDb);
          mainAudioEngine.setPreampDb(saved.preampDb);
        }
        if (saved.preset) {
          setSelectedPreset(saved.preset);
        }
      })
      .catch((err) => console.warn('Could not restore active EQ:', err));

    return () => {
      mounted = false;
    };
  }, []);

  // Helper to persist active EQ settings
  const persistActiveState = (
    currentBands: EqualizerBand[],
    preset: string,
    enabled: boolean,
    bass: number,
    treble: number,
    preamp: number
  ) => {
    void db.setSetting('active_eq_state', {
      enabled,
      preset,
      bands: currentBands.map((b) => b.currentLevelDb),
      bassBoost: bass,
      trebleBoost: treble,
      preampDb: preamp,
    });
  };

  const handleToggleEq = () => {
    const next = !eqEnabled;
    setEqEnabled(next);
    mainAudioEngine.setEqEnabled(next);
    persistActiveState(bands, selectedPreset, next, bassBoost, trebleBoost, preampDb);
  };

  const handleBandChange = (bandId: number, val: number) => {
    mainAudioEngine.setBandLevel(bandId, val);
    const updated = [...mainAudioEngine.getBands()];
    setBands(updated);
    setSelectedPreset('Custom');
    persistActiveState(updated, 'Custom', eqEnabled, bassBoost, trebleBoost, preampDb);
  };

  const handlePresetSelect = (presetName: string) => {
    setSelectedPreset(presetName);
    mainAudioEngine.applyPreset(presetName);
    const updated = [...mainAudioEngine.getBands()];
    setBands(updated);
    persistActiveState(updated, presetName, eqEnabled, bassBoost, trebleBoost, preampDb);
  };

  const handleCustomPresetSelect = (preset: CustomPreset) => {
    mainAudioEngine.applyCustomBands(preset.bands);
    const updated = [...mainAudioEngine.getBands()];
    setBands(updated);
    setSelectedPreset(preset.name);

    const nextBass = typeof preset.bassBoost === 'number' ? preset.bassBoost : bassBoost;
    const nextTreble = typeof preset.trebleBoost === 'number' ? preset.trebleBoost : trebleBoost;
    const nextPreamp = typeof preset.preampDb === 'number' ? preset.preampDb : preampDb;

    if (typeof preset.bassBoost === 'number') {
      setBassBoost(preset.bassBoost);
      mainAudioEngine.setBassBoostLevel(preset.bassBoost);
    }
    if (typeof preset.trebleBoost === 'number') {
      setTrebleBoost(preset.trebleBoost);
      mainAudioEngine.setTrebleBoostLevel(preset.trebleBoost);
    }
    if (typeof preset.preampDb === 'number') {
      setPreampDb(preset.preampDb);
      mainAudioEngine.setPreampDb(preset.preampDb);
    }

    persistActiveState(updated, preset.name, eqEnabled, nextBass, nextTreble, nextPreamp);
    setStatusMessage(isArabic ? `تم تفعيل الإعداد: ${preset.name}` : `Activated preset: ${preset.name}`);
    setTimeout(() => setStatusMessage(null), 3000);
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
    persistActiveState(bands, selectedPreset, eqEnabled, v, trebleBoost, preampDb);
  };

  const handleTrebleBoostChange = (v: number) => {
    setTrebleBoost(v);
    mainAudioEngine.setTrebleBoostLevel(v);
    persistActiveState(bands, selectedPreset, eqEnabled, bassBoost, v, preampDb);
  };

  const handlePreampChange = (v: number) => {
    setPreampDb(v);
    mainAudioEngine.setPreampDb(v);
    persistActiveState(bands, selectedPreset, eqEnabled, bassBoost, trebleBoost, v);
  };

  // Save Current EQ as Custom Preset
  const handleSaveCustomPreset = async () => {
    const trimmed = customPresetName.trim();
    if (!trimmed) return;

    const newPreset: CustomPreset = {
      id: 'eq_custom_' + Date.now(),
      name: trimmed,
      bands: bands.map((b) => b.currentLevelDb),
      bassBoost,
      trebleBoost,
      preampDb,
    };

    try {
      await db.saveCustomPreset(newPreset);
      const allPresets = await db.getCustomPresets();
      setCustomPresets(allPresets);
      setSelectedPreset(newPreset.name);
      persistActiveState(bands, newPreset.name, eqEnabled, bassBoost, trebleBoost, preampDb);
      setShowSaveDialog(false);
      setCustomPresetName('');
      setStatusMessage(isArabic ? `تم حفظ الإعداد "${trimmed}" بنجاح!` : `Preset "${trimmed}" saved!`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Failed to save custom preset:', err);
      setStatusMessage(isArabic ? 'تعذر حفظ الإعداد.' : 'Could not save preset.');
    }
  };

  // Delete Custom Preset
  const handleDeleteCustomPreset = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    try {
      await db.deleteCustomPreset(id);
      const remaining = await db.getCustomPresets();
      setCustomPresets(remaining);
      if (selectedPreset === name) {
        setSelectedPreset('Custom');
      }
      setStatusMessage(isArabic ? `تم حذف الإعداد "${name}".` : `Deleted preset "${name}".`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Failed to delete custom preset:', err);
    }
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
          const updated = [...mainAudioEngine.getBands()];
          setBands(updated);
        }
        if (typeof json.bassBoost === 'number') handleBassBoostChange(json.bassBoost);
        if (typeof json.trebleBoost === 'number') handleTrebleBoostChange(json.trebleBoost);
        if (typeof json.preampDb === 'number') handlePreampChange(json.preampDb);
        const name = json.presetName || 'Imported';
        setSelectedPreset(name);
        persistActiveState(
          mainAudioEngine.getBands(),
          name,
          eqEnabled,
          typeof json.bassBoost === 'number' ? json.bassBoost : bassBoost,
          typeof json.trebleBoost === 'number' ? json.trebleBoost : trebleBoost,
          typeof json.preampDb === 'number' ? json.preampDb : preampDb
        );
        setStatusMessage(isArabic ? `تم استيراد الإعداد: ${name}` : `Imported preset: ${name}`);
        setTimeout(() => setStatusMessage(null), 3000);
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
              {isArabic
                ? 'تحكم كامل بـ 10 ترددات، مضخم Bass و Treble، وحفظ التعديلات المخصصة تلقائياً'
                : '10-Band EQ, Bass/Treble boost, and automatic persistent custom adjustments'}
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

          {/* Save Custom Preset Button */}
          <button
            onClick={() => setShowSaveDialog(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border hover:brightness-110 transition-all shadow-sm"
            style={{
              backgroundColor: `${themeColors.primary}20`,
              borderColor: themeColors.primary,
              color: themeColors.primary,
            }}
            title={isArabic ? 'حفظ التعديلات كإعداد مسبق مخصص' : 'Save current settings as custom preset'}
          >
            <Save className="w-4 h-4" />
            <span>{isArabic ? 'حفظ التعديل' : 'Save Preset'}</span>
          </button>

          {/* Reset button */}
          <button
            onClick={handleReset}
            className="p-1.5 rounded-xl border hover:bg-white/5 transition-colors"
            style={{ borderColor: themeColors.border }}
            title={isArabic ? 'إعادة ضبط للافتراضي (Flat)' : 'Reset to Flat'}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Export / Import JSON */}
          <button
            onClick={handleExportJson}
            className="p-1.5 rounded-xl border hover:bg-white/5 transition-colors"
            style={{ borderColor: themeColors.border }}
            title={isArabic ? 'تصدير الإعداد (JSON)' : 'Export EQ Preset (JSON)'}
          >
            <Download className="w-4 h-4" />
          </button>

          <label
            className="p-1.5 rounded-xl border hover:bg-white/5 transition-colors cursor-pointer"
            style={{ borderColor: themeColors.border }}
            title={isArabic ? 'استيراد إعداد (JSON)' : 'Import EQ Preset (JSON)'}
          >
            <Upload className="w-4 h-4" />
            <input type="file" accept=".json" className="hidden" onChange={handleImportJson} />
          </label>
        </div>
      </div>

      <div className="rounded-xl border px-3 py-2.5 text-xs leading-relaxed" style={{ borderColor: themeColors.primary + '75', backgroundColor: themeColors.primary + '10', color: themeColors.textSecondary }}>
        {isArabic
          ? 'المعادل موحّد لكل مخارج الصوت: المشغل الرئيسي، ديكا DJ، المايك، السامبلر، والراديو والموسيقى الأونلاين.'
          : 'Global EQ applies to every output: Main Player, both DJ decks, microphone, sampler, Radio and Online Music.'}
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          role="status"
          className="rounded-xl border p-2.5 text-xs flex items-center gap-2 animate-fadeIn"
          style={{
            borderColor: themeColors.primary,
            backgroundColor: `${themeColors.primary}15`,
            color: themeColors.textPrimary,
          }}
        >
          <Check className="w-4 h-4 text-green-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Presets List (Built-in + Custom Presets) */}
      <div
        className="p-3.5 rounded-2xl border shadow-lg flex flex-col gap-2"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider opacity-70">
            {isArabic ? 'الإعدادات المسبقة والمخصصة' : 'EQ PRESETS & CUSTOM PRESETS'}
          </span>
          <span className="text-[11px] font-mono opacity-60">
            {customPresets.length} {isArabic ? 'إعداد خاص' : 'custom'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {/* Custom Presets first with custom highlight */}
          {customPresets.map((cp) => {
            const isSelected = selectedPreset === cp.name;
            return (
              <div
                key={cp.id}
                className="relative inline-flex items-center group shrink-0"
              >
                <button
                  onClick={() => handleCustomPresetSelect(cp)}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-bold border transition-all flex items-center gap-1.5 ${
                    isSelected ? 'shadow-sm ring-1' : 'hover:bg-white/5 opacity-80'
                  }`}
                  style={{
                    backgroundColor: isSelected ? themeColors.primary : `${themeColors.primary}15`,
                    borderColor: themeColors.primary,
                    color: isSelected ? '#ffffff' : themeColors.textPrimary,
                  }}
                  title={isArabic ? `إعداد مخصص: ${cp.name}` : `Custom preset: ${cp.name}`}
                >
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span>{cp.name}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteCustomPreset(e, cp.id, cp.name)}
                  className="p-1 ml-1 rounded-lg hover:bg-red-500/20 text-red-400 opacity-60 hover:opacity-100 transition-opacity"
                  title={isArabic ? 'حذف هذا الإعداد' : 'Delete this custom preset'}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* Built-in Presets */}
          {Object.keys(BUILTIN_PRESETS).map((pName) => {
            const isSelected = selectedPreset === pName;
            return (
              <button
                key={pName}
                onClick={() => handlePresetSelect(pName)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-semibold border transition-all shrink-0 ${
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

      {/* Save Custom Preset Modal */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl space-y-4"
            style={{
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
              color: themeColors.textPrimary,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookmarkPlus className="w-5 h-5" style={{ color: themeColors.primary }} />
                <h3 className="font-black text-sm">
                  {isArabic ? 'حفظ إعداد مخصص جديد' : 'Save Custom Preset'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setCustomPresetName('');
                }}
                className="p-1 rounded-lg border hover:bg-white/5"
                style={{ borderColor: themeColors.border }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs opacity-75">
              {isArabic
                ? 'سيتم حفظ كافة مستويات الترددات الحالية وتضخيم Bass و Treble في إعداد دائم باسم تختاره:'
                : 'Current frequency bands, bass boost, and treble boost will be saved to your personal presets:'}
            </p>

            <input
              type="text"
              value={customPresetName}
              onChange={(e) => setCustomPresetName(e.target.value)}
              placeholder={isArabic ? 'مثال: سيارة - Bass عالي' : 'e.g. My Studio Bass'}
              autoFocus
              className="w-full rounded-xl border px-3 py-2 text-xs outline-none transition-all"
              style={{
                borderColor: themeColors.border,
                backgroundColor: themeColors.surfaceVariant,
                color: themeColors.textPrimary,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveCustomPreset();
              }}
            />

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setCustomPresetName('');
                }}
                className="flex-1 py-2 rounded-xl border text-xs font-bold"
                style={{ borderColor: themeColors.border }}
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => void handleSaveCustomPreset()}
                disabled={!customPresetName.trim()}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={{ backgroundColor: themeColors.primary }}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isArabic ? 'حفظ الإعداد' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

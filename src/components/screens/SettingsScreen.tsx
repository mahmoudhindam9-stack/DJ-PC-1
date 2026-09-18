import React from 'react';
import {
  Settings as SettingsIcon,
  Palette,
  Languages,
  Info,
  Sliders,
  Check,
  Headphones,
  HardDrive,
} from 'lucide-react';
import { AppThemeOption, ThemeColors } from '../../types';
import { THEMES } from '../../utils/theme';

interface SettingsScreenProps {
  currentTheme: AppThemeOption;
  onThemeChange: (th: AppThemeOption) => void;
  isArabic: boolean;
  onToggleLanguage: () => void;
  themeColors: ThemeColors;
  crossfadeDurationMs: number;
  onCrossfadeChange: (durationMs: number) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currentTheme,
  onThemeChange,
  isArabic,
  onToggleLanguage,
  themeColors,
  crossfadeDurationMs,
  onCrossfadeChange,
}) => {
  const themeList = Object.keys(THEMES) as AppThemeOption[];

  return (
    <div
      id="settings-screen"
      className="flex-1 flex flex-col h-full overflow-y-auto select-none p-4 space-y-6 max-w-4xl mx-auto w-full"
      style={{
        backgroundColor: themeColors.background,
        color: themeColors.textPrimary,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-6 h-6" style={{ color: themeColors.primary }} />
        <div>
          <h1 className="text-lg font-black tracking-wide">
            {isArabic ? 'إعدادات التطبيق' : 'APPLICATION SETTINGS'}
          </h1>
          <p className="text-xs" style={{ color: themeColors.textMuted }}>
            Appearance, Audio Engine, Regional & System Configurations
          </p>
        </div>
      </div>

      {/* Language Section */}
      <div
        className="p-4 rounded-2xl border shadow-lg flex flex-col gap-3"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
      >
        <div className="flex items-center gap-2">
          <Languages className="w-5 h-5" style={{ color: themeColors.primary }} />
          <h2 className="font-bold text-sm">
            {isArabic ? 'اللغة والاتجاه (Language & Direction)' : 'Language & Layout Direction'}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          <button
            onClick={() => isArabic && onToggleLanguage()}
            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
              !isArabic ? 'ring-2' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: !isArabic ? `${themeColors.primary}20` : themeColors.surfaceVariant,
              borderColor: !isArabic ? themeColors.primary : themeColors.border,
            }}
          >
            <div className="text-left">
              <div>English (Left-to-Right)</div>
              <span className="text-[10px] opacity-60 font-normal">Default desktop mode</span>
            </div>
            {!isArabic && <Check className="w-4 h-4" style={{ color: themeColors.primary }} />}
          </button>

          <button
            onClick={() => !isArabic && onToggleLanguage()}
            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
              isArabic ? 'ring-2' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: isArabic ? `${themeColors.primary}20` : themeColors.surfaceVariant,
              borderColor: isArabic ? themeColors.primary : themeColors.border,
            }}
          >
            <div className="text-right">
              <div>العربية (من اليمين إلى اليسار)</div>
              <span className="text-[10px] opacity-60 font-normal">تخطيط RTL كامل</span>
            </div>
            {isArabic && <Check className="w-4 h-4" style={{ color: themeColors.primary }} />}
          </button>
        </div>
      </div>

      {/* Themes Palette Section */}
      <div
        className="p-4 rounded-2xl border shadow-lg flex flex-col gap-3"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
      >
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5" style={{ color: themeColors.primary }} />
          <h2 className="font-bold text-sm">
            {isArabic ? 'ثيمات وألوان التطبيق (Themes)' : 'Color Theme Engine'}
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mt-1">
          {themeList.map((thKey) => {
            const th = THEMES[thKey];
            const isSelected = currentTheme === thKey;
            return (
              <button
                key={thKey}
                onClick={() => onThemeChange(thKey)}
                className={`p-2.5 rounded-xl border flex flex-col gap-2 text-left transition-all ${
                  isSelected ? 'ring-2' : 'hover:scale-[1.02]'
                }`}
                style={{
                  backgroundColor: th.surface,
                  borderColor: isSelected ? th.primary : themeColors.border,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="w-3.5 h-3.5 rounded-full shadow-sm"
                    style={{ backgroundColor: th.primary }}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: th.secondary }}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: th.tertiary }}
                  />
                </div>
                <div className="min-w-0">
                  <div
                    className="text-xs font-bold truncate"
                    style={{ color: th.textPrimary }}
                  >
                    {thKey.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[9px] opacity-60" style={{ color: th.textMuted }}>
                    {th.isDark ? 'Dark Mode' : 'Light Mode'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Crossfade Section */}
      <div
        className="p-4 rounded-2xl border shadow-lg flex flex-col gap-3"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5" style={{ color: themeColors.primary }} />
          <h2 className="font-bold text-sm">
            {isArabic ? 'الانتقال السلس بين الأغاني (Crossfade)' : 'Track Crossfade'}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={15000}
            step={250}
            value={crossfadeDurationMs}
            onChange={(e) => onCrossfadeChange(Number(e.target.value))}
            className="flex-1"
            style={{ accentColor: themeColors.primary }}
          />
          <span className="font-mono text-xs w-20 text-right">
            {(crossfadeDurationMs / 1000).toFixed(2)} s
          </span>
        </div>

        <p className="text-[10px] opacity-60">
          {isArabic
            ? 'يتم تشغيل التراك التالي فعليًا بالتوازي مع نهاية التراك الحالي.'
            : 'The next track is actually played in parallel with the current track tail.'}
        </p>
      </div>

      {/* Audio Engine Info */}
      <div
        className="p-4 rounded-2xl border shadow-lg flex flex-col gap-3"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
      >
        <div className="flex items-center gap-2">
          <Headphones className="w-5 h-5" style={{ color: themeColors.primary }} />
          <h2 className="font-bold text-sm">
            {isArabic ? 'محرك الصوت ومعالجة الإشارات DSP' : 'Audio DSP & Hardware Routing'}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl border" style={{ borderColor: themeColors.border }}>
            <span className="opacity-60 text-[10px]">SAMPLE RATE</span>
            <div className="font-mono font-bold text-sm mt-0.5">48,000 Hz (48 kHz)</div>
          </div>
          <div className="p-3 rounded-xl border" style={{ borderColor: themeColors.border }}>
            <span className="opacity-60 text-[10px]">DSP EQUALIZER</span>
            <div className="font-mono font-bold text-sm mt-0.5">10-Band Biquad Peaking</div>
          </div>
          <div className="p-3 rounded-xl border" style={{ borderColor: themeColors.border }}>
            <span className="opacity-60 text-[10px]">BUFFER LATENCY</span>
            <div className="font-mono font-bold text-sm mt-0.5">&lt; 15 ms (Ultra-Low)</div>
          </div>
        </div>
      </div>

      {/* About Box */}
      <div
        className="p-4 rounded-2xl border shadow-lg flex flex-col gap-2"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
      >
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5" style={{ color: themeColors.primary }} />
          <h2 className="font-bold text-sm">{isArabic ? 'عن التطبيق' : 'About DJ Desktop'}</h2>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: themeColors.textMuted }}>
          DJ Desktop v3.6.7 — Standalone Windows Desktop Audio Station. Remixed from the original
          Android DJ Suite into a high-performance desktop workstation with full feature parity: Dual
          DJ Decks with pitch control, 64-pad soundboard sampler, 10-band Dolby EQ, live hardware
          Karaoke monitoring with DSP filters, online cloud streaming, and direct Egypt & World Radio
          FM.
        </p>
      </div>
    </div>
  );
};

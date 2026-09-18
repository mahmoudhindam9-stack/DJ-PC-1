import React from 'react';
import { Minus, Square, X, Languages, Palette } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AppThemeOption, ThemeColors } from '../types';
import { THEMES } from '../utils/theme';

interface TitleBarProps {
  currentTheme: AppThemeOption;
  onThemeChange: (theme: AppThemeOption) => void;
  isArabic: boolean;
  onToggleLanguage: () => void;
  themeColors: ThemeColors;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  currentTheme,
  onThemeChange,
  isArabic,
  onToggleLanguage,
  themeColors,
}) => (
  <header
    id="dj-titlebar"
    data-tauri-drag-region
    className="h-12 shrink-0 flex items-center justify-between px-4 border-b select-none z-50"
    style={{ backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.textPrimary }}
  >
    <div className="flex items-center gap-3 min-w-0" data-tauri-drag-region>
      <img src="/icon.jpg" alt="DJ Desktop" className="w-7 h-7 rounded-lg object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
      <div className="leading-tight">
        <div className="text-sm font-black tracking-wider"><span style={{ color: themeColors.primary }}>DJ</span> DESKTOP</div>
        <div className="text-[10px] opacity-45">Professional Music & DJ Workstation</div>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <button
        onClick={onToggleLanguage}
        className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold hover:bg-white/10"
        style={{ backgroundColor: themeColors.surfaceVariant }}
        title={isArabic ? 'English' : 'العربية'}
      >
        <Languages className="w-3.5 h-3.5" />
        {isArabic ? 'EN' : 'عربي'}
      </button>

      <div className="relative group">
        <button className="h-8 px-2.5 rounded-lg flex items-center gap-1 hover:bg-white/10" style={{ backgroundColor: themeColors.surfaceVariant }} title="Themes">
          <Palette className="w-3.5 h-3.5" />
          <span className="text-xs">{currentTheme.replace(/_/g, ' ')}</span>
        </button>
        <div className="absolute right-0 top-full mt-1 hidden group-hover:block p-2 rounded-xl shadow-2xl border w-56 z-[100]" style={{ backgroundColor: themeColors.surface, borderColor: themeColors.border }}>
          <div className="px-2 pb-1 text-[10px] font-bold opacity-50">THEMES</div>
          <div className="max-h-80 overflow-y-auto">
            {Object.keys(THEMES).map((key) => {
              const theme = THEMES[key as AppThemeOption];
              return <button key={key} onClick={() => onThemeChange(key as AppThemeOption)} className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-white/10"><span className={currentTheme === key ? 'font-black' : ''}>{key.replace(/_/g, ' ')}</span><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.primary }} /></button>;
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-0.5 ml-1">
        <button className="w-9 h-8 rounded hover:bg-white/10 flex items-center justify-center" title="Minimize" onClick={() => { void getCurrentWindow().minimize(); }}><Minus className="w-4 h-4" /></button>
        <button className="w-9 h-8 rounded hover:bg-white/10 flex items-center justify-center" title="Maximize / Restore" onClick={() => { void getCurrentWindow().toggleMaximize(); }}><Square className="w-3.5 h-3.5" /></button>
        <button className="w-9 h-8 rounded hover:bg-red-500 hover:text-white flex items-center justify-center" title="Close" onClick={() => { void getCurrentWindow().close(); }}><X className="w-4 h-4" /></button>
      </div>
    </div>
  </header>
);

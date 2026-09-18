import React, { useState, useEffect } from 'react';
import {
  Disc,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Sliders,
  Sparkles,
  Layers,
  Check,
  FolderOpen,
  X,
} from 'lucide-react';
import { AudioItem, ThemeColors, SamplePad } from '../../types';
import { deckAEngine, deckBEngine, DJEffectType } from '../../audio/DJDeckEngine';
import { samplerEngine } from '../../audio/SamplerEngine';

interface DJMixerScreenProps {
  library: AudioItem[];
  themeColors: ThemeColors;
  isArabic: boolean;
  onPauseMainPlayer: () => void;
  onImportFiles: (files: FileList | File[]) => void;
}

export const DJMixerScreen: React.FC<DJMixerScreenProps> = ({
  library,
  themeColors,
  isArabic,
  onPauseMainPlayer,
  onImportFiles,
}) => {
  const [crossfader, setCrossfader] = useState(0.5); // 0 = Deck A only, 1 = Deck B only
  const [deckAState, setDeckAState] = useState({
    track: deckAEngine.currentTrack,
    isPlaying: deckAEngine.isPlaying,
    currentTime: deckAEngine.currentTimeMs,
    duration: deckAEngine.durationMs,
    pitch: deckAEngine.pitch,
    effect: deckAEngine.activeEffect,
    fxAmount: deckAEngine.fxAmount,
  });

  const [deckBState, setDeckBState] = useState({
    track: deckBEngine.currentTrack,
    isPlaying: deckBEngine.isPlaying,
    currentTime: deckBEngine.currentTimeMs,
    duration: deckBEngine.durationMs,
    pitch: deckBEngine.pitch,
    effect: deckBEngine.activeEffect,
    fxAmount: deckBEngine.fxAmount,
  });

  const [selectedBank, setSelectedBank] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [samplerVolume, setSamplerVolume] = useState(0.9);
  const [trackSelectorDeck, setTrackSelectorDeck] = useState<'A' | 'B' | null>(null);

  // Subscribe to deck updates
  useEffect(() => {
    const unsubA = deckAEngine.subscribe(() => {
      setDeckAState({
        track: deckAEngine.currentTrack,
        isPlaying: deckAEngine.isPlaying,
        currentTime: deckAEngine.currentTimeMs,
        duration: deckAEngine.durationMs,
        pitch: deckAEngine.pitch,
        effect: deckAEngine.activeEffect,
        fxAmount: deckAEngine.fxAmount,
      });
    });

    const unsubB = deckBEngine.subscribe(() => {
      setDeckBState({
        track: deckBEngine.currentTrack,
        isPlaying: deckBEngine.isPlaying,
        currentTime: deckBEngine.currentTimeMs,
        duration: deckBEngine.durationMs,
        pitch: deckBEngine.pitch,
        effect: deckBEngine.activeEffect,
        fxAmount: deckBEngine.fxAmount,
      });
    });

    return () => {
      unsubA();
      unsubB();
    };
  }, []);

  // Update crossfade gains whenever crossfader value changes
  useEffect(() => {
    // Equal power or linear crossfade
    const gainA = Math.cos((crossfader * Math.PI) / 2);
    const gainB = Math.sin((crossfader * Math.PI) / 2);
    deckAEngine.setCrossfadeVolume(gainA);
    deckBEngine.setCrossfadeVolume(gainB);
  }, [crossfader]);

  // Keyboard hotkeys for Sampler Pads (1-4, Q-R, A-F, Z-V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
        return;
      }
      const key = e.key.toUpperCase();
      const currentPads = samplerEngine.pads[selectedBank];
      const match = currentPads.find((p) => p.hotkey === key);
      if (match) {
        samplerEngine.triggerPad(match);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBank]);

  const handlePlayDeck = (deck: 'A' | 'B') => {
    onPauseMainPlayer();
    if (deck === 'A') {
      deckAEngine.togglePlay();
    } else {
      deckBEngine.togglePlay();
    }
  };

  const handleLoadTrack = (deck: 'A' | 'B', track: AudioItem) => {
    if (deck === 'A') {
      deckAEngine.loadTrack(track);
    } else {
      deckBEngine.loadTrack(track);
    }
    setTrackSelectorDeck(null);
  };

  const formatMs = (ms: number) => {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const effectsList: Array<{ id: DJEffectType; name: string }> = [
    { id: 'none', name: 'Bypass' },
    { id: 'fx_filter', name: '🎛️ Filter' },
    { id: 'fx_delay', name: '🔁 Delay' },
    { id: 'fx_reverb', name: '🌊 Reverb' },
    { id: 'fx_flanger', name: '🌀 Flanger' },
    { id: 'fx_phaser', name: '🌈 Phaser' },
    { id: 'fx_bitcrush', name: '👾 Bitcrush' },
    { id: 'fx_distortion', name: '🔥 Distort' },
    { id: 'voice_woman', name: '👩 Woman Voice' },
    { id: 'voice_kid', name: '👶 Kid Voice' },
    { id: 'voice_chipmunk', name: '🐿️ Chipmunk' },
    { id: 'voice_monster', name: '👹 Monster' },
    { id: 'voice_demon', name: '👻 Dark Demon' },
    { id: 'voice_giant', name: '🏔️ Giant Bass' },
  ];

  const isAnyDeckPlaying = deckAState.isPlaying || deckBState.isPlaying;

  return (
    <div
      id="dj-mixer-screen"
      className="flex-1 flex flex-col h-full overflow-y-auto select-none p-4 space-y-4"
      style={{
        backgroundColor: themeColors.background,
        color: themeColors.textPrimary,
      }}
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Disc className={`w-6 h-6 ${isAnyDeckPlaying ? 'animate-spin' : ''}`} style={{ color: themeColors.primary }} />
          <div>
            <h1 className="text-lg font-black tracking-widest">
              {isArabic ? 'استوديو دي جي ميكسر' : 'DJ STUDIO MIXER'}
            </h1>
            <p className="text-xs" style={{ color: themeColors.textMuted }}>
              Dual Deck Scratch, Pitch Control, DSP Effects & Soundboard
            </p>
          </div>
        </div>

        {/* Live Audio Status Pill */}
        <div
          className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider flex items-center gap-1.5 shadow-sm border ${
            isAnyDeckPlaying ? 'animate-pulse' : ''
          }`}
          style={{
            backgroundColor: isAnyDeckPlaying ? '#00e67625' : themeColors.surfaceVariant,
            borderColor: isAnyDeckPlaying ? '#00e676' : themeColors.border,
            color: isAnyDeckPlaying ? '#00e676' : themeColors.textMuted,
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: isAnyDeckPlaying ? '#00e676' : themeColors.textMuted }}
          />
          {isAnyDeckPlaying ? (isArabic ? 'صوت مباشر' : 'LIVE AUDIO') : (isArabic ? 'في الانتظار' : 'STANDBY')}
        </div>
      </div>

      {/* Crossfader Card with 3D Perspective Tilt */}
      <div
        className="p-4 rounded-2xl border shadow-xl flex flex-col items-center gap-2 transition-transform duration-200"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
          transform: `perspective(600px) rotateY(${(crossfader - 0.5) * 6}deg)`,
        }}
      >
        <span className="text-[11px] font-bold tracking-wider opacity-60">
          {isArabic ? 'التحويل المتقاطع للصوت (CROSSFADER)' : 'MASTER CROSSFADER'}
        </span>

        <div className="flex items-center gap-3 w-full max-w-xl">
          <span className="font-black text-sm px-2 py-0.5 rounded" style={{ color: themeColors.accentA }}>
            DECK A
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={crossfader}
            onChange={(e) => setCrossfader(Number(e.target.value))}
            className="flex-1 h-3 rounded-lg appearance-none cursor-ew-resize"
            style={{
              accentColor: crossfader < 0.5 ? themeColors.accentA : themeColors.accentB,
              backgroundColor: themeColors.surfaceVariant,
            }}
          />
          <span className="font-black text-sm px-2 py-0.5 rounded" style={{ color: themeColors.accentB }}>
            DECK B
          </span>
        </div>

        <div className="flex justify-between w-full max-w-xl text-[10px] opacity-60">
          <span>{Math.round((1 - crossfader) * 100)}%</span>
          <span>CENTER (50/50)</span>
          <span>{Math.round(crossfader * 100)}%</span>
        </div>
      </div>

      {/* DECK A & DECK B SIDE-BY-SIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DECK A */}
        <div
          className="p-4 rounded-2xl border shadow-xl flex flex-col gap-3"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: `${themeColors.accentA}40`,
          }}
        >
          {/* Deck Header */}
          <div className="flex items-center justify-between">
            <span className="font-black text-sm tracking-wider" style={{ color: themeColors.accentA }}>
              DECK A
            </span>
            <span className="text-xs font-mono opacity-70">
              {formatMs(deckAState.currentTime)} / {formatMs(deckAState.duration)}
            </span>
          </div>

          {/* Track Display Area */}
          <div
            onClick={() => setTrackSelectorDeck('A')}
            className="p-3 rounded-xl border flex items-center justify-between cursor-pointer hover:border-blue-400 transition-colors"
            style={{
              backgroundColor: themeColors.surfaceVariant,
              borderColor: themeColors.border,
            }}
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-xs truncate">
                {deckAState.track?.title || (isArabic ? 'اضغط لتحميل أغنية في DECK A' : 'CLICK TO LOAD TRACK')}
              </h3>
              <p className="text-[11px] truncate opacity-70">
                {deckAState.track?.artist || 'Ready for mixing'}
              </p>
            </div>
            <button
              className="px-2.5 py-1 rounded text-xs font-bold border ml-2 shrink-0"
              style={{
                borderColor: themeColors.accentA,
                color: themeColors.accentA,
              }}
            >
              {isArabic ? 'اختيار' : 'SELECT'}
            </button>
          </div>

          {/* Playback Controls (CUE & PLAY) */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => deckAEngine.cue()}
              className="flex-1 py-3 rounded-xl font-black text-xs border tracking-wider transition-all active:scale-95"
              style={{
                borderColor: themeColors.accentA,
                backgroundColor: `${themeColors.accentA}20`,
                color: themeColors.accentA,
              }}
            >
              CUE
            </button>

            <button
              onClick={() => handlePlayDeck('A')}
              className="flex-2 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition-transform active:scale-95"
              style={{
                backgroundColor: deckAState.isPlaying ? themeColors.accentA : themeColors.surfaceVariant,
                color: deckAState.isPlaying ? '#ffffff' : themeColors.textPrimary,
              }}
            >
              {deckAState.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{deckAState.isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>
          </div>

          {/* Seek Scrubber */}
          <div>
            <input
              type="range"
              min={0}
              max={deckAState.duration || 100}
              value={deckAState.currentTime || 0}
              onChange={(e) => deckAEngine.seekTo(Number(e.target.value))}
              className="w-full h-1.5 rounded appearance-none cursor-pointer"
              style={{
                accentColor: themeColors.accentA,
                backgroundColor: themeColors.surfaceVariant,
              }}
            />
          </div>

          {/* Pitch Slider (0.5x to 1.5x) */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="opacity-70 font-semibold">TEMPO / PITCH</span>
              <span className="font-mono font-bold" style={{ color: themeColors.accentA }}>
                {deckAState.pitch === 1.0
                  ? '0.0%'
                  : `${deckAState.pitch > 1 ? '+' : ''}${Math.round((deckAState.pitch - 1) * 100)}%`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] opacity-60">-50%</span>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.01}
                value={deckAState.pitch}
                onChange={(e) => deckAEngine.setPitch(Number(e.target.value))}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  accentColor: themeColors.accentA,
                  backgroundColor: themeColors.surfaceVariant,
                }}
              />
              <span className="text-[10px] opacity-60">+50%</span>
              <button
                onClick={() => deckAEngine.setPitch(1.0)}
                className="px-1.5 py-0.5 rounded text-[10px] border hover:bg-white/10"
                style={{ borderColor: themeColors.border }}
                title="Reset Pitch to 100%"
              >
                RESET
              </button>
            </div>
          </div>

          {/* Deck A FX Rack */}
          <div className="border-t pt-3 flex flex-col gap-2" style={{ borderColor: themeColors.border }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" style={{ color: themeColors.accentA }} />
                FX RACK (A)
              </span>
              <select
                value={deckAState.effect}
                onChange={(e) => deckAEngine.setEffect(e.target.value as DJEffectType)}
                className="px-2 py-1 rounded text-xs border outline-none font-medium"
                style={{
                  backgroundColor: themeColors.surfaceVariant,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                }}
              >
                {effectsList.map((fx) => (
                  <option key={fx.id} value={fx.id}>
                    {fx.name}
                  </option>
                ))}
              </select>
            </div>

            {deckAState.effect !== 'none' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="opacity-70 text-[11px]">Amount:</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={deckAState.fxAmount}
                  onChange={(e) => deckAEngine.setFxAmount(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded appearance-none cursor-pointer"
                  style={{
                    accentColor: themeColors.accentA,
                    backgroundColor: themeColors.surfaceVariant,
                  }}
                />
                <span className="w-8 text-right font-mono text-[11px]">
                  {Math.round(deckAState.fxAmount * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* DECK B */}
        <div
          className="p-4 rounded-2xl border shadow-xl flex flex-col gap-3"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: `${themeColors.accentB}40`,
          }}
        >
          {/* Deck Header */}
          <div className="flex items-center justify-between">
            <span className="font-black text-sm tracking-wider" style={{ color: themeColors.accentB }}>
              DECK B
            </span>
            <span className="text-xs font-mono opacity-70">
              {formatMs(deckBState.currentTime)} / {formatMs(deckBState.duration)}
            </span>
          </div>

          {/* Track Display Area */}
          <div
            onClick={() => setTrackSelectorDeck('B')}
            className="p-3 rounded-xl border flex items-center justify-between cursor-pointer hover:border-pink-400 transition-colors"
            style={{
              backgroundColor: themeColors.surfaceVariant,
              borderColor: themeColors.border,
            }}
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-xs truncate">
                {deckBState.track?.title || (isArabic ? 'اضغط لتحميل أغنية في DECK B' : 'CLICK TO LOAD TRACK')}
              </h3>
              <p className="text-[11px] truncate opacity-70">
                {deckBState.track?.artist || 'Ready for mixing'}
              </p>
            </div>
            <button
              className="px-2.5 py-1 rounded text-xs font-bold border ml-2 shrink-0"
              style={{
                borderColor: themeColors.accentB,
                color: themeColors.accentB,
              }}
            >
              {isArabic ? 'اختيار' : 'SELECT'}
            </button>
          </div>

          {/* Playback Controls (CUE & PLAY) */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => deckBEngine.cue()}
              className="flex-1 py-3 rounded-xl font-black text-xs border tracking-wider transition-all active:scale-95"
              style={{
                borderColor: themeColors.accentB,
                backgroundColor: `${themeColors.accentB}20`,
                color: themeColors.accentB,
              }}
            >
              CUE
            </button>

            <button
              onClick={() => handlePlayDeck('B')}
              className="flex-2 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition-transform active:scale-95"
              style={{
                backgroundColor: deckBState.isPlaying ? themeColors.accentB : themeColors.surfaceVariant,
                color: deckBState.isPlaying ? '#ffffff' : themeColors.textPrimary,
              }}
            >
              {deckBState.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{deckBState.isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>
          </div>

          {/* Seek Scrubber */}
          <div>
            <input
              type="range"
              min={0}
              max={deckBState.duration || 100}
              value={deckBState.currentTime || 0}
              onChange={(e) => deckBEngine.seekTo(Number(e.target.value))}
              className="w-full h-1.5 rounded appearance-none cursor-pointer"
              style={{
                accentColor: themeColors.accentB,
                backgroundColor: themeColors.surfaceVariant,
              }}
            />
          </div>

          {/* Pitch Slider (0.5x to 1.5x) */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="opacity-70 font-semibold">TEMPO / PITCH</span>
              <span className="font-mono font-bold" style={{ color: themeColors.accentB }}>
                {deckBState.pitch === 1.0
                  ? '0.0%'
                  : `${deckBState.pitch > 1 ? '+' : ''}${Math.round((deckBState.pitch - 1) * 100)}%`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] opacity-60">-50%</span>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.01}
                value={deckBState.pitch}
                onChange={(e) => deckBEngine.setPitch(Number(e.target.value))}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  accentColor: themeColors.accentB,
                  backgroundColor: themeColors.surfaceVariant,
                }}
              />
              <span className="text-[10px] opacity-60">+50%</span>
              <button
                onClick={() => deckBEngine.setPitch(1.0)}
                className="px-1.5 py-0.5 rounded text-[10px] border hover:bg-white/10"
                style={{ borderColor: themeColors.border }}
                title="Reset Pitch to 100%"
              >
                RESET
              </button>
            </div>
          </div>

          {/* Deck B FX Rack */}
          <div className="border-t pt-3 flex flex-col gap-2" style={{ borderColor: themeColors.border }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" style={{ color: themeColors.accentB }} />
                FX RACK (B)
              </span>
              <select
                value={deckBState.effect}
                onChange={(e) => deckBEngine.setEffect(e.target.value as DJEffectType)}
                className="px-2 py-1 rounded text-xs border outline-none font-medium"
                style={{
                  backgroundColor: themeColors.surfaceVariant,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                }}
              >
                {effectsList.map((fx) => (
                  <option key={fx.id} value={fx.id}>
                    {fx.name}
                  </option>
                ))}
              </select>
            </div>

            {deckBState.effect !== 'none' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="opacity-70 text-[11px]">Amount:</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={deckBState.fxAmount}
                  onChange={(e) => deckBEngine.setFxAmount(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded appearance-none cursor-pointer"
                  style={{
                    accentColor: themeColors.accentB,
                    backgroundColor: themeColors.surfaceVariant,
                  }}
                />
                <span className="w-8 text-right font-mono text-[11px]">
                  {Math.round(deckBState.fxAmount * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DJ SAMPLER / SOUND FX BOARD */}
      <div
        className="p-4 rounded-2xl border shadow-xl flex flex-col gap-3"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5" style={{ color: themeColors.primary }} />
            <h2 className="font-bold text-sm tracking-wider">
              {isArabic ? 'لوحة مؤثرات الصوت والسامبلر (DJ FX / SAMPLER)' : 'DJ FX / SAMPLER BOARD'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">Volume:</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={samplerVolume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSamplerVolume(v);
                samplerEngine.volume = v;
              }}
              className="w-20 h-1.5 rounded appearance-none cursor-pointer"
              style={{
                accentColor: themeColors.primary,
                backgroundColor: themeColors.surfaceVariant,
              }}
            />
          </div>
        </div>

        {/* Bank Selection Tabs (A, B, C, D) */}
        <div className="flex gap-2">
          {(['A', 'B', 'C', 'D'] as Array<'A' | 'B' | 'C' | 'D'>).map((b) => {
            const labels: Record<string, string> = {
              A: 'BANK A • DJ Sci-Fi',
              B: 'BANK B • Comedy & Memes',
              C: 'BANK C • Viral & Trends',
              D: 'BANK D • Custom Pads',
            };
            const isSel = selectedBank === b;
            return (
              <button
                key={b}
                onClick={() => setSelectedBank(b)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  isSel ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: isSel ? themeColors.primary : themeColors.surfaceVariant,
                  borderColor: isSel ? themeColors.primary : themeColors.border,
                  color: isSel ? '#ffffff' : themeColors.textPrimary,
                }}
              >
                {labels[b]}
              </button>
            );
          })}
        </div>

        {/* 16 Pads Grid (4x4) */}
        <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-8 gap-2">
          {samplerEngine.pads[selectedBank].map((pad) => (
            <button
              key={pad.id}
              onClick={() => samplerEngine.triggerPad(pad)}
              className="h-16 p-2 rounded-xl border flex flex-col justify-between items-center transition-all active:scale-90 hover:brightness-110 shadow-sm"
              style={{
                backgroundColor: themeColors.surfaceVariant,
                borderColor: themeColors.border,
              }}
            >
              <span className="text-[10px] font-mono px-1 rounded font-bold opacity-60 self-start"
                style={{ backgroundColor: `${themeColors.primary}30` }}>
                {pad.hotkey}
              </span>
              <span className="text-[11px] font-bold text-center leading-tight truncate w-full">
                {pad.name}
              </span>
              <span className="text-[9px] opacity-50 uppercase tracking-tighter">
                {pad.category}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Track Selector Modal */}
      {trackSelectorDeck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
            style={{
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            }}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: themeColors.border }}>
              <h3 className="font-bold text-sm">
                {isArabic
                  ? `تحميل أغنية إلى DECK ${trackSelectorDeck}`
                  : `Load Track to DECK ${trackSelectorDeck}`}
              </h3>
              <button
                onClick={() => setTrackSelectorDeck(null)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {library.length === 0 ? (
                <div className="py-12 text-center text-xs opacity-70">
                  {isArabic
                    ? 'المكتبة فارغة. قم باستيراد ملفات صوتية أولاً.'
                    : 'Library is empty. Import audio files first.'}
                </div>
              ) : (
                library.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => handleLoadTrack(trackSelectorDeck, track)}
                    className="p-2.5 rounded-xl border flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
                    style={{
                      backgroundColor: themeColors.surfaceVariant,
                      borderColor: themeColors.border,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs truncate">{track.title}</h4>
                      <p className="text-[11px] opacity-70 truncate">{track.artist}</p>
                    </div>
                    <span className="text-xs opacity-60 font-mono ml-2">
                      {formatMs(track.duration)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

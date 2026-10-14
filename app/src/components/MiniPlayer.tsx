import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  VolumeX,
  ListMusic,
  Maximize2,
  Sliders,
  Music2,
} from 'lucide-react';
import { AudioItem, PlaybackMode, ThemeColors } from '../types';

interface MiniPlayerProps {
  currentSong: AudioItem | null;
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackMode: PlaybackMode;
  volume: number;
  crossfadeDurationSeconds: number;
  themeColors: ThemeColors;
  onCrossfadeDurationChange: (seconds: number) => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (ms: number) => void;
  onSeekBy: (deltaMs: number) => void;
  onVolumeChange: (vol: number) => void;
  onTogglePlaybackMode: () => void;
  onOpenQueue: () => void;
  onOpenNowPlaying: () => void;
  onOpenEqualizer: () => void;
  isArabic: boolean;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentSong,
  isPlaying,
  currentTimeMs,
  durationMs,
  playbackMode,
  volume,
  crossfadeDurationSeconds,
  themeColors,
  onCrossfadeDurationChange,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onSeekBy,
  onVolumeChange,
  onTogglePlaybackMode,
  onOpenQueue,
  onOpenNowPlaying,
  onOpenEqualizer,
  isArabic,
}) => {
  const formatTime = (ms: number) => {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const [actionFeedback, setActionFeedback] = useState('');
  const feedbackTimerRef = useRef<number | null>(null);
  const seekHoldDelayRef = useRef<number | null>(null);
  const seekHoldIntervalRef = useRef<number | null>(null);
  const announceAction = (message: string) => {
    setActionFeedback(message);
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setActionFeedback(''), 1900);
  };
  const stopSeekHold = () => {
    if (seekHoldDelayRef.current !== null) { window.clearTimeout(seekHoldDelayRef.current); seekHoldDelayRef.current = null; }
    if (seekHoldIntervalRef.current !== null) { window.clearInterval(seekHoldIntervalRef.current); seekHoldIntervalRef.current = null; }
  };
  const startSeekHold = (deltaMs: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    stopSeekHold();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Older WebViews may not support pointer capture. */ }
    onSeekBy(deltaMs);
    announceAction(deltaMs < 0 ? (isArabic ? 'تم الرجوع 10 ثوانٍ' : 'Skipped back 10 seconds') : (isArabic ? 'تم التقديم 10 ثوانٍ' : 'Skipped forward 10 seconds'));
    seekHoldDelayRef.current = window.setTimeout(() => { seekHoldIntervalRef.current = window.setInterval(() => onSeekBy(deltaMs), 250); }, 380);
  };
  useEffect(() => () => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    stopSeekHold();
  }, []);

  return (
    <footer
      id="dj-mini-player"
      className="border-t px-4 py-2 select-none flex flex-col gap-1 z-40 shrink-0"
      style={{
        backgroundColor: themeColors.surface,
        borderColor: themeColors.border,
        color: themeColors.textPrimary,
      }}
    >
      {/* Top Scrubber */}
      <div className="flex items-center gap-2 w-full text-[11px]">
        <span style={{ color: themeColors.textMuted }} className="w-10 text-right">
          {formatTime(currentTimeMs)}
        </span>
        <div className="relative flex-1 flex items-center group">
          <input
            type="range"
            min={0}
            max={durationMs || 100}
            value={currentTimeMs || 0}
            onChange={(e) => { onSeek(Number(e.target.value)); announceAction(isArabic ? 'تم تغيير موضع التشغيل' : 'Playback position changed'); }}
            className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer group-hover:h-2 transition-all"
            style={{
              accentColor: themeColors.primary,
            }}
          />
        </div>
        <span style={{ color: themeColors.textMuted }} className="w-10">
          {formatTime(durationMs)}
        </span>
      </div>

      {/* Automatic overlap duration, rather than a manual A/B mix fader. */}
      <div className="flex items-center gap-3 rounded-lg border px-3 py-2" style={{ backgroundColor: themeColors.surfaceVariant, borderColor: themeColors.border }}>
        <div className="shrink-0 min-w-[116px]">
          <div className="text-[10px] font-black tracking-wider" style={{ color: themeColors.primary }}>{isArabic ? 'تداخل الأغاني' : 'CROSSFADE'}</div>
          <div className="text-[10px] opacity-65">{isArabic ? 'مدة التداخل' : 'Overlap duration'}</div>
        </div>
        <span className="text-[11px] font-mono font-bold tabular-nums w-7 text-right">{crossfadeDurationSeconds}s</span>
        <input
          type="range" min={0} max={15} step={1} value={crossfadeDurationSeconds}
          onChange={(event) => { const seconds = Number(event.target.value); onCrossfadeDurationChange(seconds); announceAction(isArabic ? `مدة التداخل: ${seconds} ثانية` : `Crossfade duration: ${seconds}s`); }}
          aria-label={isArabic ? 'مدة التداخل بين الأغاني من صفر إلى 15 ثانية' : 'Automatic song crossfade duration, zero to 15 seconds'}
          title={isArabic ? 'صفر = بدون تداخل، 15 = أطول تداخل' : '0 = no overlap; 15 = longest overlap'}
          className="flex-1 h-2 rounded-full appearance-none cursor-ew-resize"
          style={{ accentColor: themeColors.primary, backgroundColor: themeColors.border }}
        />
        <div className="flex items-center justify-between gap-2 text-[9px] opacity-60 w-10"><span>0</span><span>15</span></div>
        <span className="text-[10px] opacity-65">sec</span>
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Track Details (Left) */}
        <div
          className="flex items-center gap-3 min-w-0 w-1/4 cursor-pointer"
          onClick={onOpenNowPlaying}
          title="Click to expand Now Playing"
        >
          <div
            className="w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: themeColors.surfaceVariant,
              borderColor: themeColors.border,
            }}
          >
            {currentSong?.coverUri ? (
              <img
                src={currentSong.coverUri}
                alt={currentSong.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music2 className="w-5 h-5" style={{ color: themeColors.primary }} />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold truncate leading-tight">
              {currentSong ? currentSong.title : isArabic ? 'لا يوجد تشغيل' : 'No track selected'}
            </h4>
            <p className="text-[11px] truncate leading-tight flex items-center gap-2" style={{ color: themeColors.textMuted }}>
              <span className="truncate">{currentSong ? currentSong.artist : isArabic ? 'اختر أغنية للبدء' : 'Select a song to start'}</span>
              {currentSong && <span className="dj-now-playing-badge shrink-0">{isPlaying && <span className="dj-playing-indicator mr-1"><i /><i /><i /></span>}{isPlaying ? (isArabic ? 'يعمل الآن' : 'PLAYING') : (isArabic ? 'متوقف مؤقتًا' : 'PAUSED')}</span>}
            </p>
          </div>
        </div>

        {/* Playback controls with distinct hit targets and visible feedback. */}
        <div className="flex items-center gap-1.5 sm:gap-2" aria-label={isArabic ? 'أدوات تشغيل الأغاني' : 'Playback controls'}>
          <button type="button" onClick={() => { onTogglePlaybackMode(); announceAction(isArabic ? 'تم تغيير وضع التشغيل' : 'Playback mode changed'); }} className="player-control-button p-2 rounded-lg" title={playbackMode === 'SHUFFLE' ? (isArabic ? 'العشوائي مفعّل' : 'Shuffle active') : playbackMode === 'REPEAT_ONE' ? (isArabic ? 'تكرار الأغنية' : 'Repeat one') : playbackMode === 'REPEAT_ALL' ? (isArabic ? 'تكرار القائمة' : 'Repeat all') : (isArabic ? 'تشغيل عادي' : 'Normal playback')} aria-label={isArabic ? 'تغيير وضع التشغيل' : 'Change playback mode'} aria-pressed={playbackMode !== 'NORMAL'} data-active={playbackMode !== 'NORMAL' ? 'true' : 'false'} style={{ color: playbackMode !== 'NORMAL' ? themeColors.primary : themeColors.textMuted }}>
            {playbackMode === 'REPEAT_ONE' ? <Repeat1 className="w-4 h-4" /> : playbackMode === 'SHUFFLE' ? <Shuffle className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>
          <button type="button" onPointerDown={(event) => startSeekHold(-10000, event)} onPointerUp={stopSeekHold} onPointerCancel={stopSeekHold} onLostPointerCapture={stopSeekHold} onClick={(event) => { if (event.detail === 0) { onSeekBy(-10000); announceAction(isArabic ? 'تم الرجوع 10 ثوانٍ' : 'Skipped back 10 seconds'); } }} onContextMenu={(event) => event.preventDefault()} disabled={!currentSong} className="player-control-button relative p-2 rounded-lg" title={isArabic ? 'الرجوع 10 ثوانٍ — اضغط مطولًا للاستمرار' : 'Back 10 seconds — hold to keep seeking'} aria-label={isArabic ? 'الرجوع 10 ثوانٍ، اضغط مطولًا للاستمرار' : 'Seek backward 10 seconds; hold to continue'} style={{ color: themeColors.textSecondary }}>
            <Rewind className="w-4 h-4" /><span className="absolute -bottom-0.5 right-0.5 text-[8px] font-black leading-none">10</span>
          </button>
          <button type="button" onClick={() => { onPrev(); announceAction(isArabic ? 'تم تنفيذ أمر السابق' : 'Previous-track command sent'); }} className="player-control-button p-2 rounded-lg" title={isArabic ? 'الأغنية السابقة' : 'Previous track'} aria-label={isArabic ? 'الأغنية السابقة' : 'Previous track'} style={{ color: themeColors.textSecondary }}><SkipBack className="w-4 h-4" /></button>
          <button type="button" onClick={() => { onPlayPause(); announceAction(isArabic ? 'تم تحديث حالة التشغيل' : 'Playback state updated'); }} className="player-control-button player-main-play-button p-2.5 rounded-xl" style={{ backgroundColor: themeColors.primary, borderColor: themeColors.primary, color: '#ffffff' }} title={isPlaying ? (isArabic ? 'إيقاف مؤقت' : 'Pause') : (isArabic ? 'تشغيل' : 'Play')} aria-label={isPlaying ? (isArabic ? 'إيقاف مؤقت' : 'Pause') : (isArabic ? 'تشغيل' : 'Play')} aria-pressed={isPlaying}>
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          <button type="button" onClick={() => { onNext(); announceAction(isArabic ? 'تم تنفيذ أمر التالي' : 'Next-track command sent'); }} className="player-control-button p-2 rounded-lg" title={isArabic ? 'الأغنية التالية' : 'Next track'} aria-label={isArabic ? 'الأغنية التالية' : 'Next track'} style={{ color: themeColors.textSecondary }}><SkipForward className="w-4 h-4" /></button>
          <button type="button" onPointerDown={(event) => startSeekHold(10000, event)} onPointerUp={stopSeekHold} onPointerCancel={stopSeekHold} onLostPointerCapture={stopSeekHold} onClick={(event) => { if (event.detail === 0) { onSeekBy(10000); announceAction(isArabic ? 'تم التقديم 10 ثوانٍ' : 'Skipped forward 10 seconds'); } }} onContextMenu={(event) => event.preventDefault()} disabled={!currentSong} className="player-control-button relative p-2 rounded-lg" title={isArabic ? 'التقديم 10 ثوانٍ — اضغط مطولًا للاستمرار' : 'Forward 10 seconds — hold to keep seeking'} aria-label={isArabic ? 'التقديم 10 ثوانٍ، اضغط مطولًا للاستمرار' : 'Seek forward 10 seconds; hold to continue'} style={{ color: themeColors.textSecondary }}>
            <FastForward className="w-4 h-4" /><span className="absolute -bottom-0.5 right-0.5 text-[8px] font-black leading-none">10</span>
          </button>
        </div>

        {/* Right Tools: EQ, Queue, Volume, Fullscreen Expand */}
        <div className="flex items-center gap-2.5 w-1/4 justify-end">
          <button
            onClick={() => { onOpenEqualizer(); announceAction(isArabic ? 'تم فتح موازن الصوت' : 'Equalizer opened'); }}
            className="player-control-button p-1.5 rounded-lg"
            title="Master Equalizer"
          >
            <Sliders className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
          </button>

          <button
            onClick={() => { onOpenQueue(); announceAction(isArabic ? 'تم فتح قائمة التشغيل' : 'Play queue opened'); }}
            className="player-control-button p-1.5 rounded-lg relative"
            title="Play Queue"
          >
            <ListMusic className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
          </button>

          {/* Volume slider */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => { onVolumeChange(volume === 0 ? 0.8 : 0); announceAction(volume === 0 ? (isArabic ? 'تم إلغاء كتم الصوت' : 'Sound unmuted') : (isArabic ? 'تم كتم الصوت' : 'Sound muted')); }}
              className="player-control-button p-1 rounded-lg"
              title={volume === 0 ? 'Unmute' : 'Mute'}
            >
              {volume === 0 ? (
                <VolumeX className="w-4 h-4" style={{ color: themeColors.textMuted }} />
              ) : (
                <Volume2 className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => { onVolumeChange(Number(e.target.value)); announceAction(isArabic ? 'تم تغيير مستوى الصوت' : 'Volume changed'); }}
              className="w-18 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
              style={{
                accentColor: themeColors.primary,
              }}
            />
          </div>

          <button
            onClick={() => { onOpenNowPlaying(); announceAction(isArabic ? 'تم فتح المشغل الموسع' : 'Expanded player opened'); }}
            className="player-control-button p-1.5 rounded-lg"
            title="Expand Full View"
          >
            <Maximize2 className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
          </button>
        </div>
      </div>
      <div className="h-4 text-center text-[10px] leading-4 transition-opacity" role="status" aria-live="polite" style={{ color: themeColors.primary, opacity: actionFeedback ? 1 : 0 }}>
        {actionFeedback || ' '}
      </div>
    </footer>
  );
};

import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
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
  themeColors: ThemeColors;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (ms: number) => void;
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
  themeColors,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
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
            onChange={(e) => onSeek(Number(e.target.value))}
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
            <p className="text-[11px] truncate leading-tight" style={{ color: themeColors.textMuted }}>
              {currentSong ? currentSong.artist : isArabic ? 'اختر أغنية للبدء' : 'Select a song to start'}
            </p>
          </div>
        </div>

        {/* Center Buttons: Shuffle, Prev, Play/Pause, Next, Repeat */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlaybackMode}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title={
              playbackMode === 'SHUFFLE'
                ? 'Shuffle Active'
                : playbackMode === 'REPEAT_ONE'
                ? 'Repeat One'
                : playbackMode === 'REPEAT_ALL'
                ? 'Repeat All'
                : 'Normal Playback'
            }
            style={{
              color: playbackMode !== 'NORMAL' ? themeColors.primary : themeColors.textMuted,
            }}
          >
            {playbackMode === 'REPEAT_ONE' ? (
              <Repeat1 className="w-4 h-4" />
            ) : playbackMode === 'SHUFFLE' ? (
              <Shuffle className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={onPrev}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title="Previous Track"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={onPlayPause}
            className="p-2.5 rounded-full shadow-lg transition-transform active:scale-95"
            style={{
              backgroundColor: themeColors.primary,
              color: '#ffffff',
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <button
            onClick={onNext}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title="Next Track"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Right Tools: EQ, Queue, Volume, Fullscreen Expand */}
        <div className="flex items-center gap-2.5 w-1/4 justify-end">
          <button
            onClick={onOpenEqualizer}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Master Equalizer"
          >
            <Sliders className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
          </button>

          <button
            onClick={onOpenQueue}
            className="p-1.5 rounded hover:bg-white/10 transition-colors relative"
            title="Play Queue"
          >
            <ListMusic className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
          </button>

          {/* Volume slider */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => onVolumeChange(volume === 0 ? 0.8 : 0)}
              className="p-1 rounded hover:bg-white/10"
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
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-18 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
              style={{
                accentColor: themeColors.primary,
              }}
            />
          </div>

          <button
            onClick={onOpenNowPlaying}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Expand Full View"
          >
            <Maximize2 className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
          </button>
        </div>
      </div>
    </footer>
  );
};

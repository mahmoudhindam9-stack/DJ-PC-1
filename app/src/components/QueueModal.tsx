import React from 'react';
import { X, Trash2, Music, Play, Plus } from 'lucide-react';
import { AudioItem, Playlist, ThemeColors } from '../types';

interface QueueModalProps {
  queue: AudioItem[];
  currentSong: AudioItem | null;
  themeColors: ThemeColors;
  isArabic: boolean;
  onClose: () => void;
  onSelectSong: (song: AudioItem) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  playlists: Playlist[];
  onAddToPlaylist: (playlistId: string, song: AudioItem) => void;
}

export const QueueModal: React.FC<QueueModalProps> = ({
  queue,
  currentSong,
  themeColors,
  isArabic,
  onClose,
  onSelectSong,
  onRemoveFromQueue,
  onClearQueue,
  playlists,
  onAddToPlaylist,
}) => {
  return (
    <div
      id="queue-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none"
    >
      <div
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
          color: themeColors.textPrimary,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: themeColors.border }}>
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5" style={{ color: themeColors.primary }} />
            <h3 className="font-bold text-base">
              {isArabic ? 'قائمة التشغيل الحالية' : 'Play Queue'} ({queue.length})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <button
                onClick={onClearQueue}
                className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors flex items-center gap-1 text-xs"
                title="Clear Queue"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isArabic ? 'مسح' : 'Clear'}</span>
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {queue.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: themeColors.textMuted }}>
              {isArabic ? 'قائمة التشغيل فارغة' : 'The queue is currently empty.'}
            </div>
          ) : (
            queue.map((song, index) => {
              const isCurrent = currentSong?.id === song.id;
              return (
                <div
                  key={`${song.id}_${index}`}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    isCurrent ? 'font-bold' : 'hover:bg-white/5'
                  }`}
                  style={{
                    backgroundColor: isCurrent ? `${themeColors.primary}20` : themeColors.surfaceVariant,
                    borderColor: isCurrent ? themeColors.primary : 'transparent',
                  }}
                >
                  <div
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    onClick={() => onSelectSong(song)}
                  >
                    <span className="text-xs w-5 text-center font-mono opacity-60">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold truncate leading-tight">{song.title}</h4>
                      <p className="text-[11px] truncate leading-tight opacity-70">{song.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 ml-2">
                    <button
                      onClick={() => onRemoveFromQueue(index)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-neutral-400 hover:text-red-400"
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

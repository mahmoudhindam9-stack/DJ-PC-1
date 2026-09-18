import React, { useState, useEffect } from 'react';
import {
  Globe,
  Search,
  Play,
  Download,
  ListPlus,
  Disc,
  Flame,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { AudiusTrack, AudioItem, ThemeColors } from '../../types';
import { onlineMusicService } from '../../services/OnlineMusicService';

interface OnlineMusicScreenProps {
  themeColors: ThemeColors;
  isArabic: boolean;
  onPlayOnlineTrack: (track: AudioItem) => void;
  onSendToDeckA: (track: AudioItem) => void;
  onSendToDeckB: (track: AudioItem) => void;
  onEnqueueTrack: (track: AudioItem) => void;
  onSaveToLibrary: (track: AudioItem) => void;
}

export const OnlineMusicScreen: React.FC<OnlineMusicScreenProps> = ({
  themeColors,
  isArabic,
  onPlayOnlineTrack,
  onSendToDeckA,
  onSendToDeckB,
  onEnqueueTrack,
  onSaveToLibrary,
}) => {
  const [activeTab, setActiveTab] = useState<'TRENDING' | 'LATEST' | 'SEARCH'>('TRENDING');
  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadTracks = async (tab: 'TRENDING' | 'LATEST' | 'SEARCH', query = '') => {
    setIsLoading(true);
    try {
      if (tab === 'TRENDING') {
        const res = await onlineMusicService.getTrendingTracks();
        setTracks(res);
      } else if (tab === 'LATEST') {
        const res = await onlineMusicService.getLatestTracks();
        setTracks(res);
      } else if (tab === 'SEARCH' && query.trim()) {
        const res = await onlineMusicService.searchAudius(query);
        setTracks(res);
      }
    } catch (e) {
      console.warn('Online tracks load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'SEARCH') {
      loadTracks(activeTab);
    }
  }, [activeTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveTab('SEARCH');
      loadTracks('SEARCH', searchQuery);
    }
  };

  const formatMs = (ms: number) => {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      id="online-music-screen"
      className="flex-1 flex flex-col h-full overflow-hidden select-none p-4"
      style={{
        backgroundColor: themeColors.background,
        color: themeColors.textPrimary,
      }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-6 h-6" style={{ color: themeColors.primary }} />
          <div>
            <h1 className="text-lg font-black tracking-wide">
              {isArabic ? 'الموسيقى السحابية أونلاين' : 'CLOUD ONLINE MUSIC'}
            </h1>
            <p className="text-xs" style={{ color: themeColors.textMuted }}>
              Audius Streaming Network & Independent Artists
            </p>
          </div>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs"
            style={{
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            }}
          >
            <Search className="w-3.5 h-3.5 opacity-60" />
            <input
              type="text"
              placeholder={isArabic ? 'بحث عن أغاني أو فنانين...' : 'Search tracks or artists...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none w-48 text-xs"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{
              backgroundColor: themeColors.primary,
              color: '#ffffff',
            }}
          >
            {isArabic ? 'بحث' : 'Search'}
          </button>
        </form>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b pb-2 mb-3" style={{ borderColor: themeColors.border }}>
        <button
          onClick={() => setActiveTab('TRENDING')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
            activeTab === 'TRENDING' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
          }`}
          style={{
            backgroundColor: activeTab === 'TRENDING' ? themeColors.primary : themeColors.surfaceVariant,
            borderColor: activeTab === 'TRENDING' ? themeColors.primary : themeColors.border,
            color: activeTab === 'TRENDING' ? '#ffffff' : themeColors.textPrimary,
          }}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>{isArabic ? 'الأكثر رواجاً (Trending)' : 'Trending Hits'}</span>
        </button>

        <button
          onClick={() => setActiveTab('LATEST')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
            activeTab === 'LATEST' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
          }`}
          style={{
            backgroundColor: activeTab === 'LATEST' ? themeColors.primary : themeColors.surfaceVariant,
            borderColor: activeTab === 'LATEST' ? themeColors.primary : themeColors.border,
            color: activeTab === 'LATEST' ? '#ffffff' : themeColors.textPrimary,
          }}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{isArabic ? 'الإصدارات الحديثة' : 'Latest Releases'}</span>
        </button>
      </div>

      {/* Tracks Container */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="py-20 text-center text-xs opacity-70 flex flex-col items-center gap-2">
            <Globe className="w-8 h-8 animate-spin" style={{ color: themeColors.primary }} />
            <span>{isArabic ? 'جاري الاتصال بشبكة الموسيقى...' : 'Connecting to music stream...'}</span>
          </div>
        ) : tracks.length === 0 ? (
          <div className="py-20 text-center text-xs opacity-60">
            {isArabic ? 'لا توجد نتائج للعرض.' : 'No tracks found.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tracks.map((t) => {
              const audioItem = onlineMusicService.convertToAudioItem(t);
              return (
                <div
                  key={t.id}
                  className="p-3.5 rounded-2xl border flex flex-col justify-between group hover:border-blue-400 transition-all"
                  style={{
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border relative flex items-center justify-center"
                      style={{
                        borderColor: themeColors.border,
                        backgroundColor: themeColors.surfaceVariant,
                      }}
                    >
                      {t.artworkUrl ? (
                        <img src={t.artworkUrl} alt={t.title} className="w-full h-full object-cover" />
                      ) : (
                        <Disc className="w-6 h-6 opacity-40" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs truncate leading-snug">{t.title}</h4>
                      <p className="text-[11px] opacity-70 truncate mt-0.5">{t.artist}</p>
                      {t.genre && (
                        <span
                          className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold"
                          style={{
                            backgroundColor: `${themeColors.primary}20`,
                            color: themeColors.primary,
                          }}
                        >
                          {t.genre}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t" style={{ borderColor: themeColors.border }}>
                    <button
                      onClick={() => onPlayOnlineTrack(audioItem)}
                      className="px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                      style={{
                        backgroundColor: themeColors.primary,
                        color: '#ffffff',
                      }}
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      <span>{isArabic ? 'تشغيل' : 'Play'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onSendToDeckA(audioItem)}
                        className="p-1.5 rounded-lg border hover:bg-white/5 text-[11px] font-bold"
                        style={{ borderColor: themeColors.accentA, color: themeColors.accentA }}
                        title="Send to Deck A"
                      >
                        A
                      </button>

                      <button
                        onClick={() => onSendToDeckB(audioItem)}
                        className="p-1.5 rounded-lg border hover:bg-white/5 text-[11px] font-bold"
                        style={{ borderColor: themeColors.accentB, color: themeColors.accentB }}
                        title="Send to Deck B"
                      >
                        B
                      </button>

                      <button
                        onClick={() => onEnqueueTrack(audioItem)}
                        className="p-1.5 rounded-lg border hover:bg-white/5"
                        style={{ borderColor: themeColors.border }}
                        title="Add to queue"
                      >
                        <ListPlus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onSaveToLibrary(audioItem)}
                        className="p-1.5 rounded-lg border hover:bg-white/5"
                        style={{ borderColor: themeColors.border }}
                        title="Save to Library"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

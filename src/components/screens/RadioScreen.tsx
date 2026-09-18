import React, { useState, useEffect } from 'react';
import {
  Radio as RadioIcon,
  Search,
  Play,
  Pause,
  Heart,
  Disc,
  ListPlus,
  Globe,
  Flame,
  Volume2,
  ExternalLink,
} from 'lucide-react';
import { RadioStation, AudioItem, ThemeColors } from '../../types';
import { radioService, EGYPT_QURAN_STATION } from '../../services/RadioService';
import { db } from '../../storage/db';

interface RadioScreenProps {
  themeColors: ThemeColors;
  isArabic: boolean;
  onPlayStation: (station: RadioStation) => void;
  currentPlayingStationId: string | null;
  isPlayingRadio: boolean;
  onSendToDeckA: (item: AudioItem) => void;
  onSendToDeckB: (item: AudioItem) => void;
  onEnqueueSong: (item: AudioItem) => void;
}

export const RadioScreen: React.FC<RadioScreenProps> = ({
  themeColors,
  isArabic,
  onPlayStation,
  currentPlayingStationId,
  isPlayingRadio,
  onSendToDeckA,
  onSendToDeckB,
  onEnqueueSong,
}) => {
  const [activeTab, setActiveTab] = useState<'EG' | 'WORLD' | 'FAVORITES'>('EG');
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Fetch stations and persist favorites exactly like the mobile app.
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const load = async () => {
      try {
        if (activeTab === 'FAVORITES') {
          const favorites = await db.getRadioFavorites();
          if (isMounted) {
            setStations(favorites);
            setFavoriteIds(new Set(favorites.map((station) => station.id)));
          }
          return;
        }

        const country = activeTab === 'EG' ? 'EG' : null;
        const res = await radioService.getStations(country, searchQuery);
        const favorites = await db.getRadioFavorites();
        if (isMounted) {
          setStations(res);
          setFavoriteIds(new Set(favorites.map((station) => station.id)));
        }
      } catch (error) {
        console.warn('Radio station loading notice:', error);
        if (isMounted) setStations([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [activeTab, searchQuery]);

  const toggleFavorite = async (station: RadioStation) => {
    try {
      const isFavorite = await db.toggleRadioFavorite(station);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFavorite) next.add(station.id);
        else next.delete(station.id);
        return next;
      });
    } catch (error) {
      console.warn('Radio favorite update notice:', error);
    }
  };

  const displayedStations =
    activeTab === 'FAVORITES'
      ? stations
      : stations;

  const stationToAudioItem = (station: RadioStation): AudioItem => ({
    id: 'radio_' + station.id,
    title: station.name,
    artist: 'Live Radio FM',
    album: station.tags || 'Broadcasting',
    duration: 0,
    uri: station.streamUrls[0] || '',
    addedDate: Date.now(),
  });

  return (
    <div
      id="radio-screen"
      className="flex-1 flex flex-col h-full overflow-hidden select-none p-4"
      style={{
        backgroundColor: themeColors.background,
        color: themeColors.textPrimary,
      }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <RadioIcon className="w-6 h-6" style={{ color: themeColors.primary }} />
          <div>
            <h1 className="text-lg font-black tracking-wide">
              {isArabic ? 'محطات الراديو المباشرة' : 'LIVE RADIO FM DIRECT'}
            </h1>
            <p className="text-xs" style={{ color: themeColors.textMuted }}>
              Egypt, Worldwide Broadcasts & Direct Streaming
            </p>
          </div>
        </div>

        {/* Search */}
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
            placeholder={isArabic ? 'بحث عن محطة إذاعية...' : 'Search stations...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent outline-none w-48 text-xs"
          />
        </div>
      </div>

      {/* Scope Tabs */}
      <div className="flex items-center gap-2 border-b pb-2 mb-3" style={{ borderColor: themeColors.border }}>
        <button
          onClick={() => setActiveTab('EG')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            activeTab === 'EG' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
          }`}
          style={{
            backgroundColor: activeTab === 'EG' ? themeColors.primary : themeColors.surfaceVariant,
            borderColor: activeTab === 'EG' ? themeColors.primary : themeColors.border,
            color: activeTab === 'EG' ? '#ffffff' : themeColors.textPrimary,
          }}
        >
          🇪🇬 {isArabic ? 'إذاعات مصر والقرآن الكريم' : 'Egypt & Quran Cairo'}
        </button>

        <button
          onClick={() => setActiveTab('WORLD')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            activeTab === 'WORLD' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
          }`}
          style={{
            backgroundColor: activeTab === 'WORLD' ? themeColors.primary : themeColors.surfaceVariant,
            borderColor: activeTab === 'WORLD' ? themeColors.primary : themeColors.border,
            color: activeTab === 'WORLD' ? '#ffffff' : themeColors.textPrimary,
          }}
        >
          🌍 {isArabic ? 'الإذاعات العالمية' : 'World Top Stations'}
        </button>

        <button
          onClick={() => setActiveTab('FAVORITES')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            activeTab === 'FAVORITES' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
          }`}
          style={{
            backgroundColor: activeTab === 'FAVORITES' ? themeColors.primary : themeColors.surfaceVariant,
            borderColor: activeTab === 'FAVORITES' ? themeColors.primary : themeColors.border,
            color: activeTab === 'FAVORITES' ? '#ffffff' : themeColors.textPrimary,
          }}
        >
          ❤️ {isArabic ? 'محطاتي المفضلة' : 'Favorites'} ({favoriteIds.size})
        </button>
      </div>

      {/* Stations List Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="py-20 text-center text-xs opacity-70 flex flex-col items-center gap-2">
            <RadioIcon className="w-8 h-8 animate-pulse" style={{ color: themeColors.primary }} />
            <span>{isArabic ? 'جاري الاتصال بمحطات الراديو...' : 'Tuning frequencies & streams...'}</span>
          </div>
        ) : displayedStations.length === 0 ? (
          <div className="py-20 text-center text-xs opacity-60">
            {isArabic ? 'لم يتم العثور على محطات.' : 'No stations found for this query.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedStations.map((st) => {
              const isCurrent = currentPlayingStationId === st.id && isPlayingRadio;
              const isFav = favoriteIds.has(st.id);
              const isQuran = st.id === EGYPT_QURAN_STATION.id;

              return (
                <div
                  key={st.id}
                  className={`p-3.5 rounded-2xl border flex flex-col justify-between transition-all ${
                    isQuran ? 'ring-1' : ''
                  }`}
                  style={{
                    backgroundColor: isCurrent ? `${themeColors.primary}20` : themeColors.surface,
                    borderColor: isCurrent
                      ? themeColors.primary
                      : isQuran
                      ? themeColors.tertiary
                      : themeColors.border,
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                          style={{
                            backgroundColor: `${themeColors.primary}25`,
                            color: themeColors.primary,
                          }}
                        >
                          {st.codec || 'MP3'}
                        </span>
                        {st.bitrate ? (
                          <span className="text-[10px] opacity-60 font-mono">
                            {st.bitrate} kbps
                          </span>
                        ) : null}
                      </div>

                      <button
                        onClick={() => { void toggleFavorite(st); }}
                        className="p-1.5 rounded-full hover:bg-white/10"
                        title="Favorite"
                      >
                        <Heart
                          className="w-4 h-4"
                          style={{
                            color: isFav ? '#ff1744' : themeColors.textMuted,
                            fill: isFav ? '#ff1744' : 'none',
                          }}
                        />
                      </button>
                    </div>

                    <h3 className="font-bold text-sm leading-snug truncate" title={st.name}>
                      {st.name}
                    </h3>
                    <p className="text-[11px] opacity-70 truncate mt-0.5">
                      {st.tags || (isArabic ? 'بث مباشر' : 'Live stream')}
                    </p>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t" style={{ borderColor: themeColors.border }}>
                    <button
                      onClick={() => onPlayStation(st)}
                      className="px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
                      style={{
                        backgroundColor: isCurrent ? themeColors.accentB : themeColors.primary,
                        color: '#ffffff',
                      }}
                    >
                      {isCurrent ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                      <span>{isCurrent ? (isArabic ? 'إيقاف' : 'Pause') : (isArabic ? 'استماع' : 'Listen')}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onSendToDeckA(stationToAudioItem(st))}
                        className="p-1.5 rounded-lg border hover:bg-white/5 text-[11px] font-bold"
                        style={{ borderColor: themeColors.accentA, color: themeColors.accentA }}
                        title="Send stream to Deck A"
                      >
                        A
                      </button>

                      <button
                        onClick={() => onSendToDeckB(stationToAudioItem(st))}
                        className="p-1.5 rounded-lg border hover:bg-white/5 text-[11px] font-bold"
                        style={{ borderColor: themeColors.accentB, color: themeColors.accentB }}
                        title="Send stream to Deck B"
                      >
                        B
                      </button>

                      <button
                        onClick={() => onEnqueueSong(stationToAudioItem(st))}
                        className="p-1.5 rounded-lg border hover:bg-white/5"
                        style={{ borderColor: themeColors.border }}
                        title="Add to queue"
                      >
                        <ListPlus className="w-3.5 h-3.5" />
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

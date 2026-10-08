import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Disc,
  Download,
  Globe,
  ListPlus,
  Music2,
  Play,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  AlbumatyHomeData,
  AlbumatyLink,
  AlbumatySection,
  onlineMusicService,
} from '../../services/OnlineMusicService';
import { AudioItem, AudiusTrack, ThemeColors } from '../../types';

interface OnlineMusicScreenProps {
  themeColors: ThemeColors;
  isArabic: boolean;
  onPlayOnlineTrack: (track: AudioItem) => void;
  onSendToDeckA: (track: AudioItem) => void;
  onSendToDeckB: (track: AudioItem) => void;
  onEnqueueTrack: (track: AudioItem) => void;
  onSaveToLibrary: (track: AudioItem) => void;
  onOpenQueue: () => void;
}

const EMPTY_ALBUMATY: AlbumatyHomeData = {
  categories: [],
  albums: [],
  songs: [],
  artists: [],
};

function isSong(url: string): boolean {
  try {
    return (
      new URL(url).pathname.toLowerCase().split('/').filter(Boolean)[0] === 'song'
    );
  } catch {
    return false;
  }
}

function formatMs(ms?: number): string {
  if (!ms || Number.isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export const OnlineMusicScreen: React.FC<OnlineMusicScreenProps> = ({
  themeColors,
  isArabic,
  onPlayOnlineTrack,
  onSendToDeckA,
  onSendToDeckB,
  onEnqueueTrack,
  onSaveToLibrary,
  onOpenQueue,
}) => {
  const [source, setSource] = useState<'ALBUMATY' | 'AUDIUS'>('ALBUMATY');
  const [albumatyHome, setAlbumatyHome] = useState<AlbumatyHomeData>(EMPTY_ALBUMATY);
  const [albumatySection, setAlbumatySection] = useState<AlbumatySection | null>(null);
  const [audiusTracks, setAudiusTracks] = useState<AudiusTrack[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadAlbumaty = async (force = false) => {
    setLoading(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      setAlbumatyHome(await onlineMusicService.getAlbumatyHome(force));
      setAlbumatySection(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to load Albumaty.'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadAudius = async () => {
    setLoading(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      const [trending, latest] = await Promise.all([
        onlineMusicService.getTrendingTracks(),
        onlineMusicService.getLatestTracks(),
      ]);
      setAudiusTracks(
        [...trending, ...latest].filter(
          (track, index, all) =>
            all.findIndex((item) => item.id === track.id) === index
        )
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to load Audius.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (source === 'ALBUMATY') {
      void loadAlbumaty();
    } else {
      void loadAudius();
    }
  }, [source]);

  const filteredAlbumaty = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return albumatyHome;
    const filter = (items: AlbumatyLink[]) =>
      items.filter((item) => item.title.toLocaleLowerCase().includes(q));
    return {
      categories: filter(albumatyHome.categories),
      albums: filter(albumatyHome.albums),
      songs: filter(albumatyHome.songs),
      artists: filter(albumatyHome.artists),
    };
  }, [albumatyHome, query]);

  const filteredAudius = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return audiusTracks;
    return audiusTracks.filter(
      (track) =>
        track.title.toLocaleLowerCase().includes(q) ||
        track.artist.toLocaleLowerCase().includes(q) ||
        (track.genre || '').toLocaleLowerCase().includes(q)
    );
  }, [audiusTracks, query]);

  const resolveAndAct = async (
    link: AlbumatyLink,
    action: (item: AudioItem, title: string) => void
  ) => {
    setMessage(isArabic ? 'جاري تجهيز الأغنية...' : 'Preparing song...');
    try {
      const resolved = await onlineMusicService.resolveAlbumatySong(link.url);
      const item = onlineMusicService.convertResolvedToAudioItem(resolved, link.url);
      action(item, resolved.title);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Failed to prepare song.'
      );
    }
  };

  const openAlbumatyLink = async (link: AlbumatyLink) => {
    setLoading(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      setAlbumatySection(await onlineMusicService.getAlbumatySection(link.url));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to open section.'
      );
    } finally {
      setLoading(false);
    }
  };

  const playAlbumaty = (link: AlbumatyLink) => {
    if (!isSong(link.url)) {
      void openAlbumatyLink(link);
      return;
    }
    void resolveAndAct(link, (item, title) => {
      onPlayOnlineTrack(item);
      setMessage(isArabic ? `يعمل الآن: ${title}` : `Playing: ${title}`);
    });
  };

  const queueAlbumaty = (link: AlbumatyLink) => {
    if (!isSong(link.url)) {
      void openAlbumatyLink(link);
      return;
    }
    void resolveAndAct(link, (item, title) => {
      onEnqueueTrack(item);
      setMessage(isArabic ? `تمت إضافة ${title} إلى Queue` : `Added ${title} to Queue`);
    });
  };

  const sendAlbumatyToDeck = (link: AlbumatyLink, deck: 'A' | 'B') => {
    if (!isSong(link.url)) {
      void openAlbumatyLink(link);
      return;
    }
    void resolveAndAct(link, (item, title) => {
      if (deck === 'A') onSendToDeckA(item);
      else onSendToDeckB(item);
      setMessage(
        isArabic ? `تم إرسال ${title} إلى Deck ${deck}` : `Sent ${title} to Deck ${deck}`
      );
    });
  };

  const saveAlbumaty = (link: AlbumatyLink) => {
    if (!isSong(link.url)) {
      void openAlbumatyLink(link);
      return;
    }
    void resolveAndAct(link, (item, title) => {
      onSaveToLibrary(item);
      setMessage(
        isArabic ? `تم حفظ ${title} في المكتبة` : `Saved ${title} to Library`
      );
    });
  };

  const downloadAlbumaty = (link: AlbumatyLink) => {
    if (!isSong(link.url)) {
      void openAlbumatyLink(link);
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = onlineMusicService.getAlbumatyDownloadEndpoint(link.url);
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setMessage(isArabic ? 'بدأ تنزيل الأغنية...' : 'Song download started...');
  };

  const playAudius = (track: AudiusTrack) => {
    onPlayOnlineTrack(onlineMusicService.convertAudiusToAudioItem(track));
    setMessage(isArabic ? `يعمل الآن: ${track.title}` : `Playing: ${track.title}`);
  };

  const queueAudius = (track: AudiusTrack) => {
    onEnqueueTrack(onlineMusicService.convertAudiusToAudioItem(track));
    setMessage(isArabic ? `تمت إضافة ${track.title} إلى Queue` : `Added ${track.title} to Queue`);
  };

  const saveAudius = (track: AudiusTrack) => {
    onSaveToLibrary(onlineMusicService.convertAudiusToAudioItem(track));
    setMessage(isArabic ? `تم حفظ ${track.title} في المكتبة` : `Saved ${track.title} to Library`);
  };

  const sendAudiusToDeck = (track: AudiusTrack, deck: 'A' | 'B') => {
    const item = onlineMusicService.convertAudiusToAudioItem(track);
    if (deck === 'A') onSendToDeckA(item);
    else onSendToDeckB(item);
  };

  const renderAlbumatySongCard = (link: AlbumatyLink) => (
    <div
      key={link.url}
      className="rounded-2xl border p-3.5 flex items-center gap-3 shadow-sm"
      style={{
        backgroundColor: themeColors.surface,
        borderColor: themeColors.border,
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
        style={{
          backgroundColor: themeColors.surfaceVariant,
          borderColor: themeColors.border,
        }}
      >
        <Music2 className="w-5 h-5" style={{ color: themeColors.primary }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-xs truncate" title={link.title}>
          {link.title}
        </div>
        <div className="text-[10px] opacity-50 truncate" title={link.url}>
          {link.url}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => playAlbumaty(link)}
          className="p-1.5 rounded-lg border"
          style={{
            backgroundColor: themeColors.primary,
            borderColor: themeColors.primary,
            color: '#fff',
          }}
          title={isArabic ? 'تشغيل' : 'Play'}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
        </button>
        <button
          onClick={() => queueAlbumaty(link)}
          className="p-1.5 rounded-lg border"
          style={{ borderColor: themeColors.border }}
          title={isArabic ? 'إضافة للانتظار' : 'Add to queue'}
        >
          <ListPlus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => downloadAlbumaty(link)}
          className="p-1.5 rounded-lg border"
          style={{ borderColor: themeColors.border }}
          title={isArabic ? 'تنزيل' : 'Download'}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => saveAlbumaty(link)}
          className="p-1.5 rounded-lg border"
          style={{ borderColor: themeColors.border }}
          title={isArabic ? 'حفظ في المكتبة' : 'Save to library'}
        >
          <Disc className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => sendAlbumatyToDeck(link, 'A')}
          className="px-1.5 py-1 rounded-lg border text-[10px] font-bold"
          style={{ borderColor: themeColors.accentA, color: themeColors.accentA }}
          title="Deck A"
        >
          A
        </button>
        <button
          onClick={() => sendAlbumatyToDeck(link, 'B')}
          className="px-1.5 py-1 rounded-lg border text-[10px] font-bold"
          style={{ borderColor: themeColors.accentB, color: themeColors.accentB }}
          title="Deck B"
        >
          B
        </button>
      </div>
    </div>
  );

  const renderAudiusCard = (track: AudiusTrack) => (
    <div
      key={track.id}
      className="rounded-2xl border p-3 flex items-center gap-3"
      style={{
        backgroundColor: themeColors.surface,
        borderColor: themeColors.border,
      }}
    >
      <div
        className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border flex items-center justify-center"
        style={{
          borderColor: themeColors.border,
          backgroundColor: themeColors.surfaceVariant,
        }}
      >
        {track.artworkUrl ? (
          <img
            src={track.artworkUrl}
            alt=""
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <Music2 className="w-5 h-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-xs truncate">{track.title}</div>
        <div className="text-[11px] opacity-70 truncate">{track.artist}</div>
        <div className="text-[10px] opacity-50 mt-1">
          {track.genre || 'Audius'} · {formatMs(track.duration)}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => playAudius(track)}
          className="p-1.5 rounded-lg border"
          style={{
            backgroundColor: themeColors.primary,
            borderColor: themeColors.primary,
            color: '#fff',
          }}
          title={isArabic ? 'تشغيل' : 'Play'}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
        </button>
        <button
          onClick={() => queueAudius(track)}
          className="p-1.5 rounded-lg border"
          style={{ borderColor: themeColors.border }}
          title={isArabic ? 'إضافة للانتظار' : 'Add to queue'}
        >
          <ListPlus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            if (track.streamUrl) window.open(track.streamUrl, '_blank', 'noopener,noreferrer');
          }}
          className="p-1.5 rounded-lg border"
          style={{ borderColor: themeColors.border }}
          title={isArabic ? 'فتح البث' : 'Open stream'}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => saveAudius(track)}
          className="p-1.5 rounded-lg border"
          style={{ borderColor: themeColors.border }}
          title={isArabic ? 'حفظ في المكتبة' : 'Save to library'}
        >
          <Disc className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => sendAudiusToDeck(track, 'A')}
          className="px-1.5 py-1 rounded-lg border text-[10px] font-bold"
          style={{ borderColor: themeColors.accentA, color: themeColors.accentA }}
        >
          A
        </button>
        <button
          onClick={() => sendAudiusToDeck(track, 'B')}
          className="px-1.5 py-1 rounded-lg border text-[10px] font-bold"
          style={{ borderColor: themeColors.accentB, color: themeColors.accentB }}
        >
          B
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-hidden p-4"
      style={{
        backgroundColor: themeColors.background,
        color: themeColors.textPrimary,
      }}
    >
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {albumatySection && (
            <button
              onClick={() => setAlbumatySection(null)}
              className="p-2 rounded-xl border"
              style={{ borderColor: themeColors.border }}
              title={isArabic ? 'رجوع' : 'Back'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <Globe className="w-6 h-6 shrink-0" style={{ color: themeColors.primary }} />
          <div className="min-w-0">
            <h1 className="text-lg font-black tracking-wide truncate">
              {source === 'ALBUMATY'
                ? isArabic
                  ? 'الموسيقى أونلاين — ألبوماتي'
                  : 'Online Music — Albumaty'
                : isArabic
                  ? 'الموسيقى الأجنبية — Audius'
                  : 'Foreign Music — Audius'}
            </h1>
            <p className="text-xs truncate" style={{ color: themeColors.textMuted }}>
              {source === 'ALBUMATY'
                ? isArabic
                  ? 'كتالوج ألبوماتي مباشر — بدون أي أغاني تجريبية داخل البرنامج'
                  : 'Live Albumaty catalog — no bundled demo songs'
                : isArabic
                  ? 'كتالوج Audius مباشر — بدون أغاني تجريبية'
                  : 'Live Audius catalog — no bundled demo songs'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenQueue}
            className="px-3 py-2 rounded-xl border text-xs font-bold"
            style={{ borderColor: themeColors.border }}
            title="Queue"
          >
            Q / Queue
          </button>
          <button
            onClick={() =>
              source === 'ALBUMATY' ? void loadAlbumaty(true) : void loadAudius()
            }
            className="p-2 rounded-xl border"
            style={{ borderColor: themeColors.border }}
            title={isArabic ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => {
            setSource('ALBUMATY');
            setQuery('');
            setAlbumatySection(null);
            setErrorMessage(null);
          }}
          className="flex-1 rounded-xl border px-3 py-2 text-xs font-bold flex items-center justify-center gap-2"
          style={{
            backgroundColor:
              source === 'ALBUMATY'
                ? themeColors.primary
                : themeColors.surfaceVariant,
            borderColor:
              source === 'ALBUMATY'
                ? themeColors.primary
                : themeColors.border,
            color: source === 'ALBUMATY' ? '#fff' : themeColors.textPrimary,
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          🇦🇪 Arabic
        </button>
        <button
          onClick={() => {
            setSource('AUDIUS');
            setQuery('');
            setAlbumatySection(null);
            setErrorMessage(null);
          }}
          className="flex-1 rounded-xl border px-3 py-2 text-xs font-bold flex items-center justify-center gap-2"
          style={{
            backgroundColor:
              source === 'AUDIUS'
                ? themeColors.primary
                : themeColors.surfaceVariant,
            borderColor:
              source === 'AUDIUS'
                ? themeColors.primary
                : themeColors.border,
            color: source === 'AUDIUS' ? '#fff' : themeColors.textPrimary,
          }}
        >
          <Globe className="w-3.5 h-3.5" />
          🌎 Foreign
        </button>
      </div>

      <div
        className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl border"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
      >
        <Search className="w-4 h-4 opacity-60" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-transparent outline-none flex-1 text-xs"
          placeholder={
            source === 'ALBUMATY'
              ? isArabic
                ? 'ابحث في ألبوماتي'
                : 'Search Albumaty'
              : isArabic
                ? 'ابحث في الموسيقى الأجنبية'
                : 'Search foreign music'
          }
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-xs opacity-70">
            <RefreshCw
              className="w-8 h-8 animate-spin"
              style={{ color: themeColors.primary }}
            />
            {isArabic ? 'جاري جلب الكتالوج من الإنترنت...' : 'Loading live online catalog...'}
          </div>
        ) : errorMessage ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center text-xs">
            <div className="font-bold max-w-xl">{errorMessage}</div>
            <button
              onClick={() =>
                source === 'ALBUMATY' ? void loadAlbumaty(true) : void loadAudius()
              }
              className="px-3 py-2 rounded-xl font-bold"
              style={{ backgroundColor: themeColors.primary, color: '#fff' }}
            >
              {isArabic ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : source === 'ALBUMATY' ? (
          albumatySection ? (
            <div className="space-y-3">
              <div
                className="rounded-2xl border p-4"
                style={{
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                }}
              >
                <div className="text-sm font-black">{albumatySection.title}</div>
              </div>

              {albumatySection.content.length === 0 ? (
                <div className="py-12 text-center text-xs opacity-60">
                  {isArabic ? 'لا توجد عناصر متاحة.' : 'No online items found.'}
                </div>
              ) : (
                albumatySection.content.map((link) =>
                  isSong(link.url)
                    ? renderAlbumatySongCard(link)
                    : (
                      <button
                        key={link.url}
                        onClick={() => void openAlbumatyLink(link)}
                        className="w-full text-left rounded-2xl border p-3"
                        style={{
                          backgroundColor: themeColors.surface,
                          borderColor: themeColors.border,
                        }}
                      >
                        <div className="font-bold text-xs truncate" title={link.title}>
                          {link.title}
                        </div>
                        <div className="text-[10px] opacity-50 mt-1 truncate" title={link.url}>
                          {link.url}
                        </div>
                      </button>
                    )
                )
              )}
              {message && <div className="px-1 text-xs opacity-70">{message}</div>}
            </div>
          ) : (
            <div className="space-y-5">
              <OnlineSection
                title={isArabic ? 'الأقسام' : 'Sections'}
                links={filteredAlbumaty.categories}
                themeColors={themeColors}
                onOpen={openAlbumatyLink}
              />
              <OnlineSection
                title={isArabic ? 'أحدث الألبومات' : 'New Albums'}
                links={filteredAlbumaty.albums}
                themeColors={themeColors}
                onOpen={openAlbumatyLink}
              />
              <OnlineSection
                title={isArabic ? 'أحدث الأغاني' : 'New Songs'}
                links={filteredAlbumaty.songs}
                themeColors={themeColors}
                onOpen={playAlbumaty}
                song
              />
              <OnlineSection
                title={isArabic ? 'الفنانون' : 'Artists'}
                links={filteredAlbumaty.artists}
                themeColors={themeColors}
                onOpen={openAlbumatyLink}
              />
              {message && <div className="px-1 text-xs opacity-70">{message}</div>}
            </div>
          )
        ) : (
          <div className="space-y-2">
            {filteredAudius.length === 0 ? (
              <div className="py-12 text-center text-xs opacity-60">
                {isArabic ? 'لا توجد نتائج.' : 'No tracks found.'}
              </div>
            ) : (
              filteredAudius.map(renderAudiusCard)
            )}
            {message && <div className="px-1 text-xs opacity-70">{message}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

const OnlineSection: React.FC<{
  title: string;
  links: AlbumatyLink[];
  themeColors: ThemeColors;
  onOpen: (link: AlbumatyLink) => void;
  song?: boolean;
}> = ({ title, links, themeColors, onOpen, song }) => {
  if (links.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-2 px-1">
        {song ? (
          <Music2 className="w-4 h-4" style={{ color: themeColors.primary }} />
        ) : (
          <Sparkles className="w-4 h-4" style={{ color: themeColors.primary }} />
        )}
        <h2 className="text-sm font-black">{title}</h2>
      </div>
      <div className="space-y-2">
        {links.slice(0, song ? 100 : 60).map((link) =>
          song ? (
            <AlbumatySongRow
              key={link.url}
              link={link}
              onPlay={onOpen}
              themeColors={themeColors}
            />
          ) : (
            <button
              key={link.url}
              onClick={() => onOpen(link)}
              className="w-full text-left rounded-2xl border px-3 py-2.5 text-xs font-bold"
              style={{
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
              }}
            >
              {link.title}
            </button>
          )
        )}
      </div>
    </section>
  );
};

const AlbumatySongRow: React.FC<{
  link: AlbumatyLink;
  onPlay: (link: AlbumatyLink) => void;
  themeColors: ThemeColors;
}> = ({ link, onPlay, themeColors }) => (
  <div
    className="rounded-2xl border p-3 flex items-center gap-3"
    style={{
      backgroundColor: themeColors.surface,
      borderColor: themeColors.border,
    }}
  >
    <Music2 className="w-5 h-5 shrink-0 opacity-70" />
    <div className="min-w-0 flex-1">
      <div className="font-bold text-xs truncate" title={link.title}>
        {link.title}
      </div>
      <div className="text-[10px] opacity-50 truncate" title={link.url}>
        {link.url}
      </div>
    </div>
    <button
      onClick={() => onPlay(link)}
      className="p-2 rounded-xl"
      aria-label="Play"
    >
      <Play className="w-4 h-4 fill-current" style={{ color: themeColors.primary }} />
    </button>
  </div>
);

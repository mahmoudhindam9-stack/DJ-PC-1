import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Disc,
  Download,
  Globe,
  ListPlus,
  ListMusic,
  Music2,
  X,
  Plus,
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
import { AudioItem, AudiusTrack, Playlist, ThemeColors } from '../../types';
import { downloadOnlineItem } from '../../services/OnlineMusicService';

interface OnlineMusicScreenProps {
  themeColors: ThemeColors;
  isArabic: boolean;
  onPlayOnlineTrack: (track: AudioItem) => void;
  onSendToDeckA: (track: AudioItem) => void;
  onSendToDeckB: (track: AudioItem) => void;
  onEnqueueTrack: (track: AudioItem) => void;
  onSaveToLibrary: (track: AudioItem) => void;
  playlists: Playlist[];
  onAddSongToPlaylist: (playlistId: string, track: AudioItem) => Promise<void>;
  onCreatePlaylist: (name: string) => Promise<Playlist>;
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
  playlists,
  onAddSongToPlaylist,
  onCreatePlaylist,
  onOpenQueue,
}) => {
  const [source, setSource] = useState<'ALBUMATY' | 'AUDIUS'>('ALBUMATY');
  const [albumatyHome, setAlbumatyHome] = useState<AlbumatyHomeData>(EMPTY_ALBUMATY);
  const [albumatySearchResults, setAlbumatySearchResults] = useState<AlbumatyHomeData | null>(null);
  const [albumatySection, setAlbumatySection] = useState<AlbumatySection | null>(null);
  const [audiusTracks, setAudiusTracks] = useState<AudiusTrack[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [pendingPlaylistTrack, setPendingPlaylistTrack] = useState<AudioItem | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlistBusy, setPlaylistBusy] = useState(false);

  const loadAlbumaty = async (force = false) => {
    setLoading(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      setAlbumatyHome(await onlineMusicService.getAlbumatyHome(force));
      setAlbumatySearchResults(null);
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
      setAlbumatySearchResults(null);
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

  const performOnlineSearch = async () => {
    const searchTerm = query.trim();
    if (!searchTerm || loading) return;

    setLoading(true);
    setErrorMessage(null);
    setMessage(null);
    setAlbumatySection(null);
    try {
      if (source === 'ALBUMATY') {
        const results = await onlineMusicService.searchAlbumaty(searchTerm);
        setAlbumatySearchResults(results);
      } else {
        const results = await onlineMusicService.searchAudius(searchTerm);
        setAudiusTracks(results);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : (isArabic ? 'تعذر البحث عن الأغاني.' : 'Could not search online music.')
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

  const activeAlbumaty = albumatySearchResults ?? filteredAlbumaty;

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
    if (!isSong(link.url)) { void openAlbumatyLink(link); return; }
    const item: AudioItem = {
      id: link.url, title: link.title, artist: 'Albumaty', album: 'Albumaty Online', duration: 0,
      uri: onlineMusicService.getAlbumatyStreamEndpoint(link.url), addedDate: Date.now(),
      onlineSource: 'ALBUMATY', sourceUrl: link.url,
      downloadUri: onlineMusicService.getAlbumatyDownloadEndpoint(link.url),
    };
    if (downloadOnlineItem(item)) setMessage(isArabic ? 'بدأ تنزيل الأغنية...' : 'Song download started...');
    else setErrorMessage(isArabic ? 'تعذر تجهيز رابط التنزيل.' : 'Could not prepare the download.');
  };

  const addAlbumatyToPlaylist = (link: AlbumatyLink) => {
    if (!isSong(link.url)) { void openAlbumatyLink(link); return; }
    void resolveAndAct(link, (item, title) => {
      setPendingPlaylistTrack(item);
      setShowPlaylistPicker(true);
      setMessage(isArabic ? `اختر قائمة لإضافة ${title}` : `Choose a playlist for ${title}`);
    });
  };

  const addAudiusToPlaylist = (track: AudiusTrack) => {
    setPendingPlaylistTrack(onlineMusicService.convertAudiusToAudioItem(track));
    setShowPlaylistPicker(true);
    setMessage(isArabic ? `اختر قائمة لإضافة ${track.title}` : `Choose a playlist for ${track.title}`);
  };

  const choosePlaylist = async (playlistId: string) => {
    if (!pendingPlaylistTrack || playlistBusy) return;
    setPlaylistBusy(true);
    try {
      await onAddSongToPlaylist(playlistId, pendingPlaylistTrack);
      setMessage(isArabic ? `تمت إضافة "${pendingPlaylistTrack.title}" إلى قائمة التشغيل` : `Added "${pendingPlaylistTrack.title}" to the playlist`);
      setShowPlaylistPicker(false);
      setPendingPlaylistTrack(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذرت إضافة الأغنية للقائمة.' : 'Could not add the track to the playlist.'));
    } finally {
      setPlaylistBusy(false);
    }
  };

  const createPlaylistAndAdd = async () => {
    if (!pendingPlaylistTrack || !newPlaylistName.trim() || playlistBusy) return;
    setPlaylistBusy(true);
    try {
      const created = await onCreatePlaylist(newPlaylistName.trim());
      await onAddSongToPlaylist(created.id, pendingPlaylistTrack);
      setNewPlaylistName('');
      setMessage(isArabic ? `تم إنشاء "${created.name}" وإضافة الأغنية إليها` : `Created "${created.name}" and added the track`);
      setShowPlaylistPicker(false);
      setPendingPlaylistTrack(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر إنشاء القائمة.' : 'Could not create the playlist.'));
    } finally {
      setPlaylistBusy(false);
    }
  };

  const downloadAudius = (track: AudiusTrack) => {
    if (downloadOnlineItem(onlineMusicService.convertAudiusToAudioItem(track))) {
      setMessage(isArabic ? 'بدأ تنزيل الأغنية...' : 'Song download started...');
    } else setErrorMessage(isArabic ? 'تعذر تجهيز رابط التنزيل.' : 'Could not prepare the download.');
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

  // Online result cards share playback, queue, download and playlist actions.
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
        <button type="button" onClick={() => { addAlbumatyToPlaylist(link); }} className="p-1.5 rounded-lg border" style={{ borderColor: themeColors.border }} title="Add to playlist"><ListMusic className="w-3.5 h-3.5" /></button>
        <button
          onClick={() => { sendAlbumatyToDeck(link, 'A'); }}
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
          onClick={() => downloadAudius(track)}
          className="p-1.5 rounded-lg border"
          style={{ borderColor: themeColors.border }}
          title={isArabic ? 'تنزيل الأغنية' : 'Download track'}
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
        <button type="button" onClick={() => addAudiusToPlaylist(track)} className="p-1.5 rounded-lg border" style={{ borderColor: themeColors.border }} title={isArabic ? 'إضافة إلى قائمة تشغيل' : 'Add to playlist'}><ListMusic className="w-3.5 h-3.5" /></button>
        <button
          onClick={() => { sendAudiusToDeck(track, 'A'); }}
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

      <form
        onSubmit={(event) => { event.preventDefault(); void performOnlineSearch(); }}
        className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl border"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
        role="search"
      >
        <Search className="w-4 h-4 opacity-60 shrink-0" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setAlbumatySearchResults(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setQuery('');
              setAlbumatySearchResults(null);
            }
          }}
          className="bg-transparent outline-none flex-1 text-xs min-w-0"
          placeholder={
            source === 'ALBUMATY'
              ? isArabic
                ? 'ابحث باسم المطرب أو الأغنية...'
                : 'Search by artist or song title...'
              : isArabic
                ? 'ابحث باسم المطرب أو الأغنية...'
                : 'Search by artist or song title...'
          }
          aria-label={isArabic ? 'البحث باسم المطرب أو الأغنية' : 'Search by artist or song title'}
        />
        {query.trim() && (
          <button
            type="button"
            onClick={() => { setQuery(''); setAlbumatySearchResults(null); }}
            className="p-1 rounded-md opacity-60 hover:opacity-100"
            aria-label={isArabic ? 'مسح البحث' : 'Clear search'}
            title={isArabic ? 'مسح البحث' : 'Clear search'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: themeColors.primary, color: '#fff' }}
        >
          <Search className="w-3.5 h-3.5" />
          <span>{isArabic ? 'بحث' : 'Search'}</span>
        </button>
      </form>

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
              {albumatySearchResults &&
                activeAlbumaty.categories.length + activeAlbumaty.albums.length + activeAlbumaty.songs.length + activeAlbumaty.artists.length === 0 ? (
                <div className="py-12 text-center space-y-2 text-xs" style={{ color: themeColors.textMuted }}>
                  <Search className="w-8 h-8 mx-auto opacity-40" />
                  <div className="font-bold">{isArabic ? 'لا توجد نتائج مطابقة.' : 'No matching results found.'}</div>
                  <div>{isArabic ? 'جرّب اسم المطرب فقط أو جزءًا من اسم الأغنية.' : 'Try an artist name or a shorter part of the song title.'}</div>
                </div>
              ) : (
                <>
                  <OnlineSection
                    title={albumatySearchResults ? (isArabic ? 'نتائج البحث — الأقسام' : 'Search results — Sections') : (isArabic ? 'الأقسام' : 'Sections')}
                    links={activeAlbumaty.categories}
                    themeColors={themeColors}
                    onOpen={openAlbumatyLink}
                  />
                  <OnlineSection
                    title={albumatySearchResults ? (isArabic ? 'نتائج البحث — الألبومات' : 'Search results — Albums') : (isArabic ? 'أحدث الألبومات' : 'New Albums')}
                    links={activeAlbumaty.albums}
                    themeColors={themeColors}
                    onOpen={openAlbumatyLink}
                  />
                  <OnlineSection
                    title={albumatySearchResults ? (isArabic ? 'نتائج البحث — الأغاني' : 'Search results — Songs') : (isArabic ? 'أحدث الأغاني' : 'New Songs')}
                    links={activeAlbumaty.songs}
                    themeColors={themeColors}
                    onOpen={playAlbumaty}
                    song
                    renderSong={renderAlbumatySongCard}
                  />
                  <OnlineSection
                    title={albumatySearchResults ? (isArabic ? 'نتائج البحث — المطربون' : 'Search results — Artists') : (isArabic ? 'نتائج البحث — المطربون' : 'Artists')}
                    links={activeAlbumaty.artists}
                    themeColors={themeColors}
                    onOpen={openAlbumatyLink}
                  />
                </>
              )}
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

      {showPlaylistPicker && pendingPlaylistTrack && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border p-4 shadow-2xl space-y-3" style={{ backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.textPrimary }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-black">{isArabic ? 'إضافة إلى قائمة تشغيل' : 'Add to playlist'}</h2>
                <p className="text-xs opacity-70 mt-1 truncate">{pendingPlaylistTrack.title} — {pendingPlaylistTrack.artist}</p>
              </div>
              <button onClick={() => { setShowPlaylistPicker(false); setPendingPlaylistTrack(null); setNewPlaylistName(''); }} className="p-2 rounded-lg border" style={{ borderColor: themeColors.border }} aria-label={isArabic ? 'إغلاق' : 'Close'}><X className="w-4 h-4" /></button>
            </div>
            {playlists.length > 0 ? (
              <div className="space-y-2">
                {playlists.map((playlist) => <button key={playlist.id} onClick={() => void choosePlaylist(playlist.id)} disabled={playlistBusy} className="w-full rounded-xl border p-3 text-left text-xs font-bold flex items-center justify-between gap-3 disabled:opacity-50" style={{ borderColor: themeColors.border, backgroundColor: themeColors.surfaceVariant }}><span className="truncate">{playlist.name}</span><span className="text-[10px] opacity-60 shrink-0">{playlist.songCount} {isArabic ? 'أغنية' : 'songs'}</span></button>)}
              </div>
            ) : <p className="text-xs opacity-70">{isArabic ? 'لا توجد قوائم بعد؛ أنشئ قائمة جديدة أدناه.' : 'No playlists yet. Create one below.'}</p>}
            <div className="border-t pt-3 space-y-2" style={{ borderColor: themeColors.border }}>
              <label className="block text-xs font-bold">{isArabic ? 'أو أنشئ قائمة جديدة' : 'Or create a new playlist'}</label>
              <input value={newPlaylistName} onChange={(event) => setNewPlaylistName(event.target.value)} placeholder={isArabic ? 'اسم قائمة التشغيل' : 'Playlist name'} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ borderColor: themeColors.border, backgroundColor: themeColors.surfaceVariant, color: themeColors.textPrimary }} />
              <button onClick={() => void createPlaylistAndAdd()} disabled={playlistBusy || !newPlaylistName.trim()} className="w-full rounded-xl px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: themeColors.primary, color: '#fff' }}><Plus className="w-4 h-4" />{playlistBusy ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'إنشاء وإضافة الأغنية' : 'Create & add track')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OnlineSection: React.FC<{
  title: string;
  links: AlbumatyLink[];
  themeColors: ThemeColors;
  onOpen: (link: AlbumatyLink) => void;
  song?: boolean;
  renderSong?: (link: AlbumatyLink) => React.ReactNode;
}> = ({ title, links, themeColors, onOpen, song, renderSong }) => {
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
            renderSong ? renderSong(link) : <AlbumatySongRow key={link.url} link={link} onPlay={onOpen} themeColors={themeColors} />
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

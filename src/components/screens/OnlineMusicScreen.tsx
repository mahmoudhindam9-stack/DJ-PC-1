import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Globe2, Headphones, ListPlus, Loader2, Music2, Play, Radio, Search } from 'lucide-react';
import { AlbumatyLink, AlbumatyTrack, AudiusTrack, AudioItem, ThemeColors } from '../../types';
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

const formatMs = (ms?: number) => {
  if (!ms || Number.isNaN(ms)) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  return Math.floor(totalSec / 60) + ':' + String(totalSec % 60).padStart(2, '0');
};

export const OnlineMusicScreen: React.FC<OnlineMusicScreenProps> = ({
  themeColors, isArabic, onPlayOnlineTrack, onSendToDeckA, onSendToDeckB, onEnqueueTrack, onSaveToLibrary,
}) => {
  const [provider, setProvider] = useState<'ALBUMATY' | 'AUDIUS'>('ALBUMATY');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [albumatyHome, setAlbumatyHome] = useState({
    categories: [] as AlbumatyLink[], albums: [] as AlbumatyLink[], songs: [] as AlbumatyLink[], artists: [] as AlbumatyLink[],
  });
  const [albumatySection, setAlbumatySection] = useState<{ link: AlbumatyLink; items: AlbumatyLink[] } | null>(null);
  const [audiusTracks, setAudiusTracks] = useState<AudiusTrack[]>([]);
  const [audiusMode, setAudiusMode] = useState<'TRENDING' | 'LATEST' | 'SEARCH'>('TRENDING');

  const loadAlbumaty = async (query = '') => {
    setBusy(true); setError(null);
    try { setAlbumatyHome(await onlineMusicService.getAlbumatyHome(query)); setAlbumatySection(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const loadAudius = async (mode: typeof audiusMode, query = '') => {
    setBusy(true); setError(null);
    try {
      const data = mode === 'LATEST' ? await onlineMusicService.getLatestTracks() : mode === 'SEARCH' ? await onlineMusicService.searchAudius(query) : await onlineMusicService.getTrendingTracks();
      setAudiusTracks(data); setAudiusMode(mode);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  useEffect(() => { if (provider === 'ALBUMATY') void loadAlbumaty(); else void loadAudius('TRENDING'); }, [provider]);

  const playAlbumaty = async (link: AlbumatyLink) => {
    setBusy(true); setError(null);
    try {
      const track: AlbumatyTrack = await onlineMusicService.resolveAlbumatyTrack(link);
      onPlayOnlineTrack(onlineMusicService.albumatyToAudioItem(track));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const openAlbumaty = async (link: AlbumatyLink) => {
    if (link.kind === 'song') return playAlbumaty(link);
    setBusy(true); setError(null);
    try { setAlbumatySection({ link, items: await onlineMusicService.getAlbumatySection(link) }); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const queueAlbumaty = async (link: AlbumatyLink) => {
    setBusy(true);
    try { const track = await onlineMusicService.resolveAlbumatyTrack(link); onEnqueueTrack(onlineMusicService.albumatyToAudioItem(track)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const deckAlbumaty = async (link: AlbumatyLink, deck: 'A' | 'B') => {
    setBusy(true);
    try { const track = await onlineMusicService.resolveAlbumatyTrack(link); const item = onlineMusicService.albumatyToAudioItem(track); (deck === 'A' ? onSendToDeckA : onSendToDeckB)(item); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const searchResults = useMemo(() => {
    if (!search.trim()) return albumatyHome.songs;
    const q = search.trim().toLowerCase();
    return [...albumatyHome.songs, ...albumatyHome.albums, ...albumatyHome.artists, ...albumatyHome.categories]
      .filter((item, index, arr) => item.title.toLowerCase().includes(q) && arr.findIndex((x) => x.url === item.url) === index);
  }, [albumatyHome, search]);

  const albumatyItems = albumatySection ? albumatySection.items : searchResults;

  return (
    <div id="online-music-screen" className="flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: themeColors.background, color: themeColors.textPrimary }}>
      <div className="h-full max-w-[1800px] mx-auto flex flex-col">
        <div className="px-7 py-6 border-b shrink-0" style={{ borderColor: themeColors.border }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: themeColors.primary + '20' }}><Globe2 className="w-6 h-6" style={{ color: themeColors.primary }} /></div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black tracking-tight">{isArabic ? 'الموسيقى أونلاين' : 'Online Music'}</h1>
              <p className="text-sm opacity-60">{isArabic ? 'مصادر حقيقية: البوماتي للعربي وAudius للأجنبي' : 'Real sources: Albumaty for Arabic and Audius for international music'}</p>
            </div>
            <div className="flex items-center gap-2">
              <ProviderButton active={provider === 'ALBUMATY'} onClick={() => setProvider('ALBUMATY')} label="🇪🇬 Albumaty" themeColors={themeColors} />
              <ProviderButton active={provider === 'AUDIUS'} onClick={() => setProvider('AUDIUS')} label="🌍 Audius" themeColors={themeColors} />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            {albumatySection && provider === 'ALBUMATY' && <button onClick={() => setAlbumatySection(null)} className="w-11 h-11 rounded-xl border flex items-center justify-center" style={{ backgroundColor: themeColors.surface, borderColor: themeColors.border }} title={isArabic ? 'رجوع' : 'Back'}><ArrowLeft className="w-5 h-5" /></button>}
            <div className="flex-1 h-11 rounded-xl border flex items-center gap-2 px-3" style={{ backgroundColor: themeColors.surface, borderColor: themeColors.border }}>
              <Search className="w-4 h-4 opacity-55" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key !== 'Enter') return; if (provider === 'ALBUMATY') void loadAlbumaty(search.trim()); else if (search.trim()) void loadAudius('SEARCH', search.trim()); }} placeholder={provider === 'ALBUMATY' ? (isArabic ? 'ابحث في البوماتي الحقيقي...' : 'Search real Albumaty...') : (isArabic ? 'ابحث في Audius...' : 'Search Audius...')} className="flex-1 bg-transparent outline-none text-sm" />
              <button onClick={() => provider === 'ALBUMATY' ? void loadAlbumaty(search.trim()) : search.trim() ? void loadAudius('SEARCH', search.trim()) : void loadAudius('TRENDING')} className="px-4 py-2 rounded-lg font-bold text-sm" style={{ backgroundColor: themeColors.primary, color: '#fff' }}>{isArabic ? 'بحث' : 'Search'}</button>
              <button onClick={() => provider === 'ALBUMATY' ? void loadAlbumaty(search.trim()) : void loadAudius(audiusMode, search)} className="p-2 rounded-lg hover:bg-white/10" title={isArabic ? 'تحديث' : 'Refresh'}><Radio className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
        {busy && <div className="px-7 py-3 border-b flex items-center gap-2 text-sm" style={{ borderColor: themeColors.border }}><Loader2 className="w-4 h-4 animate-spin" style={{ color: themeColors.primary }} />{isArabic ? 'جاري جلب البيانات الحقيقية...' : 'Loading live source data...'}</div>}
        {error && <div className="mx-7 mt-4 p-3 rounded-xl border text-sm" style={{ borderColor: themeColors.primary, backgroundColor: themeColors.primary + '10' }}>{error}</div>}
        <div className="flex-1 min-h-0 overflow-y-auto p-7">
          {provider === 'ALBUMATY' ? (
            <>
              {!albumatySection && !search.trim() && <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-7">
                <SourcePanel title={isArabic ? 'التصنيفات' : 'Categories'} items={albumatyHome.categories} onOpen={openAlbumaty} themeColors={themeColors} />
                <SourcePanel title={isArabic ? 'الألبومات' : 'Albums'} items={albumatyHome.albums} onOpen={openAlbumaty} themeColors={themeColors} />
                <SourcePanel title={isArabic ? 'الفنانون' : 'Artists'} items={albumatyHome.artists} onOpen={openAlbumaty} themeColors={themeColors} />
              </div>}
              <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-black">{albumatySection ? albumatySection.link.title : search.trim() ? ((isArabic ? 'نتائج البحث' : 'Search Results') + ' • ' + search) : (isArabic ? 'أغاني البوماتي' : 'Albumaty Songs')}</h2><span className="text-xs opacity-50">{albumatyItems.length} items</span></div>
              {albumatyItems.length === 0 ? <EmptyState text={isArabic ? 'لا توجد بيانات من المصدر' : 'No live data from Albumaty'} /> : <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3">{albumatyItems.map((link, index) => <AlbumatyCard key={link.url + index} link={link} onOpen={() => void openAlbumaty(link)} onQueue={() => void queueAlbumaty(link)} onDeckA={() => void deckAlbumaty(link, 'A')} onDeckB={() => void deckAlbumaty(link, 'B')} onPlay={() => void playAlbumaty(link)} themeColors={themeColors} isArabic={isArabic} />)}</div>}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-5">
                <ProviderButton active={audiusMode === 'TRENDING'} onClick={() => void loadAudius('TRENDING')} label={isArabic ? 'الأكثر رواجًا' : 'Trending'} themeColors={themeColors} />
                <ProviderButton active={audiusMode === 'LATEST'} onClick={() => void loadAudius('LATEST')} label={isArabic ? 'الأحدث' : 'Latest'} themeColors={themeColors} />
              </div>
              {audiusTracks.length === 0 ? <EmptyState text={isArabic ? 'لا توجد نتائج من Audius' : 'No live tracks from Audius'} /> : <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3">{audiusTracks.map((t) => { const item = onlineMusicService.audiusToAudioItem(t); return <div key={t.id} className="rounded-2xl border p-4 flex items-center gap-4 hover:shadow-lg" style={{ backgroundColor: themeColors.surface, borderColor: themeColors.border }}><div className="w-14 h-14 rounded-xl overflow-hidden shrink-0" style={{ backgroundColor: themeColors.surfaceVariant }}>{t.artworkUrl ? <img src={t.artworkUrl} alt={t.title} className="w-full h-full object-cover" /> : <Headphones className="w-6 h-6 m-4" />}</div><div className="min-w-0 flex-1"><div className="font-bold text-sm truncate">{t.title}</div><div className="text-xs opacity-60 truncate">{t.artist}</div><div className="text-[11px] opacity-45 mt-1">{formatMs(t.duration)}{t.genre ? ' • ' + t.genre : ''}</div></div><div className="flex items-center gap-1.5"><ActionButton onClick={() => onPlayOnlineTrack(item)} label="▶" themeColors={themeColors} primary /><ActionButton onClick={() => onEnqueueTrack(item)} label="+" themeColors={themeColors} title={isArabic ? 'إضافة للكيو' : 'Add to queue'} /><ActionButton onClick={() => onSendToDeckA(item)} label="A" themeColors={themeColors} accent="A" /><ActionButton onClick={() => onSendToDeckB(item)} label="B" themeColors={themeColors} accent="B" /><ActionButton onClick={() => onSaveToLibrary(item)} label="↓" themeColors={themeColors} title={isArabic ? 'حفظ' : 'Save to library'} /></div></div>; })}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ProviderButton: React.FC<{ active: boolean; onClick: () => void; label: string; themeColors: ThemeColors }> = ({ active, onClick, label, themeColors }) => <button onClick={onClick} className="px-4 py-2.5 rounded-xl border text-sm font-bold" style={{ backgroundColor: active ? themeColors.primary : themeColors.surface, borderColor: active ? themeColors.primary : themeColors.border, color: active ? '#fff' : themeColors.textPrimary }}>{label}</button>;
const ActionButton: React.FC<{ onClick: () => void; label: string; themeColors: ThemeColors; primary?: boolean; accent?: 'A' | 'B'; title?: string }> = ({ onClick, label, themeColors, primary, accent, title }) => <button onClick={onClick} className="w-10 h-10 rounded-xl border flex items-center justify-center font-black text-xs hover:bg-white/10" style={{ backgroundColor: primary ? themeColors.primary : 'transparent', color: primary ? '#fff' : accent === 'A' ? themeColors.accentA : accent === 'B' ? themeColors.accentB : themeColors.textPrimary, borderColor: primary ? themeColors.primary : accent === 'A' ? themeColors.accentA : accent === 'B' ? themeColors.accentB : themeColors.border }} title={title}>{label}</button>;
const AlbumatyCard: React.FC<{ link: AlbumatyLink; onOpen: () => void; onPlay: () => void; onQueue: () => void; onDeckA: () => void; onDeckB: () => void; themeColors: ThemeColors; isArabic: boolean }> = ({ link, onOpen, onPlay, onQueue, onDeckA, onDeckB, themeColors, isArabic }) => <div className="rounded-2xl border p-4 flex items-center gap-4 hover:shadow-lg" style={{ backgroundColor: themeColors.surface, borderColor: themeColors.border }}><button onClick={onOpen} className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: themeColors.surfaceVariant }}><Music2 className="w-6 h-6" style={{ color: themeColors.primary }} /></button><button onClick={onOpen} className="min-w-0 flex-1 text-left"><div className="font-bold text-sm truncate">{link.title}</div><div className="text-xs opacity-45 mt-1">{link.kind.toUpperCase()}</div></button>{link.kind === 'song' && <div className="flex items-center gap-1.5"><ActionButton onClick={onPlay} label="▶" themeColors={themeColors} primary /><ActionButton onClick={onQueue} label="+" themeColors={themeColors} title={isArabic ? 'إضافة للكيو' : 'Add to queue'} /><ActionButton onClick={onDeckA} label="A" themeColors={themeColors} accent="A" /><ActionButton onClick={onDeckB} label="B" themeColors={themeColors} accent="B" /><ActionButton onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')} label="↗" themeColors={themeColors} title={isArabic ? 'فتح في البوماتي' : 'Open in Albumaty'} /></div>}</div>;
const SourcePanel: React.FC<{ title: string; items: AlbumatyLink[]; onOpen: (link: AlbumatyLink) => void; themeColors: ThemeColors }> = ({ title, items, onOpen, themeColors }) => <section className="rounded-2xl border p-5 min-h-[240px]" style={{ backgroundColor: themeColors.surface, borderColor: themeColors.border }}><div className="flex items-center justify-between mb-3"><h2 className="text-lg font-black">{title}</h2><span className="text-xs opacity-50">{items.length}</span></div><div className="space-y-1.5 max-h-[320px] overflow-y-auto">{items.slice(0, 80).map((item, i) => <button key={item.url + i} onClick={() => onOpen(item)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm truncate">{item.title}</button>)}</div></section>;
const EmptyState: React.FC<{ text: string }> = ({ text }) => <div className="min-h-[260px] flex items-center justify-center rounded-2xl border border-dashed opacity-60 text-sm">{text}</div>;
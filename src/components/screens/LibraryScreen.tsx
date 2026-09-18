import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  FolderOpen,
  Music,
  Heart,
  MoreVertical,
  Play,
  ListPlus,
  Disc,
  Trash2,
  Clock,
  User,
  Disc3,
  Folder,
} from 'lucide-react';
import { AudioItem, Playlist, LibrarySubTab, ThemeColors } from '../../types';

interface LibraryScreenProps {
  library: AudioItem[];
  playlists: Playlist[];
  currentSong: AudioItem | null;
  isPlaying: boolean;
  themeColors: ThemeColors;
  isArabic: boolean;
  onPlaySong: (song: AudioItem, queue?: AudioItem[]) => void;
  onToggleFavorite: (song: AudioItem) => void;
  onDeleteSong: (id: string) => void;
  onImportFiles: (files: FileList | File[]) => void;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onAddSongToPlaylist: (playlistId: string, song: AudioItem) => void;
  onEnqueueSong: (song: AudioItem) => void;
  onSendToDeckA: (song: AudioItem) => void;
  onSendToDeckB: (song: AudioItem) => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  library,
  playlists,
  currentSong,
  isPlaying,
  themeColors,
  isArabic,
  onPlaySong,
  onToggleFavorite,
  onDeleteSong,
  onImportFiles,
  onCreatePlaylist,
  onDeletePlaylist,
  onAddSongToPlaylist,
  onEnqueueSong,
  onSendToDeckA,
  onSendToDeckB,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<LibrarySubTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'TITLE' | 'ARTIST' | 'DURATION' | 'DATE'>('TITLE');
  const [activeSongMenuId, setActiveSongMenuId] = useState<string | null>(null);
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  // Filter & Sort Logic
  const filteredSongs = useMemo(() => {
    let result = [...library];

    // Filter by subtab
    if (activeSubTab === 'FAVORITES') {
      result = result.filter((s) => s.isFavorite);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q) ||
          s.album.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortOption === 'TITLE') return a.title.localeCompare(b.title);
      if (sortOption === 'ARTIST') return a.artist.localeCompare(b.artist);
      if (sortOption === 'DURATION') return (b.duration || 0) - (a.duration || 0);
      if (sortOption === 'DATE') return (b.addedDate || 0) - (a.addedDate || 0);
      return 0;
    });

    return result;
  }, [library, activeSubTab, searchQuery, sortOption]);

  // Group by Artist
  const artistGroups = useMemo(() => {
    const groups: Record<string, AudioItem[]> = {};
    library.forEach((song) => {
      const artist = song.artist || 'Unknown Artist';
      if (!groups[artist]) groups[artist] = [];
      groups[artist].push(song);
    });
    return groups;
  }, [library]);

  // Group by Album
  const albumGroups = useMemo(() => {
    const groups: Record<string, AudioItem[]> = {};
    library.forEach((song) => {
      const album = song.album || 'Unknown Album';
      if (!groups[album]) groups[album] = [];
      groups[album].push(song);
    });
    return groups;
  }, [library]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportFiles(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onImportFiles(e.dataTransfer.files);
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
      id="library-screen-container"
      className="flex-1 flex flex-col h-full overflow-hidden select-none p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      style={{
        backgroundColor: themeColors.background,
        color: themeColors.textPrimary,
      }}
    >
      {/* Top Header & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Music className="w-6 h-6" style={{ color: themeColors.primary }} />
          <div>
            <h1 className="text-lg font-black tracking-wide">
              {isArabic ? 'مكتبة الموسيقى' : 'MUSIC LIBRARY'}
            </h1>
            <p className="text-xs" style={{ color: themeColors.textMuted }}>
              {library.length} {isArabic ? 'ملف صوتي محلي' : 'audio track(s) loaded'}
            </p>
          </div>
        </div>

        {/* Action buttons: Import, Add Playlist */}
        <div className="flex items-center gap-2">
          <label
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-sm flex items-center gap-1.5 transition-all hover:opacity-90"
            style={{
              backgroundColor: themeColors.primary,
              color: '#ffffff',
            }}
          >
            <FolderOpen className="w-4 h-4" />
            <span>{isArabic ? 'استيراد ملفات صوتية' : 'Import Audio Files'}</span>
            <input
              type="file"
              multiple
              accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a"
              className="hidden"
              onChange={handleFileInput}
            />
          </label>

          <button
            onClick={() => setShowNewPlaylistModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 hover:bg-white/5 transition-all"
            style={{
              borderColor: themeColors.border,
              backgroundColor: themeColors.surfaceVariant,
            }}
          >
            <Plus className="w-4 h-4" />
            <span>{isArabic ? 'قائمة جديدة' : 'New Playlist'}</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex items-center justify-between border-b pb-2 mb-3 gap-2" style={{ borderColor: themeColors.border }}>
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          {(['ALL', 'PLAYLISTS', 'FAVORITES', 'ARTISTS', 'ALBUMS'] as LibrarySubTab[]).map((tab) => {
            const isActive = activeSubTab === tab;
            const labels: Record<LibrarySubTab, { en: string; ar: string }> = {
              ALL: { en: 'All Tracks', ar: 'جميع الأغاني' },
              PLAYLISTS: { en: 'Playlists', ar: 'قوائم التشغيل' },
              FAVORITES: { en: 'Favorites', ar: 'المفضلة' },
              ARTISTS: { en: 'Artists', ar: 'الفنانون' },
              ALBUMS: { en: 'Albums', ar: 'الألبومات' },
              FOLDERS: { en: 'Folders', ar: 'المجلدات' },
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  isActive ? 'shadow-sm font-bold' : 'hover:bg-white/5 opacity-70'
                }`}
                style={{
                  backgroundColor: isActive ? themeColors.primary : 'transparent',
                  color: isActive ? '#ffffff' : themeColors.textPrimary,
                }}
              >
                {isArabic ? labels[tab].ar : labels[tab].en}
              </button>
            );
          })}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2 text-xs">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border"
            style={{
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            }}
          >
            <Search className="w-3.5 h-3.5 opacity-60" />
            <input
              type="text"
              placeholder={isArabic ? 'بحث في المكتبة...' : 'Search library...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none w-36 sm:w-44 text-xs"
            />
          </div>

          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as 'TITLE' | 'ARTIST' | 'DURATION' | 'DATE')}
            className="px-2 py-1 rounded-lg border outline-none text-xs"
            style={{
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
              color: themeColors.textPrimary,
            }}
          >
            <option value="TITLE">{isArabic ? 'العنوان' : 'Title'}</option>
            <option value="ARTIST">{isArabic ? 'الفنان' : 'Artist'}</option>
            <option value="DURATION">{isArabic ? 'المدة' : 'Duration'}</option>
            <option value="DATE">{isArabic ? 'تاريخ الإضافة' : 'Date Added'}</option>
          </select>
        </div>
      </div>

      {/* Main SubTab Content */}
      <div className="flex-1 overflow-y-auto pr-1">
        {activeSubTab === 'PLAYLISTS' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {playlists.length === 0 ? (
              <div className="col-span-full py-16 text-center text-sm" style={{ color: themeColors.textMuted }}>
                {isArabic ? 'لا توجد قوائم تشغيل. انقر فوق "قائمة جديدة" لإنشاء واحدة.' : 'No playlists yet. Click "New Playlist" to create one.'}
              </div>
            ) : (
              playlists.map((pl) => (
                <div
                  key={pl.id}
                  className="p-3.5 rounded-xl border flex flex-col justify-between group hover:border-blue-500 transition-all cursor-pointer"
                  style={{
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border,
                  }}
                  onClick={() => setSelectedPlaylist(pl)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                      style={{
                        backgroundColor: `${themeColors.primary}25`,
                        color: themeColors.primary,
                      }}
                    >
                      <Disc3 className="w-5 h-5" />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePlaylist(pl.id);
                      }}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 transition-all"
                      title="Delete Playlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm truncate">{pl.name}</h3>
                    <p className="text-xs" style={{ color: themeColors.textMuted }}>
                      {pl.songCount} {isArabic ? 'أغنية' : 'song(s)'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeSubTab === 'ARTISTS' ? (
          <div className="space-y-4">
            {Object.keys(artistGroups).map((artist) => (
              <div
                key={artist}
                className="p-3 rounded-xl border"
                style={{
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" style={{ color: themeColors.primary }} />
                  <h3 className="font-bold text-sm">{artist}</h3>
                  <span className="text-xs opacity-60">({artistGroups[artist].length} tracks)</span>
                </div>
                <div className="space-y-1">
                  {artistGroups[artist].map((song) => (
                    <div
                      key={song.id}
                      onClick={() => onPlaySong(song, artistGroups[artist])}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer text-xs"
                    >
                      <span className="truncate">{song.title}</span>
                      <span className="opacity-60">{formatMs(song.duration)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : activeSubTab === 'ALBUMS' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.keys(albumGroups).map((album) => (
              <div
                key={album}
                className="p-3 rounded-xl border flex flex-col justify-between"
                style={{
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Disc className="w-4 h-4" style={{ color: themeColors.secondary }} />
                  <h3 className="font-bold text-sm truncate">{album}</h3>
                </div>
                <p className="text-xs mb-2 opacity-60">
                  {albumGroups[album].length} {isArabic ? 'أغنية' : 'tracks'}
                </p>
                <button
                  onClick={() => onPlaySong(albumGroups[album][0], albumGroups[album])}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
                  style={{
                    backgroundColor: themeColors.primary,
                    color: '#ffffff',
                  }}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {isArabic ? 'تشغيل الألبوم' : 'Play Album'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          /* ALL or FAVORITES List */
          <div className="space-y-1">
            {filteredSongs.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-2">
                <Music className="w-12 h-12 opacity-30" />
                <p className="text-sm" style={{ color: themeColors.textMuted }}>
                  {isArabic
                    ? 'لم يتم العثور على أغانٍ. اسحب وأفلت الملفات الصوتية هنا أو انقر فوق استيراد.'
                    : 'No tracks found. Drag & drop audio files here or click "Import Audio Files".'}
                </p>
              </div>
            ) : (
              filteredSongs.map((song, idx) => {
                const isCurrent = currentSong?.id === song.id;
                return (
                  <div
                    key={song.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isCurrent ? 'font-bold' : 'hover:bg-white/5'
                    }`}
                    style={{
                      backgroundColor: isCurrent ? `${themeColors.primary}18` : themeColors.surface,
                      borderColor: isCurrent ? themeColors.primary : themeColors.border,
                    }}
                  >
                    {/* Left Play & Title */}
                    <div
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      onClick={() => onPlaySong(song, filteredSongs)}
                    >
                      <button
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform active:scale-90 shrink-0"
                        style={{
                          backgroundColor: isCurrent && isPlaying ? themeColors.primary : themeColors.surfaceVariant,
                          color: isCurrent && isPlaying ? '#ffffff' : themeColors.textPrimary,
                        }}
                      >
                        {isCurrent && isPlaying ? (
                          <span className="w-3 h-3 flex items-center justify-center">▶</span>
                        ) : (
                          <span className="text-xs font-mono">{idx + 1}</span>
                        )}
                      </button>

                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold truncate leading-tight">{song.title}</h4>
                        <p className="text-[11px] truncate leading-tight opacity-70">
                          {song.artist} • {song.album}
                        </p>
                      </div>
                    </div>

                    {/* Right Duration & Actions */}
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs opacity-60 w-10 text-right">
                        {formatMs(song.duration)}
                      </span>

                      {/* Favorite button */}
                      <button
                        onClick={() => onToggleFavorite(song)}
                        className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                        title="Favorite"
                      >
                        <Heart
                          className="w-4 h-4 transition-all"
                          style={{
                            color: song.isFavorite ? '#ff1744' : themeColors.textMuted,
                            fill: song.isFavorite ? '#ff1744' : 'none',
                          }}
                        />
                      </button>

                      {/* Context menu toggle */}
                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveSongMenuId(activeSongMenuId === song.id ? null : song.id)
                          }
                          className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeSongMenuId === song.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-44 rounded-xl shadow-2xl border p-1.5 z-50 text-xs"
                            style={{
                              backgroundColor: themeColors.surface,
                              borderColor: themeColors.border,
                            }}
                          >
                            <button
                              onClick={() => {
                                onEnqueueSong(song);
                                setActiveSongMenuId(null);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2"
                            >
                              <ListPlus className="w-3.5 h-3.5" />
                              <span>{isArabic ? 'إضافة إلى الدور' : 'Add to Queue'}</span>
                            </button>

                            <button
                              onClick={() => {
                                onSendToDeckA(song);
                                setActiveSongMenuId(null);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2"
                              style={{ color: themeColors.accentA }}
                            >
                              <Disc className="w-3.5 h-3.5" />
                              <span>{isArabic ? 'إرسال إلى Deck A' : 'Send to Deck A'}</span>
                            </button>

                            <button
                              onClick={() => {
                                onSendToDeckB(song);
                                setActiveSongMenuId(null);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2"
                              style={{ color: themeColors.accentB }}
                            >
                              <Disc className="w-3.5 h-3.5" />
                              <span>{isArabic ? 'إرسال إلى Deck B' : 'Send to Deck B'}</span>
                            </button>

                            {playlists.length > 0 && (
                              <div className="border-t my-1 pt-1 opacity-80" style={{ borderColor: themeColors.border }}>
                                <div className="px-2 py-1 text-[10px] font-bold opacity-60">
                                  {isArabic ? 'إضافة إلى قائمة:' : 'Add to Playlist:'}
                                </div>
                                {playlists.map((pl) => (
                                  <button
                                    key={pl.id}
                                    onClick={() => {
                                      onAddSongToPlaylist(pl.id, song);
                                      setActiveSongMenuId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1 rounded hover:bg-white/10 truncate"
                                  >
                                    + {pl.name}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className="border-t my-1 pt-1" style={{ borderColor: themeColors.border }}>
                              <button
                                onClick={() => {
                                  onDeleteSong(song.id);
                                  setActiveSongMenuId(null);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{isArabic ? 'حذف من المكتبة' : 'Delete'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* New Playlist Modal */}
      {showNewPlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
            style={{
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            }}
          >
            <h3 className="font-bold text-base mb-3">
              {isArabic ? 'إنشاء قائمة تشغيل جديدة' : 'Create New Playlist'}
            </h3>
            <input
              type="text"
              placeholder={isArabic ? 'اسم قائمة التشغيل...' : 'Playlist name...'}
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="w-full p-2.5 rounded-xl border mb-4 text-xs outline-none"
              style={{
                backgroundColor: themeColors.surfaceVariant,
                borderColor: themeColors.border,
                color: themeColors.textPrimary,
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setShowNewPlaylistModal(false)}
                className="px-3 py-1.5 rounded-lg border hover:bg-white/5"
                style={{ borderColor: themeColors.border }}
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (newPlaylistName.trim()) {
                    onCreatePlaylist(newPlaylistName);
                    setNewPlaylistName('');
                    setShowNewPlaylistModal(false);
                  }
                }}
                className="px-4 py-1.5 rounded-lg font-bold shadow-md"
                style={{
                  backgroundColor: themeColors.primary,
                  color: '#ffffff',
                }}
              >
                {isArabic ? 'إنشاء' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TabType,
  AppThemeOption,
  AudioItem,
  Playlist,
  PlaybackMode,
  RadioStation,
} from './types';
import { THEMES } from './utils/theme';
import { db } from './storage/db';
import { mainAudioEngine } from './audio/AudioEngine';
import { deckAEngine, deckBEngine } from './audio/DJDeckEngine';
import { TitleBar } from './components/TitleBar';
import { MiniPlayer } from './components/MiniPlayer';
import { NowPlayingModal } from './components/NowPlayingModal';
import { QueueModal } from './components/QueueModal';
import { LibraryScreen } from './components/screens/LibraryScreen';
import { DJMixerScreen } from './components/screens/DJMixerScreen';
import { EqualizerScreen } from './components/screens/EqualizerScreen';
import { KaraokeScreen } from './components/screens/KaraokeScreen';
import { RadioScreen } from './components/screens/RadioScreen';
import { OnlineMusicScreen } from './components/screens/OnlineMusicScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { batchImportAudioFiles } from './utils/fileImporter';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('LIBRARY');
  const [currentTheme, setCurrentTheme] = useState<AppThemeOption>('DJ_BLUE');
  const [isArabic, setIsArabic] = useState(false);

  // Music State - Clean initial state without default songs
  const [library, setLibrary] = useState<AudioItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [queue, setQueue] = useState<AudioItem[]>([]);
  const [currentSong, setCurrentSong] = useState<AudioItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('NORMAL');
  const [crossfadeDurationMs, setCrossfadeDurationMs] = useState(2000);

  const crossfadePendingSongRef = useRef<AudioItem | null>(null);
  const shuffleBagRef = useRef<string[]>([]);
  const shuffleSignatureRef = useRef('');
  const radioRecoveryRef = useRef<{
    queue: AudioItem[];
    currentSong: AudioItem | null;
    currentTimeMs: number;
    playbackMode: PlaybackMode;
  } | null>(null);
  const radioAttemptActiveRef = useRef(false);
  const radioAttemptTokenRef = useRef(0);

  // Radio state
  const [currentRadioStationId, setCurrentRadioStationId] = useState<string | null>(null);

  // Modals
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  const themeColors = THEMES[currentTheme] || THEMES.DJ_BLUE;

  // Load persistence (saved songs, playlists, settings)
  useEffect(() => {
    async function loadData() {
      try {
        const savedSongs = await db.getAllSongs();
        const cleanSongs: AudioItem[] = [];

        // Purge any legacy demo tracks from storage
        if (savedSongs && savedSongs.length > 0) {
          for (const s of savedSongs) {
            if (s.id.startsWith('demo_')) {
              await db.deleteSong(s.id);
            } else {
              cleanSongs.push(s);
            }
          }
        }

        setLibrary(cleanSongs);
        setQueue(cleanSongs);
        if (cleanSongs.length > 0) {
          setCurrentSong(cleanSongs[0]);
        }

        const savedPls = await db.getPlaylists();
        setPlaylists(savedPls);

        const savedTheme = await db.getSetting<AppThemeOption>('app_theme', 'DJ_BLUE');
        setCurrentTheme(savedTheme);

        const savedLang = await db.getSetting<boolean>('is_arabic', false);
        setIsArabic(savedLang);

        const savedCrossfade = await db.getSetting<number>('crossfade_ms', 2000);
        const safeCrossfade = Number.isFinite(savedCrossfade)
          ? Math.max(0, Math.min(15000, savedCrossfade))
          : 2000;
        setCrossfadeDurationMs(safeCrossfade);
        mainAudioEngine.setCrossfadeDuration(safeCrossfade);

        const savedVolume = await db.getSetting<number>('master_volume', 0.85);
        const safeVolume = Number.isFinite(savedVolume)
          ? Math.max(0, Math.min(1, savedVolume))
          : 0.85;
        setVolume(safeVolume);
        mainAudioEngine.setVolume(safeVolume);
      } catch (e) {
        console.warn('Storage initial load notice:', e);
      }
    }
    loadData();
  }, []);

  // Update HTML direction when language changes
  useEffect(() => {
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = isArabic ? 'ar' : 'en';
  }, [isArabic]);

  // Handle Audio Engine subscriptions
  useEffect(() => {
    const unsubTime = mainAudioEngine.onTimeUpdate((cur, dur) => {
      setCurrentTimeMs(cur);
      setDurationMs(dur);
    });

    const unsubState = mainAudioEngine.onStateChange((playing) => {
      setIsPlaying(playing);
    });

    const unsubEnd = mainAudioEngine.onEnded(() => {
      handleTrackEnded();
    });

    const unsubCrossfade = mainAudioEngine.onCrossfadeComplete(() => {
      const pending = crossfadePendingSongRef.current;
      if (!pending) return;
      crossfadePendingSongRef.current = null;
      setCurrentSong(pending);
      setCurrentRadioStationId(null);
      setCurrentTimeMs(0);
      setDurationMs(mainAudioEngine.durationMs);
    });

    const unsubError = mainAudioEngine.onError((message) => {
      if (radioAttemptActiveRef.current || !currentRadioStationId) return;

      const snapshot = radioRecoveryRef.current;
      radioRecoveryRef.current = null;
      setCurrentRadioStationId(null);

      if (!snapshot?.currentSong) {
        mainAudioEngine.pause();
        setIsPlaying(false);
        return;
      }

      setQueue(snapshot.queue);
      setCurrentSong(snapshot.currentSong);
      setPlaybackMode(snapshot.playbackMode);
      setCurrentTimeMs(snapshot.currentTimeMs);

      mainAudioEngine.loadTrack(snapshot.currentSong).then(async () => {
        mainAudioEngine.seekTo(snapshot.currentTimeMs);
        const restored = await mainAudioEngine.play();
        if (!restored) setIsPlaying(false);
      });
      console.warn('Radio playback failed; restored previous music session:', message);
    });

    return () => {
      unsubTime();
      unsubState();
      unsubEnd();
      unsubCrossfade();
      unsubError();
    };
  }, [currentRadioStationId, handleTrackEnded]);

  // Desktop Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space' && activeTab !== 'DJ_MIXER') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'ArrowLeft' && (e.ctrlKey || e.altKey)) {
        e.preventDefault();
        handlePrev();
      } else if (e.code === 'ArrowRight' && (e.ctrlKey || e.altKey)) {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowUp' && (e.ctrlKey || e.altKey)) {
        e.preventDefault();
        handleVolumeChange(Math.min(1, volume + 0.05));
      } else if (e.code === 'ArrowDown' && (e.ctrlKey || e.altKey)) {
        e.preventDefault();
        handleVolumeChange(Math.max(0, volume - 0.05));
      } else if (e.key === '1' && e.altKey) {
        setActiveTab('LIBRARY');
      } else if (e.key === '2' && e.altKey) {
        setActiveTab('DJ_MIXER');
      } else if (e.key === '3' && e.altKey) {
        setActiveTab('EQUALIZER');
      } else if (e.key === '4' && e.altKey) {
        setActiveTab('KARAOKE');
      } else if (e.key === '5' && e.altKey) {
        setActiveTab('RADIO');
      } else if (e.key === '6' && e.altKey) {
        setActiveTab('ONLINE_MUSIC');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeTab, isPlaying, currentSong, volume, queue]);

  const getShuffleNextSong = useCallback((currentId: string | null) => {
    if (queue.length === 0) return null;

    const signature = queue.map((song) => song.id).join('|');
    if (shuffleSignatureRef.current !== signature) {
      shuffleSignatureRef.current = signature;
      shuffleBagRef.current = [];
    }

    if (shuffleBagRef.current.length === 0) {
      shuffleBagRef.current = queue
        .filter((song) => song.id !== currentId)
        .map((song) => song.id)
        .sort(() => Math.random() - 0.5);
    }

    const nextId = shuffleBagRef.current.shift();
    return queue.find((song) => song.id === nextId)
      ?? queue.find((song) => song.id !== currentId)
      ?? queue[0];
  }, [queue]);

  // Track end logic
  const handleTrackEnded = useCallback(() => {
    if (playbackMode === 'REPEAT_ONE' && currentSong) {
      mainAudioEngine.seekTo(0);
      mainAudioEngine.play();
      return;
    }

    if (queue.length === 0) return;

    if (playbackMode === 'SHUFFLE') {
      const nextSong = getShuffleNextSong(currentSong?.id ?? null);
      if (nextSong) handlePlaySong(nextSong);
      else setIsPlaying(false);
      return;
    }

    const currentIndex = queue.findIndex((s) => s.id === currentSong?.id);
    if (currentIndex >= 0 && currentIndex < queue.length - 1) {
      handlePlaySong(queue[currentIndex + 1]);
    } else if (playbackMode === 'REPEAT_ALL') {
      handlePlaySong(queue[0]);
    } else {
      setIsPlaying(false);
    }
  }, [queue, currentSong, playbackMode, getShuffleNextSong]);

  // Play Song
  const handlePlaySong = (song: AudioItem, customQueue?: AudioItem[]) => {
    crossfadePendingSongRef.current = null;
    radioRecoveryRef.current = null;
    if (customQueue && customQueue.length > 0) {
      setQueue(customQueue);
      shuffleSignatureRef.current = '';
      shuffleBagRef.current = [];
    }
    setCurrentSong(song);
    setCurrentRadioStationId(null);
    mainAudioEngine.loadTrack(song).then(() => {
      mainAudioEngine.play();
    });
  };

  // Real audio crossfade for the main player. The AudioEngine overlaps two media sources.
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentRadioStationId || playbackMode === 'REPEAT_ONE') return;
      if (!currentSong || queue.length < 2) return;
      if (!mainAudioEngine.isPlaying || mainAudioEngine.isCrossfading) return;
      if (crossfadeDurationMs <= 0) return;

      const duration = mainAudioEngine.durationMs;
      const current = mainAudioEngine.currentTimeMs;
      const remaining = duration - current;
      if (!Number.isFinite(duration) || duration <= 0 || remaining <= 0 || remaining > crossfadeDurationMs) return;

      const currentIndex = queue.findIndex((song) => song.id === currentSong.id);
      const nextSong = playbackMode === 'SHUFFLE'
        ? getShuffleNextSong(currentSong.id)
        : currentIndex >= 0 && currentIndex < queue.length - 1
          ? queue[currentIndex + 1]
          : playbackMode === 'REPEAT_ALL'
            ? queue[0]
            : null;

      if (!nextSong || nextSong.id === currentSong.id) return;

      crossfadePendingSongRef.current = nextSong;
      mainAudioEngine.crossfadeTo(nextSong, Math.min(crossfadeDurationMs, remaining)).catch(() => {
        crossfadePendingSongRef.current = null;
        handlePlaySong(nextSong);
      });
    }, 100);

    return () => clearInterval(timer);
  }, [queue, currentSong, playbackMode, currentRadioStationId, crossfadeDurationMs, getShuffleNextSong]);

  // Play / Pause Toggle
  const handlePlayPause = () => {
    if (!currentSong) {
      if (queue.length > 0) {
        handlePlaySong(queue[0]);
      } else if (library.length > 0) {
        handlePlaySong(library[0]);
      }
      return;
    }

    if (isPlaying) {
      mainAudioEngine.pause();
    } else {
      mainAudioEngine.play();
    }
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    const nextSong = playbackMode === 'SHUFFLE'
      ? getShuffleNextSong(currentSong?.id ?? null)
      : (() => {
          const currentIndex = queue.findIndex((s) => s.id === currentSong?.id);
          if (currentIndex >= 0 && currentIndex < queue.length - 1) return queue[currentIndex + 1];
          return playbackMode === 'REPEAT_ALL' ? queue[0] : null;
        })();
    if (nextSong) handlePlaySong(nextSong);
  };

  const handlePrev = () => {
    if (queue.length === 0) return;
    if (currentTimeMs > 3000) {
      mainAudioEngine.seekTo(0);
      return;
    }
    const currentIndex = queue.findIndex((s) => s.id === currentSong?.id);
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    handlePlaySong(queue[prevIndex]);
  };

  const handleSeek = (positionMs: number) => {
    mainAudioEngine.seekTo(positionMs);
    setCurrentTimeMs(positionMs);
  };

  const handleVolumeChange = (v: number) => {
    const safe = Math.max(0, Math.min(1, v));
    setVolume(safe);
    mainAudioEngine.setVolume(safe);
    db.setSetting('master_volume', safe).catch(() => {});
  };

  const handleCrossfadeChange = async (duration: number) => {
    const safe = Math.max(0, Math.min(15000, Math.round(duration)));
    setCrossfadeDurationMs(safe);
    mainAudioEngine.setCrossfadeDuration(safe);
    await db.setSetting('crossfade_ms', safe);
  };

  const handleTogglePlaybackMode = () => {
    const modes: PlaybackMode[] = ['NORMAL', 'REPEAT_ONE', 'REPEAT_ALL', 'SHUFFLE'];
    const nextMode = modes[(modes.indexOf(playbackMode) + 1) % modes.length];
    setPlaybackMode(nextMode);
    shuffleBagRef.current = [];
    shuffleSignatureRef.current = '';
  };

  const handleToggleFavorite = async (song: AudioItem) => {
    const updatedFav = await db.toggleFavorite(song.id);
    song.isFavorite = updatedFav;
    setLibrary([...library]);
    if (currentSong?.id === song.id) {
      setCurrentSong({ ...song, isFavorite: updatedFav });
    }
  };

  const handleDeleteSong = async (id: string) => {
    await db.deleteSong(id);
    const updated = library.filter((s) => s.id !== id);
    setLibrary(updated);
    setQueue(queue.filter((s) => s.id !== id));
    if (currentSong?.id === id) {
      mainAudioEngine.pause();
      setCurrentSong(updated[0] || null);
    }
  };

  const handleImportFiles = async (files: FileList | File[]) => {
    try {
      const newItems = await batchImportAudioFiles(files);
      if (newItems.length === 0) return;

      await db.addSongs(newItems);
      const merged = [...newItems, ...library];
      setLibrary(merged);
      setQueue([...newItems, ...queue]);
      if (!currentSong && newItems.length > 0) {
        handlePlaySong(newItems[0]);
      }
    } catch (err) {
      console.warn('Importing audio files notice:', err);
    }
  };

  const handleClearLibrary = async () => {
    await db.clearAllSongs();
    setLibrary([]);
    setQueue([]);
    setCurrentSong(null);
    mainAudioEngine.pause();
  };

  // Playlists
  const handleCreatePlaylist = async (name: string) => {
    const created = await db.createPlaylist(name);
    setPlaylists([...playlists, created]);
  };

  const handleDeletePlaylist = async (id: string) => {
    await db.deletePlaylist(id);
    setPlaylists(playlists.filter((p) => p.id !== id));
  };

  const handleAddSongToPlaylist = async (playlistId: string, song: AudioItem) => {
    await db.addSongToPlaylist(playlistId, song);
    const refreshed = await db.getPlaylists();
    setPlaylists(refreshed);
  };

  const handleEnqueueSong = (song: AudioItem) => {
    if (queue.some((item) => item.id === song.id)) return;
    setQueue([...queue, song]);
    shuffleSignatureRef.current = '';
    shuffleBagRef.current = [];
  };

  const handleReorderQueue = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= queue.length || toIndex >= queue.length) return;
    const updated = [...queue];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setQueue(updated);
    shuffleSignatureRef.current = '';
    shuffleBagRef.current = [];
  };

  const handleSaveQueueAsPlaylist = async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName || queue.length === 0) return;
    const created = await db.createPlaylist(cleanName);
    for (const song of queue) await db.addSongToPlaylist(created.id, song);
    setPlaylists(await db.getPlaylists());
  };

  const handleAddQueueToPlaylist = async (playlistId: string) => {
    if (!playlistId || queue.length === 0) return;
    const uniqueQueue = queue.filter((song, index, arr) => arr.findIndex((x) => x.id === song.id) === index);
    for (const song of uniqueQueue) await db.addSongToPlaylist(playlistId, song);
    setPlaylists(await db.getPlaylists());
  };

  // DJ Deck Routing
  const handleSendToDeckA = (song: AudioItem) => {
    deckAEngine.loadTrack(song);
    setActiveTab('DJ_MIXER');
  };

  const handleSendToDeckB = (song: AudioItem) => {
    deckBEngine.loadTrack(song);
    setActiveTab('DJ_MIXER');
  };

  // Radio
  const handlePlayRadioStation = async (station: RadioStation) => {
    if (currentRadioStationId === station.id && isPlaying) {
      radioAttemptTokenRef.current++;
      radioAttemptActiveRef.current = false;
      radioRecoveryRef.current = null;
      mainAudioEngine.pause();
      setCurrentRadioStationId(null);
      return;
    }

    const token = ++radioAttemptTokenRef.current;
    radioAttemptActiveRef.current = true;

    if (!currentRadioStationId && currentSong) {
      radioRecoveryRef.current = {
        queue: [...queue],
        currentSong,
        currentTimeMs: mainAudioEngine.currentTimeMs || currentTimeMs,
        playbackMode,
      };
    } else {
      radioRecoveryRef.current = null;
    }

    crossfadePendingSongRef.current = null;
    setCurrentRadioStationId(station.id);
    mainAudioEngine.pause();

    let success = false;
    for (const streamUrl of station.streamUrls) {
      if (radioAttemptTokenRef.current !== token) return;

      const item: AudioItem = {
        id: 'radio_' + station.id,
        title: station.name,
        artist: 'Live Radio FM Direct',
        album: 'Live Radio',
        duration: 0,
        uri: streamUrl,
        addedDate: Date.now(),
      };

      setCurrentSong(item);
      await mainAudioEngine.loadTrack(item);
      success = await mainAudioEngine.play();
      if (success) break;
    }

    radioAttemptActiveRef.current = false;
    if (radioAttemptTokenRef.current !== token) return;

    if (!success) {
      const snapshot = radioRecoveryRef.current;
      radioRecoveryRef.current = null;
      setCurrentRadioStationId(null);

      if (snapshot?.currentSong) {
        setQueue(snapshot.queue);
        setCurrentSong(snapshot.currentSong);
        setPlaybackMode(snapshot.playbackMode);
        setCurrentTimeMs(snapshot.currentTimeMs);
        await mainAudioEngine.loadTrack(snapshot.currentSong);
        mainAudioEngine.seekTo(snapshot.currentTimeMs);
        await mainAudioEngine.play();
      } else {
        mainAudioEngine.pause();
        setCurrentSong(null);
        setIsPlaying(false);
      }
    } else {
      radioRecoveryRef.current = null;
    }
  };

  // Theme & Language
  const handleThemeChange = async (th: AppThemeOption) => {
    setCurrentTheme(th);
    await db.setSetting('app_theme', th);
  };

  const handleToggleLanguage = async () => {
    const next = !isArabic;
    setIsArabic(next);
    await db.setSetting('is_arabic', next);
  };

  return (
    <div
      id="dj-desktop-app"
      className="flex flex-col h-screen w-screen overflow-hidden font-sans select-none"
      style={{
        backgroundColor: themeColors.background,
        color: themeColors.textPrimary,
      }}
    >
      {/* Top Windows Native Desktop Title Bar */}
      <TitleBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
        isArabic={isArabic}
        onToggleLanguage={handleToggleLanguage}
        themeColors={themeColors}
      />

      {/* Main Screen Content Viewport */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {activeTab === 'LIBRARY' && (
          <LibraryScreen
            library={library}
            playlists={playlists}
            currentSong={currentSong}
            isPlaying={isPlaying}
            themeColors={themeColors}
            isArabic={isArabic}
            onPlaySong={handlePlaySong}
            onToggleFavorite={handleToggleFavorite}
            onDeleteSong={handleDeleteSong}
            onClearLibrary={handleClearLibrary}
            onImportFiles={handleImportFiles}
            onNavigateToOnline={() => setActiveTab('ONLINE_MUSIC')}
            onCreatePlaylist={handleCreatePlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            onAddSongToPlaylist={handleAddSongToPlaylist}
            onEnqueueSong={handleEnqueueSong}
            onSendToDeckA={handleSendToDeckA}
            onSendToDeckB={handleSendToDeckB}
          />
        )}

        {activeTab === 'DJ_MIXER' && (
          <DJMixerScreen
            library={library}
            themeColors={themeColors}
            isArabic={isArabic}
            onPauseMainPlayer={() => mainAudioEngine.pause()}
            onImportFiles={handleImportFiles}
          />
        )}

        {activeTab === 'EQUALIZER' && (
          <EqualizerScreen themeColors={themeColors} isArabic={isArabic} />
        )}

        {activeTab === 'KARAOKE' && (
          <KaraokeScreen themeColors={themeColors} isArabic={isArabic} />
        )}

        {activeTab === 'RADIO' && (
          <RadioScreen
            themeColors={themeColors}
            isArabic={isArabic}
            onPlayStation={handlePlayRadioStation}
            currentPlayingStationId={currentRadioStationId}
            isPlayingRadio={isPlaying && !!currentRadioStationId}
            onSendToDeckA={handleSendToDeckA}
            onSendToDeckB={handleSendToDeckB}
            onEnqueueSong={handleEnqueueSong}
          />
        )}

        {activeTab === 'ONLINE_MUSIC' && (
          <OnlineMusicScreen
            themeColors={themeColors}
            isArabic={isArabic}
            onPlayOnlineTrack={handlePlaySong}
            onSendToDeckA={handleSendToDeckA}
            onSendToDeckB={handleSendToDeckB}
            onEnqueueTrack={handleEnqueueSong}
            onSaveToLibrary={(track) => {
              db.addSong(track);
              setLibrary([track, ...library]);
            }}
          />
        )}

        {activeTab === 'SETTINGS' && (
          <SettingsScreen
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
          isArabic={isArabic}
          onToggleLanguage={handleToggleLanguage}
          themeColors={themeColors}
          crossfadeDurationMs={crossfadeDurationMs}
          onCrossfadeChange={handleCrossfadeChange}
        />
        )}
      </main>

      {/* Docked Desktop MiniPlayer */}
      <MiniPlayer
        currentSong={currentSong}
        isPlaying={isPlaying}
        currentTimeMs={currentTimeMs}
        durationMs={durationMs}
        playbackMode={playbackMode}
        volume={volume}
        themeColors={themeColors}
        isArabic={isArabic}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrev={handlePrev}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onTogglePlaybackMode={handleTogglePlaybackMode}
        onOpenQueue={() => setShowQueue(true)}
        onOpenNowPlaying={() => setShowNowPlaying(true)}
        onOpenEqualizer={() => setActiveTab('EQUALIZER')}
      />

      {/* Fullscreen Now Playing Overlay */}
      {showNowPlaying && (
        <NowPlayingModal
          currentSong={currentSong}
          isPlaying={isPlaying}
          currentTimeMs={currentTimeMs}
          durationMs={durationMs}
          playbackMode={playbackMode}
          volume={volume}
          themeColors={themeColors}
          isArabic={isArabic}
          onClose={() => setShowNowPlaying(false)}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrev={handlePrev}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onTogglePlaybackMode={handleTogglePlaybackMode}
          onToggleFavorite={handleToggleFavorite}
          onOpenQueue={() => {
            setShowNowPlaying(false);
            setShowQueue(true);
          }}
          onOpenEqualizer={() => {
            setShowNowPlaying(false);
            setActiveTab('EQUALIZER');
          }}
          onSendToDeckA={handleSendToDeckA}
          onSendToDeckB={handleSendToDeckB}
        />
      )}

      {/* Queue Modal */}
      {showQueue && (
        <QueueModal
          queue={queue}
          currentSong={currentSong}
          themeColors={themeColors}
          isArabic={isArabic}
          onClose={() => setShowQueue(false)}
          onSelectSong={(song) => handlePlaySong(song)}
          onRemoveFromQueue={(idx) => {
            const updated = [...queue];
            updated.splice(idx, 1);
            setQueue(updated);
            shuffleSignatureRef.current = '';
            shuffleBagRef.current = [];
          }}
          onClearQueue={() => {
            setQueue([]);
            shuffleSignatureRef.current = '';
            shuffleBagRef.current = [];
          }}
          onMoveItem={handleReorderQueue}
          playlists={playlists}
          onSaveAsPlaylist={handleSaveQueueAsPlaylist}
          onAddQueueToPlaylist={handleAddQueueToPlaylist}
        />
      )}
    </div>
  );
};

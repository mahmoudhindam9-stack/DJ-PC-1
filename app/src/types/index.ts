export interface AudioItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in milliseconds
  uri: string; // Blob URL or remote URL or local path
  coverUri?: string;
  addedDate: number;
  isFavorite?: boolean;
  playCount?: number;
  lastPlayed?: number;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  songCount: number;
  coverUri?: string;
}

export interface PlaylistWithSongs extends Playlist {
  songs: AudioItem[];
}

export interface RadioStation {
  id: string;
  name: string;
  streamUrls: string[];
  tags: string;
  codec: string;
  bitrate: number;
  countryCode: string;
}

export interface EqualizerBand {
  id: number;
  name: string;
  frequencyHz: number;
  minLevelDb: number;
  maxLevelDb: number;
  currentLevelDb: number;
}

export interface ModularEffect {
  id: string;
  displayName: string;
  isCustom?: boolean;
}

export interface CustomPreset {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  author?: string;
  bands: number[];
  bassBoost?: number;
  trebleBoost?: number;
  preampDb?: number;
  parameters?: Record<string, number>;
}

export type PlaybackMode = 'NORMAL' | 'REPEAT_ONE' | 'REPEAT_ALL' | 'SHUFFLE';

export type TabType = 
  | 'LIBRARY'
  | 'DJ_MIXER'
  | 'EQUALIZER'
  | 'KARAOKE'
  | 'RADIO'
  | 'ONLINE_MUSIC'
  | 'SETTINGS';

export type LibrarySubTab = 'ALL' | 'PLAYLISTS' | 'FAVORITES' | 'ARTISTS' | 'ALBUMS' | 'FOLDERS';

export type AppThemeOption =
  | 'SYSTEM'
  | 'DARK'
  | 'LIGHT'
  | 'DJ_BLUE'
  | 'MIDNIGHT_PURPLE'
  | 'GOLD_PREMIUM'
  | 'NEON_GREEN'
  | 'CRIMSON_RED'
  | 'CYBER_CYAN'
  | 'LIGHT_DJ_BLUE'
  | 'LIGHT_MIDNIGHT_PURPLE'
  | 'LIGHT_GOLD_PREMIUM'
  | 'LIGHT_NEON_GREEN'
  | 'LIGHT_CRIMSON_RED'
  | 'LIGHT_CYBER_CYAN';

export interface ThemeColors {
  primary: string;
  primaryHover: string;
  secondary: string;
  tertiary: string;
  background: string;
  surface: string;
  surfaceVariant: string;
  surfaceHover: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentA: string; // Deck A
  accentB: string; // Deck B
  isDark: boolean;
}

export type MicFilterType = 
  | 'NONE'
  | 'WARM'
  | 'BRIGHT'
  | 'TELEPHONE'
  | 'ROBOT'
  | 'RADIO'
  | 'CLUB'
  | 'MEGAPHONE';

export type BeatFxDivision = '1/1' | '1/2' | '1/4' | '1/8' | '3/4';

export interface SamplePad {
  id: string; // e.g. "A_0"
  bank: 'A' | 'B' | 'C' | 'D';
  index: number;
  name: string;
  category: string;
  assetPath: string;
  color?: string;
  hotkey?: string;
}

export interface AudiusTrack {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album?: string;
  artworkUrl?: string;
  streamUrl?: string;
  downloadUrl?: string;
  genre?: string;
  duration?: number;
}

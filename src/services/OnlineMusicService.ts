import { invoke } from '@tauri-apps/api/core';
import { AlbumatyHome, AlbumatyLink, AlbumatyTrack, AudiusTrack, AudioItem } from '../types';

const AUDIUS_NODES = [
  'https://discoveryprovider.audius.co/v1',
  'https://api.audius.co/v1',
];

export class OnlineMusicService {
  private activeNodeIndex = 0;

  // Real Arabic music source: Albumaty, fetched natively by Tauri to avoid browser CORS limitations.
  async getAlbumatyHome(query = ''): Promise<AlbumatyHome> {
    return invoke<AlbumatyHome>('albumaty_home', { query });
  }

  async getAlbumatySection(link: AlbumatyLink): Promise<AlbumatyLink[]> {
    return invoke<AlbumatyLink[]>('albumaty_section', { url: link.url });
  }

  async resolveAlbumatyTrack(link: AlbumatyLink): Promise<AlbumatyTrack> {
    return invoke<AlbumatyTrack>('albumaty_resolve_song', { url: link.url });
  }

  // Real foreign music source: Audius public API.
  async getTrendingTracks(): Promise<AudiusTrack[]> {
    return this.fetchAudiusTracks('/tracks/trending?limit=40');
  }

  async getLatestTracks(): Promise<AudiusTrack[]> {
    return this.fetchAudiusTracks('/tracks/latest?limit=40');
  }

  async searchAudius(query: string): Promise<AudiusTrack[]> {
    const encoded = encodeURIComponent(query.trim());
    return this.fetchAudiusTracks(
      `/tracks/search?query=${encoded}&limit=40&sort_method=relevant`
    );
  }

  private async fetchAudiusTracks(endpoint: string): Promise<AudiusTrack[]> {
    let lastError = 'Audius unavailable';

    for (let attempt = 0; attempt < AUDIUS_NODES.length; attempt++) {
      const base = AUDIUS_NODES[this.activeNodeIndex % AUDIUS_NODES.length];
      const url = `${base}${endpoint}${endpoint.includes('?') ? '&' : '?'}app_name=DJDesktop`;

      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, { signal: controller.signal });
        window.clearTimeout(timeout);

        if (!response.ok) {
          lastError = `Audius HTTP ${response.status}`;
          this.activeNodeIndex++;
          continue;
        }

        const json = await response.json();
        const items = Array.isArray(json.data) ? json.data : [];
        if (items.length === 0) return [];

        return items.map((t: Record<string, unknown>) => {
          const user = (t.user as Record<string, unknown>) || {};
          const artwork = (t.artwork as Record<string, string>) || {};
          const trackId = String(t.id || '');
          return {
            id: trackId,
            title: String(t.title || 'Untitled Track'),
            artist: String(user.name || 'Audius Artist'),
            artistId: String(user.id || ''),
            album: 'Audius Online',
            artworkUrl: artwork['480x480'] || artwork['150x150'] || '',
            streamUrl: `${base}/tracks/${trackId}/stream?app_name=DJDesktop`,
            genre: String(t.genre || ''),
            duration: (Number(t.duration) || 0) * 1000,
          } satisfies AudiusTrack;
        });
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.activeNodeIndex++;
      }
    }

    throw new Error(lastError);
  }

  albumatyToAudioItem(track: AlbumatyTrack): AudioItem {
    return {
      id: track.id,
      title: track.title,
      artist: track.artist || 'Albumaty',
      album: track.album || 'Albumaty',
      duration: 0,
      uri: track.streamUrl,
      coverUri: track.artworkUrl,
      addedDate: Date.now(),
    };
  }

  audiusToAudioItem(track: AudiusTrack): AudioItem {
    return {
      id: 'audius:' + track.id,
      title: track.title,
      artist: track.artist,
      album: track.album || 'Audius Online',
      duration: track.duration || 0,
      uri: track.streamUrl || '',
      coverUri: track.artworkUrl,
      addedDate: Date.now(),
    };
  }
}

export const onlineMusicService = new OnlineMusicService();

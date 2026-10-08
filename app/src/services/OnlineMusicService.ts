import { AudiusTrack, AudioItem } from '../types';

export interface AlbumatyLink {
  title: string;
  url: string;
}

export interface AlbumatyHomeData {
  categories: AlbumatyLink[];
  albums: AlbumatyLink[];
  songs: AlbumatyLink[];
  artists: AlbumatyLink[];
}

export interface AlbumatySection {
  title: string;
  url: string;
  content: AlbumatyLink[];
}

export interface ResolvedOnlineTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  streamUrl: string;
  downloadUrl: string;
  duration?: number;
}

type OnlineApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const LOCAL_API = '/api/albumaty';

const AUDIUS_NODES = [
  'https://discoveryprovider.audius.co/v1',
  'https://api.audius.co/v1',
];

class OnlineMusicService {
  async getAlbumatyHome(force = false): Promise<AlbumatyHomeData> {
    const suffix = force ? '?force=1' : '';
    return this.requestJson<AlbumatyHomeData>(`${LOCAL_API}/home${suffix}`);
  }

  async getAlbumatySection(url: string): Promise<AlbumatySection> {
    return this.requestJson<AlbumatySection>(
      `${LOCAL_API}/section?url=${encodeURIComponent(url)}`
    );
  }

  async resolveAlbumatySong(url: string): Promise<ResolvedOnlineTrack> {
    return this.requestJson<ResolvedOnlineTrack>(
      `${LOCAL_API}/resolve?url=${encodeURIComponent(url)}`
    );
  }

  getAlbumatyDownloadEndpoint(url: string): string {
    return `${LOCAL_API}/download?url=${encodeURIComponent(url)}`;
  }

  convertResolvedToAudioItem(track: ResolvedOnlineTrack, stableId?: string): AudioItem {
    return {
      id: stableId || `albumaty_${encodeURIComponent(track.id)}`,
      title: track.title,
      artist: track.artist || 'Albumaty',
      album: track.album || 'Albumaty Online',
      duration: track.duration || 0,
      uri: track.streamUrl,
      coverUri: track.artworkUrl,
      addedDate: Date.now(),
    };
  }

  async getTrendingTracks(): Promise<AudiusTrack[]> {
    return this.fetchAudiusTracks('/tracks/trending?limit=50');
  }

  async getLatestTracks(): Promise<AudiusTrack[]> {
    return this.fetchAudiusTracks('/tracks/latest?limit=50');
  }

  async searchAudius(query: string): Promise<AudiusTrack[]> {
    if (!query.trim()) return [];
    return this.fetchAudiusTracks(
      `/tracks/search?query=${encodeURIComponent(query)}&limit=50&sort_method=relevant`
    );
  }

  convertAudiusToAudioItem(track: AudiusTrack): AudioItem {
    return {
      id: `audius_${track.id}`,
      title: track.title,
      artist: track.artist,
      album: track.album || 'Audius',
      duration: track.duration || 0,
      uri: track.streamUrl || '',
      coverUri: track.artworkUrl,
      addedDate: Date.now(),
    };
  }

  private async requestJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    let payload: OnlineApiResponse<T>;
    try {
      payload = await response.json();
    } catch {
      throw new Error('The online music service returned an invalid response.');
    }

    if (!response.ok || !payload.ok || payload.data === undefined) {
      throw new Error(
        payload.error || `Online music request failed (HTTP ${response.status}).`
      );
    }

    return payload.data;
  }

  private activeAudiusNode = 0;

  private async fetchAudiusTracks(endpoint: string): Promise<AudiusTrack[]> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < AUDIUS_NODES.length; attempt += 1) {
      const base = AUDIUS_NODES[this.activeAudiusNode % AUDIUS_NODES.length];
      const separator = endpoint.includes('?') ? '&' : '?';
      const url = `${base}${endpoint}${separator}app_name=DJDesktop`;

      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        window.clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Audius returned HTTP ${response.status}`);
        }

        const json = await response.json();
        const items = Array.isArray(json.data) ? json.data : [];

        return items
          .map((track: Record<string, unknown>) => {
            const user = (track.user as Record<string, unknown>) || {};
            const artwork = (track.artwork as Record<string, string>) || {};
            const trackId = String(track.id || '');
            const artistId = String(user.id || '');
            const artworkUrl =
              artwork['480x480'] ||
              artwork['_480x480'] ||
              artwork['150x150'] ||
              artwork['_150x150'] ||
              '';

            return {
              id: trackId,
              title: String(track.title || 'Untitled Track'),
              artist: String(user.name || user.handle || 'Audius Artist'),
              artistId,
              album: String(track.album_backlink || '').trim() || 'Audius',
              artworkUrl,
              streamUrl: `${base}/tracks/${trackId}/stream?app_name=DJDesktop`,
              genre: String(track.genre || ''),
              duration: (Number(track.duration) || 0) * 1000,
            } satisfies AudiusTrack;
          })
          .filter((track: AudiusTrack) => Boolean(track.id));
      } catch (error) {
        lastError = error;
        this.activeAudiusNode += 1;
      }
    }

    throw new Error(
      lastError instanceof Error
        ? lastError.message
        : 'Unable to connect to Audius.'
    );
  }
}

export const onlineMusicService = new OnlineMusicService();

import { AudiusTrack, AudioItem } from '../types';

const AUDIUS_NODES = [
  'https://discoveryprovider.audius.co/v1',
  'https://api.audius.co/v1',
  'https://audius-dp.singapore.creatorseed.com/v1',
];

export class OnlineMusicService {
  private activeNodeIndex = 0;

  private getNode(): string {
    return AUDIUS_NODES[this.activeNodeIndex % AUDIUS_NODES.length];
  }

  async getTrendingTracks(): Promise<AudiusTrack[]> {
    return this.fetchAudiusTracks('/tracks/trending?limit=40');
  }

  async getLatestTracks(): Promise<AudiusTrack[]> {
    return this.fetchAudiusTracks('/tracks/latest?limit=40');
  }

  async searchAudius(query: string): Promise<AudiusTrack[]> {
    const encoded = encodeURIComponent(query);
    return this.fetchAudiusTracks(`/tracks/search?query=${encoded}&limit=40&sort_method=relevant`);
  }

  private async fetchAudiusTracks(endpoint: string): Promise<AudiusTrack[]> {
    for (let attempt = 0; attempt < AUDIUS_NODES.length; attempt++) {
      const base = this.getNode();
      const url = `${base}${endpoint}&app_name=DJDesktop`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json.data) ? json.data : [];
          return items.map((t: Record<string, unknown>) => {
            const user = (t.user as Record<string, unknown>) || {};
            const artwork = (t.artwork as Record<string, string>) || {};
            const artUrl = artwork['480x480'] || artwork['150x150'] || '';
            const trackId = String(t.id || '');
            const stream = `${base}/tracks/${trackId}/stream?app_name=DJDesktop`;

            return {
              id: trackId,
              title: String(t.title || 'Untitled Track'),
              artist: String(user.name || 'Audius Artist'),
              artistId: String(user.id || ''),
              album: 'Audius Online',
              artworkUrl: artUrl,
              streamUrl: stream,
              genre: String(t.genre || ''),
              duration: (Number(t.duration) || 0) * 1000,
            };
          });
        }
      } catch (e) {
        console.warn(`Audius fetch failed on node ${base}:`, e);
        this.activeNodeIndex++;
      }
    }

    // Fallback curated sample tracks
    return [
      {
        id: 'sample_1',
        title: 'Cyberpunk Electro Groove',
        artist: 'Synthwave Sound',
        artistId: 'art_1',
        album: 'Audius Trends',
        streamUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=cyberpunk-2099-10701.mp3',
        duration: 145000,
        genre: 'Electronic',
      },
      {
        id: 'sample_2',
        title: 'Club House DJ Beat',
        artist: 'DJ Neon Pulse',
        artistId: 'art_2',
        album: 'Club Hits',
        streamUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=action-stylish-rock-10023.mp3',
        duration: 120000,
        genre: 'House',
      },
      {
        id: 'sample_3',
        title: 'Arabic Chill Oud Lounge',
        artist: 'Oriental Beats',
        artistId: 'art_3',
        album: 'Desert Nights',
        streamUrl: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3?filename=arabic-oriental-lounge-19818.mp3',
        duration: 180000,
        genre: 'Oriental',
      },
    ];
  }

  convertToAudioItem(track: AudiusTrack): AudioItem {
    return {
      id: 'online_' + track.id,
      title: track.title,
      artist: track.artist,
      album: track.album || 'Online Music',
      duration: track.duration || 0,
      uri: track.streamUrl || '',
      coverUri: track.artworkUrl,
      addedDate: Date.now(),
    };
  }
}

export const onlineMusicService = new OnlineMusicService();

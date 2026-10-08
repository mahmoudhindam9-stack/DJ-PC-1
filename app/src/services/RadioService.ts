import { RadioStation } from '../types';

export const EGYPT_QURAN_STATION: RadioStation = {
  id: 'builtin-eg-quran-cairo',
  name: 'إذاعة القرآن الكريم من القاهرة',
  streamUrls: [
    'https://stream.radiojar.com/8s5u5tpdtwzuv',
    'https://n0e.radiojar.com/8s5u5tpdtwzuv',
    'https://n05.radiojar.com/8s5u5tpdtwzuv',
  ],
  tags: 'اسلامي • دين • قرآن',
  codec: 'MP3',
  bitrate: 128,
  countryCode: 'EG',
};

const RADIO_BROWSER_HOSTS = [
  'all.api.radio-browser.info',
  'de1.api.radio-browser.info',
  'nl1.api.radio-browser.info',
  'at1.api.radio-browser.info',
];

export class RadioService {
  private activeHostIndex = 0;

  private getHost(): string {
    return RADIO_BROWSER_HOSTS[this.activeHostIndex % RADIO_BROWSER_HOSTS.length];
  }

  private rotateHost() {
    this.activeHostIndex++;
  }

  async getStations(countryCode: string | null, query = ''): Promise<RadioStation[]> {
    const isWorld = !countryCode || countryCode.trim() === '';
    const useTopVotes = isWorld && query.trim() === '';
    const endpoint = useTopVotes ? '/json/stations/topvote' : '/json/stations/search';

    const params = new URLSearchParams({
      hidebroken: 'true',
      lastcheckok: '1',
      order: 'votes',
      reverse: 'true',
      limit: '100',
    });

    if (!isWorld && countryCode) {
      params.append('countrycode', countryCode);
    }
    if (query.trim() !== '') {
      params.append('name', query.trim());
    }

    // Try multiple mirror hosts
    for (let attempt = 0; attempt < RADIO_BROWSER_HOSTS.length; attempt++) {
      const host = this.getHost();
      const url = `https://${host}${endpoint}?${params.toString()}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'DJ-Desktop/3.6.7',
            Accept: 'application/json',
          },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const stations: RadioStation[] = [];

          for (const item of data) {
            const resolved = (item.url_resolved || '').trim();
            const raw = (item.url || '').trim();
            const urls = [resolved, raw].filter(
              (u) => u.startsWith('http://') || u.startsWith('https://')
            );
            if (urls.length === 0) continue;

            stations.push({
              id: item.stationuuid || urls[0],
              name: item.name || 'Radio',
              streamUrls: Array.from(new Set(urls)),
              tags: item.tags || '',
              codec: (item.codec || 'MP3').toUpperCase(),
              bitrate: item.bitrate || 0,
              countryCode: item.countrycode || '',
            });
          }

          // If Egypt scope, prepend the canonical Quran station
          if (countryCode?.toUpperCase() === 'EG') {
            const matchesQuery =
              query.trim() === '' ||
              EGYPT_QURAN_STATION.name.toLowerCase().includes(query.toLowerCase());
            if (matchesQuery) {
              // Ensure no duplicate
              const filtered = stations.filter((s) => s.id !== EGYPT_QURAN_STATION.id);
              return [EGYPT_QURAN_STATION, ...filtered];
            }
          }

          return stations;
        }
      } catch (e) {
        console.warn(`Radio API fetch failed on host ${host}:`, e);
        this.rotateHost();
      }
    }

    // Fallback static list for Egypt if API network is offline
    if (countryCode?.toUpperCase() === 'EG') {
      return [
        EGYPT_QURAN_STATION,
        {
          id: 'eg-nogoum-fm',
          name: 'Nogoum FM 100.6',
          streamUrls: ['https://nogoumfm.com/stream', 'https://streaming.nogoumfm.net/nogoumfm'],
          tags: 'Hits • Pop • Talk',
          codec: 'MP3',
          bitrate: 128,
          countryCode: 'EG',
        },
        {
          id: 'eg-mega-fm',
          name: 'Mega FM 92.7',
          streamUrls: ['https://stream.radiojar.com/megafm'],
          tags: 'Variety • Hits',
          codec: 'MP3',
          bitrate: 128,
          countryCode: 'EG',
        },
        {
          id: 'eg-radio-masr',
          name: 'Radio Masr 88.7',
          streamUrls: ['https://stream.radiojar.com/radiomasr'],
          tags: 'News • Egypt',
          codec: 'MP3',
          bitrate: 128,
          countryCode: 'EG',
        },
      ];
    }

    return [];
  }
}

export const radioService = new RadioService();

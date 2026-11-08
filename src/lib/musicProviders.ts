import type { MusicTrack } from '@/types';

const ITUNES_SEARCH = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP = 'https://itunes.apple.com/lookup';
const DEEZER_SEARCH = 'https://api.deezer.com/search';
const DEEZER_TRACK = 'https://api.deezer.com/track';
const SPOTIFY_OEMBED = 'https://open.spotify.com/oembed';
const SPOTIFY_EMBED = 'https://open.spotify.com/embed/track';
const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN = 'https://accounts.spotify.com/api/token';

const PROVIDER_TIMEOUT_MS = 6_000;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;

const AUDIO_HOST_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.itunes\.apple\.com\//i,
  /^https:\/\/[a-z0-9-]+\.dzcdn\.net\//i,
  /^https:\/\/audio-ssl\.itunes\.apple\.com\//i,
];

type CacheEntry = { expiresAt: number; value: unknown };
const cache = new Map<string, CacheEntry>();

function readCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function writeCache(key: string, value: unknown, ttlMs: number) {
  if (cache.size >= 200) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

export function normalizeMusicText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(feat|featuring|ft)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function parseSpotifyTrackUrl(input: string): { id: string; url: string } | null {
  const value = input.trim();
  const match = value.match(
    /(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/i,
  );
  if (!match?.[1]) return null;
  return {
    id: match[1],
    url: `https://open.spotify.com/track/${match[1]}`,
  };
}

function isAllowedAudioUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('https://')) return false;
  return AUDIO_HOST_PATTERNS.some((pattern) => pattern.test(value));
}

async function fetchJson(url: string, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<any> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Provider responded ${response.status}`);
  }
  return response.json();
}

async function fetchText(url: string, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Spotify embed responded ${response.status}`);
  return response.text();
}

function spotifySearchUrl(title: string, artist: string): string {
  const term = [title, artist].filter(Boolean).join(' ');
  return `https://open.spotify.com/search/${encodeURIComponent(term)}`;
}

function upscaleITunesArtwork(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  return value.replace(/\/\d+x\d+bb\.(jpg|jpeg|png|webp)$/i, '/600x600bb.$1');
}

async function searchITunes(term: string): Promise<MusicTrack[]> {
  const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(term)}&entity=song&limit=10&country=US`;
  const json = await fetchJson(url);
  const results = Array.isArray(json?.results) ? json.results : [];

  return results
    .map((item: any): MusicTrack | null => {
      const title = typeof item?.trackName === 'string' ? item.trackName : '';
      const artist = typeof item?.artistName === 'string' ? item.artistName : '';
      if (!title || !artist) return null;
      const trackId = item?.trackId != null ? String(item.trackId) : '';
      return {
        id: `itunes:${trackId || `${normalizeMusicText(title)}-${normalizeMusicText(artist)}`}`,
        title,
        artist,
        album: typeof item?.collectionName === 'string' ? item.collectionName : undefined,
        albumCoverUrl: upscaleITunesArtwork(item?.artworkUrl100),
        spotifyUrl: spotifySearchUrl(title, artist),
        previewAudioUrl: isAllowedAudioUrl(item?.previewUrl) ? item.previewUrl : null,
        provider: 'itunes',
        providerTrackId: trackId || undefined,
      };
    })
    .filter((track: MusicTrack | null): track is MusicTrack => Boolean(track));
}

async function searchDeezer(term: string): Promise<MusicTrack[]> {
  const url = `${DEEZER_SEARCH}?q=${encodeURIComponent(term)}&limit=10`;
  const json = await fetchJson(url);
  const results = Array.isArray(json?.data) ? json.data : [];

  return results
    .map((item: any): MusicTrack | null => {
      const title = typeof item?.title === 'string' ? item.title : '';
      const artist = typeof item?.artist?.name === 'string' ? item.artist.name : '';
      if (!title || !artist) return null;
      const trackId = item?.id != null ? String(item.id) : '';
      return {
        id: `deezer:${trackId || `${normalizeMusicText(title)}-${normalizeMusicText(artist)}`}`,
        title,
        artist,
        album: typeof item?.album?.title === 'string' ? item.album.title : undefined,
        albumCoverUrl:
          (typeof item?.album?.cover_big === 'string' && item.album.cover_big) ||
          (typeof item?.album?.cover_medium === 'string' && item.album.cover_medium) ||
          (typeof item?.album?.cover === 'string' && item.album.cover) ||
          '',
        spotifyUrl: spotifySearchUrl(title, artist),
        previewAudioUrl: isAllowedAudioUrl(item?.preview) ? item.preview : null,
        provider: 'deezer',
        providerTrackId: trackId || undefined,
      };
    })
    .filter((track: MusicTrack | null): track is MusicTrack => Boolean(track));
}

function dedupeTracks(tracks: MusicTrack[]): MusicTrack[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    const key = `${normalizeMusicText(track.title)}|${normalizeMusicText(track.artist)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortTracks(tracks: MusicTrack[]): MusicTrack[] {
  const providerRank: Record<MusicTrack['provider'], number> = {
    spotify: 0,
    itunes: 1,
    deezer: 2,
  };
  return [...tracks].sort((a, b) => {
    const previewDelta = Number(Boolean(b.previewAudioUrl)) - Number(Boolean(a.previewAudioUrl));
    if (previewDelta !== 0) return previewDelta;
    return providerRank[a.provider] - providerRank[b.provider];
  });
}

async function safeProvider<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Optional Spotify Web API (only used when credentials are configured)        */
/* -------------------------------------------------------------------------- */

let spotifyTokenCache: { token: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (spotifyTokenCache && spotifyTokenCache.expiresAt > Date.now() + 30_000) {
    return spotifyTokenCache.token;
  }

  try {
    const response = await fetch(SPOTIFY_TOKEN, {
      method: 'POST',
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const json = await response.json();
    if (typeof json?.access_token !== 'string') return null;
    spotifyTokenCache = {
      token: json.access_token,
      expiresAt: Date.now() + Math.max(60, Number(json.expires_in) || 3600) * 1000,
    };
    return spotifyTokenCache.token;
  } catch {
    return null;
  }
}

function mapSpotifyTrack(item: any): MusicTrack | null {
  if (!item || typeof item !== 'object') return null;
  const title = typeof item.name === 'string' ? item.name : '';
  const artist = Array.isArray(item.artists)
    ? item.artists
        .map((entry: any) => (typeof entry?.name === 'string' ? entry.name : ''))
        .filter(Boolean)
        .join(', ')
    : '';
  if (!title || !artist) return null;
  const trackId = typeof item.id === 'string' ? item.id : '';
  return {
    id: `spotify:${trackId}`,
    title,
    artist,
    album: typeof item?.album?.name === 'string' ? item.album.name : undefined,
    albumCoverUrl:
      (Array.isArray(item?.album?.images) && item.album.images[0]?.url) || '',
    spotifyUrl:
      (typeof item?.external_urls?.spotify === 'string' && item.external_urls.spotify) ||
      `https://open.spotify.com/track/${trackId}`,
    previewAudioUrl: isAllowedAudioUrl(item?.preview_url) ? item.preview_url : null,
    provider: 'spotify',
    providerTrackId: trackId || undefined,
  };
}

async function searchSpotify(term: string): Promise<MusicTrack[]> {
  const token = await getSpotifyToken();
  if (!token) return [];
  try {
    const json = await fetchJson(
      `${SPOTIFY_API}/search?q=${encodeURIComponent(term)}&type=track&limit=8&market=US`,
    );
    const items = Array.isArray(json?.tracks?.items) ? json.tracks.items : [];
    return items
      .map(mapSpotifyTrack)
      .filter((track: MusicTrack | null): track is MusicTrack => Boolean(track));
  } catch {
    return [];
  }
}

async function getSpotifyTrack(trackId: string): Promise<MusicTrack | null> {
  const token = await getSpotifyToken();
  if (!token) return null;
  try {
    const json = await fetchJson(`${SPOTIFY_API}/tracks/${trackId}?market=US`);
    return mapSpotifyTrack(json);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export async function searchMusicTracks(query: string): Promise<{
  tracks: MusicTrack[];
  warning?: string;
}> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return { tracks: [] };

  const cacheKey = `search:${normalizedQuery.toLowerCase()}`;
  const cached = readCache<{ tracks: MusicTrack[]; warning?: string }>(cacheKey);
  if (cached) return cached;

  const [spotify, itunes, deezer] = await Promise.all([
    safeProvider(searchSpotify(normalizedQuery)),
    safeProvider(searchITunes(normalizedQuery)),
    safeProvider(searchDeezer(normalizedQuery)),
  ]);

  const tracks = sortTracks(
    dedupeTracks([...(spotify || []), ...(itunes || []), ...(deezer || [])]),
  ).slice(0, 5);

  const result = {
    tracks,
    warning:
      tracks.length === 0
        ? 'No encontramos resultados. Probá con otro nombre o pegá un link de Spotify.'
        : undefined,
  };
  writeCache(cacheKey, result, SEARCH_CACHE_TTL_MS);
  return result;
}

async function readSpotifyArtist(trackId: string): Promise<string> {
  try {
    const html = await fetchText(`${SPOTIFY_EMBED}/${trackId}`);
    const match = html.match(/"artists":\[\{"name":"((?:\\.|[^"\\])*)"/);
    if (!match?.[1]) return '';
    try {
      return JSON.parse(`"${match[1]}"`);
    } catch {
      return match[1];
    }
  } catch {
    return '';
  }
}

function pickBestMatch(
  candidates: MusicTrack[],
  title: string,
  artist: string,
): MusicTrack | null {
  if (candidates.length === 0) return null;
  const normalizedTitle = normalizeMusicText(title);
  const normalizedArtist = normalizeMusicText(artist);

  const scored = candidates.map((track) => {
    const candidateTitle = normalizeMusicText(track.title);
    const candidateArtist = normalizeMusicText(track.artist);
    let score = 0;
    if (candidateTitle === normalizedTitle) score += 6;
    else if (candidateTitle.includes(normalizedTitle) || normalizedTitle.includes(candidateTitle)) {
      score += 3;
    }
    if (normalizedArtist && candidateArtist === normalizedArtist) score += 5;
    else if (
      normalizedArtist &&
      (candidateArtist.includes(normalizedArtist) ||
        normalizedArtist.includes(candidateArtist))
    ) {
      score += 2;
    }
    if (track.previewAudioUrl) score += 4;
    return { track, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].track : candidates[0];
}

export async function resolveSpotifyTrackUrl(input: string): Promise<{
  tracks: MusicTrack[];
  spotify: { title: string; thumbnailUrl: string; url: string };
  warning?: string;
} | null> {
  const parsed = parseSpotifyTrackUrl(input);
  if (!parsed) return null;

  const cacheKey = `spotify:${parsed.id}`;
  const cached = readCache<{
    tracks: MusicTrack[];
    spotify: { title: string; thumbnailUrl: string; url: string };
    warning?: string;
  }>(cacheKey);
  if (cached) return cached;

  const [oembed, apiTrack, artist] = await Promise.all([
    safeProvider(
      fetchJson(`${SPOTIFY_OEMBED}?url=${encodeURIComponent(parsed.url)}`),
    ),
    safeProvider(getSpotifyTrack(parsed.id)),
    readSpotifyArtist(parsed.id),
  ]);

  const title =
    (typeof oembed?.title === 'string' && oembed.title) ||
    apiTrack?.title ||
    '';
  const thumbnailUrl =
    (typeof oembed?.thumbnail_url === 'string' && oembed.thumbnail_url) ||
    apiTrack?.albumCoverUrl ||
    '';
  const resolvedArtist = apiTrack?.artist || artist || '';

  if (!title) {
    return {
      tracks: [],
      spotify: { title: '', thumbnailUrl, url: parsed.url },
      warning: 'No pudimos leer esa canción de Spotify. Probá buscándola por nombre.',
    };
  }

  const searchTerm = [title, resolvedArtist].filter(Boolean).join(' ');
  const [itunes, deezer] = await Promise.all([
    safeProvider(searchITunes(searchTerm)),
    safeProvider(searchDeezer(searchTerm)),
  ]);

  const best = pickBestMatch(
    dedupeTracks([...(itunes || []), ...(deezer || [])]),
    title,
    resolvedArtist,
  );

  const track: MusicTrack = {
    id: `spotify:${parsed.id}`,
    title,
    artist: resolvedArtist || best?.artist || '',
    album: best?.album,
    albumCoverUrl: thumbnailUrl || best?.albumCoverUrl || '',
    spotifyUrl: parsed.url,
    previewAudioUrl: best?.previewAudioUrl ?? null,
    provider: 'spotify',
    providerTrackId: parsed.id,
  };

  const result = {
    tracks: [track],
    spotify: { title, thumbnailUrl, url: parsed.url },
    warning: track.previewAudioUrl
      ? undefined
      : 'Esta canción no tiene demo disponible. Se va a guardar como acompañamiento visual.',
  };
  writeCache(cacheKey, result, SEARCH_CACHE_TTL_MS);
  return result;
}

export async function refreshPreviewUrl(
  provider: string,
  trackId: string,
): Promise<string | null> {
  if (!trackId || !/^[A-Za-z0-9]+$/.test(trackId)) return null;
  const cacheKey = `preview:${provider}:${trackId}`;
  const cached = readCache<string | null>(cacheKey);
  if (cached !== null) return cached;

  let preview: string | null = null;
  try {
    if (provider === 'itunes') {
      const json = await fetchJson(
        `${ITUNES_LOOKUP}?id=${encodeURIComponent(trackId)}&entity=song&country=US`,
      );
      const value = Array.isArray(json?.results) ? json.results[0]?.previewUrl : null;
      preview = isAllowedAudioUrl(value) ? value : null;
    } else if (provider === 'deezer') {
      const json = await fetchJson(`${DEEZER_TRACK}/${encodeURIComponent(trackId)}`);
      preview = isAllowedAudioUrl(json?.preview) ? json.preview : null;
    }
  } catch {
    preview = null;
  }

  writeCache(cacheKey, preview, PREVIEW_CACHE_TTL_MS);
  return preview;
}

/**
 * Utility for detecting, parsing, and sanitizing URLs in user content.
 * Cleans visual clutter, strips tracking parameters, and derives clean titles.
 */

export type SupportedProvider =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'x'
  | 'threads'
  | 'spotify'
  | 'generic';

export interface UrlMetadataHints {
  originalUrl: string;
  cleanUrl: string;
  displayUrl: string;
  provider: SupportedProvider;
  providerLabel: string;
  shortcode?: string;
  isVideoOrReel: boolean;
}

/** Matches URLs beginning with http:// or https:// */
export const URL_REGEX = /(https?:\/\/[^\s<>'"]+)/gi;

/** Common tracking parameters to strip for clean display and canonical URLs */
const TRACKING_PARAMS = [
  'igsh',
  'rpxt',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'si',
  'ref',
  'ref_src',
  't',
  'feature',
];

/**
 * Strips accidental trailing punctuation often picked up by regex
 * e.g., "https://example.com/)." -> "https://example.com/"
 */
export function sanitizeUrlString(rawUrl: string): string {
  let url = rawUrl.trim();
  // Strip trailing punctuation like comma, dot, parenthesis, quotes
  url = url.replace(/[),;.]+$/, '');
  return url;
}

/**
 * Strips tracking parameters from a URL while preserving functional path & parameters.
 */
export function cleanUrlTrackingParams(rawUrl: string): string {
  try {
    const sanitized = sanitizeUrlString(rawUrl);
    const parsed = new URL(sanitized);

    TRACKING_PARAMS.forEach((param) => {
      parsed.searchParams.delete(param);
    });

    // Remove empty search strings
    let clean = parsed.toString();
    if (clean.endsWith('?')) {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch {
    return sanitizeUrlString(rawUrl);
  }
}

/**
 * Returns a human-friendly compact display URL (e.g. "instagram.com/reel/DeVLie...")
 */
export function cleanDisplayUrl(rawUrl: string, maxLen = 42): string {
  try {
    const clean = cleanUrlTrackingParams(rawUrl);
    const parsed = new URL(clean);
    const host = parsed.hostname.replace(/^www\./, '');
    const pathAndQuery = `${parsed.pathname}${parsed.search}`;
    const full = `${host}${pathAndQuery}`.replace(/\/$/, '');

    if (full.length <= maxLen) return full;
    return `${full.slice(0, maxLen - 1)}…`;
  } catch {
    return rawUrl.slice(0, maxLen);
  }
}

/**
 * Inspects a URL to identify platform, type of media (e.g. Reel), and shortcode.
 */
export function extractUrlMetadataHints(rawUrl: string): UrlMetadataHints {
  const sanitized = sanitizeUrlString(rawUrl);
  const cleanUrl = cleanUrlTrackingParams(sanitized);
  let provider: SupportedProvider = 'generic';
  let providerLabel = 'Enlace Web';
  let shortcode: string | undefined;
  let isVideoOrReel = false;

  try {
    const parsed = new URL(cleanUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname;

    if (host.includes('instagram.com')) {
      provider = 'instagram';
      providerLabel = 'Instagram';
      if (pathname.includes('/reel/') || pathname.includes('/reels/')) {
        isVideoOrReel = true;
        providerLabel = 'Instagram Reel';
        const match = pathname.match(/\/reel(?:s)?\/([a-zA-Z0-9_-]+)/);
        if (match) shortcode = match[1];
      } else if (pathname.includes('/p/')) {
        const match = pathname.match(/\/p\/([a-zA-Z0-9_-]+)/);
        if (match) shortcode = match[1];
        providerLabel = 'Instagram Post';
      }
    } else if (host.includes('tiktok.com')) {
      provider = 'tiktok';
      providerLabel = 'TikTok';
      isVideoOrReel = true;
      const match = pathname.match(/\/video\/([0-9]+)/);
      if (match) shortcode = match[1];
    } else if (host.includes('youtube.com') || host.includes('youtu.be')) {
      provider = 'youtube';
      isVideoOrReel = true;
      if (pathname.includes('/shorts/')) {
        providerLabel = 'YouTube Short';
        const match = pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
        if (match) shortcode = match[1];
      } else if (host.includes('youtu.be')) {
        providerLabel = 'YouTube';
        shortcode = pathname.replace(/^\//, '').split('/')[0];
      } else {
        providerLabel = 'YouTube';
        shortcode = parsed.searchParams.get('v') || undefined;
      }
    } else if (host.includes('facebook.com') || host.includes('fb.watch')) {
      provider = 'facebook';
      providerLabel = 'Facebook';
      if (pathname.includes('/reel/') || pathname.includes('/watch/')) {
        isVideoOrReel = true;
        providerLabel = 'Facebook Reel';
      }
    } else if (host.includes('x.com') || host.includes('twitter.com')) {
      provider = 'x';
      providerLabel = 'X (Twitter)';
    } else if (host.includes('threads.net')) {
      provider = 'threads';
      providerLabel = 'Threads';
    } else if (host.includes('spotify.com')) {
      provider = 'spotify';
      providerLabel = 'Spotify';
    } else {
      provider = 'generic';
      providerLabel = host;
    }
  } catch {
    // Keep generic defaults
  }

  return {
    originalUrl: rawUrl,
    cleanUrl,
    displayUrl: cleanDisplayUrl(cleanUrl),
    provider,
    providerLabel,
    shortcode,
    isVideoOrReel,
  };
}

/**
 * Extracts all URLs found in the given content.
 */
export function extractUrls(content: string): UrlMetadataHints[] {
  if (!content) return [];
  const matches = content.match(URL_REGEX);
  if (!matches) return [];

  const seen = new Set<string>();
  const results: UrlMetadataHints[] = [];

  for (const raw of matches) {
    const sanitized = sanitizeUrlString(raw);
    if (!seen.has(sanitized)) {
      seen.add(sanitized);
      results.push(extractUrlMetadataHints(sanitized));
    }
  }

  return results;
}

/**
 * Returns a fallback semantic title when the user solely pasted an URL.
 */
export function getSemanticFallbackTitle(urlHints: UrlMetadataHints): string {
  switch (urlHints.provider) {
    case 'instagram':
      return urlHints.isVideoOrReel ? 'Inspiración de Instagram Reel' : 'Inspiración de Instagram';
    case 'tiktok':
      return 'Inspiración de TikTok';
    case 'youtube':
      return urlHints.providerLabel.includes('Short') ? 'Inspiración de YouTube Short' : 'Inspiración de YouTube';
    case 'facebook':
      return 'Inspiración de Facebook';
    case 'threads':
      return 'Inspiración de Threads';
    case 'x':
      return 'Inspiración de X';
    case 'spotify':
      return 'Inspiración Musical';
    default:
      return 'Enlace de inspiración';
  }
}

/**
 * Generates a clean card title from user input:
 * 1. Strips out all URLs before attempting any punctuation/newline slicing.
 * 2. If valid text remains, uses the first line/phrase up to `maxLength` without word cutting.
 * 3. If NO text remains (user only pasted a link), returns an appropriate semantic fallback title.
 */
export function generateCleanTitle(content: string, options?: { maxLength?: number }): string {
  const maxLength = options?.maxLength ?? 72;
  if (!content) return '';

  const detectedUrls = extractUrls(content);

  // Remove all detected URLs from the content
  let textWithoutUrls = content.replace(URL_REGEX, ' ');

  // Clean excessive spaces and punctuation artifacts
  textWithoutUrls = textWithoutUrls
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  // If there is meaningful remaining text, derive title from it
  if (textWithoutUrls.length > 0) {
    // Split by newlines or clear sentence terminators, but now safely URL-free
    const firstLine = textWithoutUrls.split(/[\n.!?]/, 1)[0]?.trim() ?? '';
    const candidate = firstLine || textWithoutUrls;

    if (candidate.length <= maxLength) {
      return candidate;
    }

    // Truncate at word boundary
    const sliced = candidate.slice(0, maxLength - 3);
    const lastSpace = sliced.lastIndexOf(' ');
    const boundary = lastSpace > maxLength * 0.6 ? sliced.slice(0, lastSpace) : sliced;
    return `${boundary.trimEnd()}…`;
  }

  // If content was solely a link, use a semantic fallback title
  if (detectedUrls.length > 0) {
    return getSemanticFallbackTitle(detectedUrls[0]);
  }

  return '';
}

/**
 * Splits user text into:
 * 1. Cleaned text (with standalone URLs removed or neatly spaced)
 * 2. An array of detected UrlMetadataHints for rich preview rendering.
 */
export function splitTextAndUrls(rawContent: string): {
  cleanText: string;
  urls: UrlMetadataHints[];
} {
  const urls = extractUrls(rawContent);
  if (urls.length === 0) {
    return { cleanText: rawContent, urls: [] };
  }

  // If the text contains more than just URLs, clean up the text
  let cleanText = rawContent;
  for (const item of urls) {
    // Replace URL occurrences with empty string or clean spacing
    cleanText = cleanText.split(item.originalUrl).join('');
  }

  // Tidy up trailing whitespaces and extra blank lines
  cleanText = cleanText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return { cleanText, urls };
}

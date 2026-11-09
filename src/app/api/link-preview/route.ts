import { NextRequest, NextResponse } from 'next/server';
import {
  cleanUrlTrackingParams,
  extractUrlMetadataHints,
  type SupportedProvider,
} from '@/utils/urlParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface LinkPreviewData {
  url: string;
  cleanUrl: string;
  provider: SupportedProvider;
  providerLabel: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  originalThumbnailUrl: string | null;
  author?: string;
  shortcode?: string;
  isVideoOrReel: boolean;
}

/** Check against local/private network addresses for basic SSRF protection */
function isPrivateOrLocal(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1'
  ) {
    return true;
  }

  // IPv4 regex check for private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
  const parts = lower.split('.');
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b] = parts.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
  }

  return false;
}

/** Extracts content of meta tags with regex */
function extractMeta(html: string, propertyOrName: string): string | null {
  // Matches <meta property="..." content="..."> or <meta name="..." content="..."> or reversed
  const regex1 = new RegExp(
    `<meta[^>]+(?:property|name)=["']${propertyOrName}["'][^>]+content=["']([^"']*)["']`,
    'i',
  );
  const regex2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${propertyOrName}["']`,
    'i',
  );

  const match1 = html.match(regex1);
  if (match1?.[1]) return decodeHtmlEntities(match1[1].trim());

  const match2 = html.match(regex2);
  if (match2?.[1]) return decodeHtmlEntities(match2[1].trim());

  return null;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    .replace(/&#([0-9]{1,7});/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return '';
      }
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, '/');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json(
      { success: false, error: 'Parámetro ?url es requerido.' },
      { status: 400 },
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Protocolo inválido');
    }
    if (isPrivateOrLocal(parsed.hostname)) {
      return NextResponse.json(
        { success: false, error: 'Acceso no permitido a red local.' },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'URL malformada o inválida.' },
      { status: 400 },
    );
  }

  const cleanUrl = cleanUrlTrackingParams(targetUrl);
  const hints = extractUrlMetadataHints(cleanUrl);

  let title = '';
  let description = '';
  let originalThumbnailUrl: string | null = null;
  let author: string | undefined;

  // 1. YouTube specific fast-path
  if (hints.provider === 'youtube' && hints.shortcode) {
    originalThumbnailUrl = `https://img.youtube.com/vi/${hints.shortcode}/hqdefault.jpg`;
  }

  // 2. Layer 1: Fetch with messaging bot User-Agent (WhatsApp / Facebook External Hit)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php) WhatsApp/2.24.12.78 A',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      next: { revalidate: 86400 },
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();

      // Extract title
      title =
        extractMeta(html, 'og:title') ||
        extractMeta(html, 'twitter:title') ||
        '';

      if (!title) {
        const titleTagMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (titleTagMatch?.[1]) {
          title = decodeHtmlEntities(titleTagMatch[1].trim());
        }
      }

      // Extract description
      description =
        extractMeta(html, 'og:description') ||
        extractMeta(html, 'twitter:description') ||
        extractMeta(html, 'description') ||
        '';

      // Extract thumbnail
      if (!originalThumbnailUrl) {
        originalThumbnailUrl =
          extractMeta(html, 'og:image') ||
          extractMeta(html, 'og:image:url') ||
          extractMeta(html, 'twitter:image') ||
          null;
      }

      author = extractMeta(html, 'author') || extractMeta(html, 'og:site_name') || undefined;
    }
  } catch (err) {
    // Graceful fallback to layer 2
  }

  // 3. Layer 2: Fallback to Microlink API or YouTube oEmbed if missing key metadata
  if (!originalThumbnailUrl || !title) {
    try {
      if (hints.provider === 'youtube') {
        const ytOembed = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`,
          { next: { revalidate: 86400 } },
        );
        if (ytOembed.ok) {
          const ytData = await ytOembed.json();
          if (!title) title = ytData.title || '';
          if (!author) author = ytData.author_name || '';
          if (!originalThumbnailUrl && ytData.thumbnail_url) {
            originalThumbnailUrl = ytData.thumbnail_url;
          }
        }
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const microlinkRes = await fetch(
          `https://api.microlink.io/?url=${encodeURIComponent(cleanUrl)}`,
          {
            signal: controller.signal,
            next: { revalidate: 86400 },
          },
        );
        clearTimeout(timeoutId);

        if (microlinkRes.ok) {
          const mData = await microlinkRes.json();
          if (mData.status === 'success' && mData.data) {
            if (!title && mData.data.title) title = mData.data.title;
            if (!description && mData.data.description) description = mData.data.description;
            if (!originalThumbnailUrl && mData.data.image?.url) {
              originalThumbnailUrl = mData.data.image.url;
            }
            if (!author && mData.data.publisher) author = mData.data.publisher;
          }
        }
      }
    } catch {
      // Continue with whatever metadata was gathered
    }
  }

  // Fallback defaults if title is still empty
  if (!title) {
    title = hints.providerLabel;
  }

  // Proxy the thumbnail through our anti-CORS image endpoint
  let proxiedThumbnailUrl: string | null = null;
  if (originalThumbnailUrl) {
    // If it's already an absolute safe URL
    proxiedThumbnailUrl = `/api/link-preview/image?url=${encodeURIComponent(originalThumbnailUrl)}`;
  }

  const responseData: LinkPreviewData = {
    url: targetUrl,
    cleanUrl,
    provider: hints.provider,
    providerLabel: hints.providerLabel,
    title,
    description,
    thumbnailUrl: proxiedThumbnailUrl,
    originalThumbnailUrl,
    author,
    shortcode: hints.shortcode,
    isVideoOrReel: hints.isVideoOrReel,
  };

  return NextResponse.json(
    { success: true, data: responseData },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}

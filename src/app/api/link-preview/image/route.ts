import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const parts = lower.split('.');
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b] = parts.map(Number);
    if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      return true;
    }
  }
  return false;
}

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" fill="none">
  <rect width="160" height="160" fill="#E8E4DA"/>
  <circle cx="80" cy="80" r="32" fill="#D3CCC0"/>
  <path d="M72 68L94 80L72 92V68Z" fill="#756F64"/>
</svg>`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse(FALLBACK_SVG, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' },
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Protocolo inválido');
    }
    if (isPrivateOrLocal(parsed.hostname)) {
      return new NextResponse(FALLBACK_SVG, {
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' },
      });
    }
  } catch {
    return new NextResponse(FALLBACK_SVG, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' },
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    // Instagram and other CDNs check Referer and User-Agent
    const referer = parsed.hostname.includes('cdninstagram.com') || parsed.hostname.includes('instagram.com')
      ? 'https://www.instagram.com/'
      : parsed.hostname.includes('tiktok')
        ? 'https://www.tiktok.com/'
        : undefined;

    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        ...(referer ? { Referer: referer } : {}),
      },
      next: { revalidate: 86400 },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return new NextResponse(FALLBACK_SVG, {
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' },
      });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    return new NextResponse(FALLBACK_SVG, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' },
    });
  }
}

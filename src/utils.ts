export interface ParsedUrl {
  type: 'video' | 'channel' | 'playlist' | 'shorts' | 'unknown';
  videoId?: string;
  channelId?: string;
  playlistId?: string;
  handle?: string;
  timestamp?: number;
}

export function parseYouTubeUrl(input: string): ParsedUrl {
  const trimmed = input.trim();

  // If it looks like a bare video ID (11 chars, alphanumeric + - _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { type: 'video', videoId: trimmed };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { type: 'unknown' };
  }

  const hostname = url.hostname.replace('www.', '').replace('m.', '');
  const pathname = url.pathname;
  const params = url.searchParams;

  // youtu.be short links
  if (hostname === 'youtu.be') {
    const videoId = pathname.slice(1).split('/')[0];
    const t = params.get('t');
    return {
      type: 'video',
      videoId: videoId || undefined,
      timestamp: t ? parseTimestamp(t) : undefined
    };
  }

  if (hostname !== 'youtube.com' && hostname !== 'youtube-nocookie.com') {
    return { type: 'unknown' };
  }

  // /watch?v=VIDEO_ID
  if (pathname === '/watch') {
    const videoId = params.get('v') || undefined;
    const t = params.get('t');
    const list = params.get('list') || undefined;
    return {
      type: 'video',
      videoId,
      playlistId: list,
      timestamp: t ? parseTimestamp(t) : undefined
    };
  }

  // /shorts/VIDEO_ID
  if (pathname.startsWith('/shorts/')) {
    const videoId = pathname.split('/')[2];
    return { type: 'shorts', videoId: videoId || undefined };
  }

  // /embed/VIDEO_ID
  if (pathname.startsWith('/embed/')) {
    const videoId = pathname.split('/')[2];
    const t = params.get('start');
    return {
      type: 'video',
      videoId: videoId || undefined,
      timestamp: t ? parseInt(t, 10) : undefined
    };
  }

  // /playlist?list=PLAYLIST_ID
  if (pathname === '/playlist') {
    return { type: 'playlist', playlistId: params.get('list') || undefined };
  }

  // /channel/CHANNEL_ID
  if (pathname.startsWith('/channel/')) {
    const channelId = pathname.split('/')[2];
    return { type: 'channel', channelId: channelId || undefined };
  }

  // /@handle
  if (pathname.startsWith('/@')) {
    const handle = pathname.split('/')[1];
    return { type: 'channel', handle: handle || undefined };
  }

  // /c/CUSTOM_NAME or /user/USERNAME
  if (pathname.startsWith('/c/') || pathname.startsWith('/user/')) {
    const handle = pathname.split('/')[2];
    return { type: 'channel', handle: handle ? `@${handle}` : undefined };
  }

  return { type: 'unknown' };
}

function parseTimestamp(t: string): number {
  // Handle "123s" or "123" format
  const secMatch = t.match(/^(\d+)s?$/);
  if (secMatch) return parseInt(secMatch[1], 10);

  // Handle "1h2m3s" format
  let seconds = 0;
  const hMatch = t.match(/(\d+)h/);
  const mMatch = t.match(/(\d+)m/);
  const sMatch = t.match(/(\d+)s/);
  if (hMatch) seconds += parseInt(hMatch[1], 10) * 3600;
  if (mMatch) seconds += parseInt(mMatch[1], 10) * 60;
  if (sMatch) seconds += parseInt(sMatch[1], 10);
  return seconds;
}

export function extractVideoId(input: string): string | undefined {
  return parseYouTubeUrl(input).videoId;
}

export function extractChaptersFromDescription(description: string): Array<{
  title: string;
  startSeconds: number;
  timestamp: string;
}> {
  const chapters: Array<{ title: string; startSeconds: number; timestamp: string }> = [];
  const lines = description.split('\n');

  // Match lines like "0:00 Introduction" or "1:23:45 - Advanced Topics"
  const timestampRegex = /^(?:\s*)(\d{1,2}:(?:\d{2}:)?\d{2})\s*[-–—]?\s*(.+)$/;
  // Also match "Introduction 0:00" (timestamp at end)
  const timestampEndRegex = /^(?:\s*)(.+?)\s+(\d{1,2}:(?:\d{2}:)?\d{2})\s*$/;

  for (const line of lines) {
    let match = line.match(timestampRegex);
    if (match) {
      const timestamp = match[1];
      const title = match[2].trim();
      if (title) {
        chapters.push({
          title,
          startSeconds: timestampToSeconds(timestamp),
          timestamp
        });
      }
      continue;
    }

    match = line.match(timestampEndRegex);
    if (match) {
      const title = match[1].trim();
      const timestamp = match[2];
      if (title && !title.match(/^\d/)) {
        chapters.push({
          title,
          startSeconds: timestampToSeconds(timestamp),
          timestamp
        });
      }
    }
  }

  // Only return if we found at least 2 chapters (single timestamp isn't chapters)
  if (chapters.length < 2) return [];

  // Sort by start time
  chapters.sort((a, b) => a.startSeconds - b.startSeconds);
  return chapters;
}

function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parts[0] * 60 + parts[1];
}

export function formatDuration(isoDuration: string): string {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return isoDuration;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

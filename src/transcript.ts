import { SPONSORBLOCK_API_BASE } from './config.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36,gzip(gfe)';
const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const INNERTUBE_CLIENT_VERSION = '20.10.38';
const INNERTUBE_CONTEXT = { client: { clientName: 'ANDROID', clientVersion: INNERTUBE_CLIENT_VERSION } };
const ANDROID_USER_AGENT = `com.google.android.youtube/${INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`;

export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

export interface SponsorBlockSegment {
  segment: [number, number];
  category: string;
  actionType: string;
}

export async function fetchTranscript(
  videoId: string,
  lang?: string
): Promise<TranscriptSegment[]> {
  const language = lang || 'en';

  // Try InnerTube API first
  const innerTubeResult = await fetchViaInnerTube(videoId, language);
  if (innerTubeResult) return innerTubeResult;

  // Fall back to web page scraping
  return fetchViaWebPage(videoId, language);
}

async function fetchViaInnerTube(videoId: string, lang: string): Promise<TranscriptSegment[] | null> {
  try {
    const response = await fetch(INNERTUBE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': ANDROID_USER_AGENT },
      body: JSON.stringify({ context: INNERTUBE_CONTEXT, videoId })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    return fetchFromTracks(tracks, videoId, lang);
  } catch {
    return null;
  }
}

async function fetchViaWebPage(videoId: string, lang: string): Promise<TranscriptSegment[]> {
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'Accept-Language': lang, 'User-Agent': USER_AGENT }
  });

  const html = await response.text();

  if (html.includes('class="g-recaptcha"')) {
    throw new Error('YouTube is requiring a CAPTCHA. Too many requests from this IP.');
  }
  if (!html.includes('"playabilityStatus":')) {
    throw new Error(`Video not available: ${videoId}`);
  }

  const playerResponse = parseInlineJson(html, 'ytInitialPlayerResponse');
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error(`Transcripts are disabled for this video (${videoId}).`);
  }

  return fetchFromTracks(tracks, videoId, lang);
}

function parseInlineJson(html: string, varName: string): any {
  const prefix = `var ${varName} = `;
  const start = html.indexOf(prefix);
  if (start === -1) return null;

  const jsonStart = start + prefix.length;
  let depth = 0;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(html.slice(jsonStart, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

async function fetchFromTracks(
  tracks: Array<{ languageCode: string; baseUrl: string }>,
  videoId: string,
  lang: string
): Promise<TranscriptSegment[]> {
  const track = tracks.find(t => t.languageCode === lang) || tracks[0];

  if (!track?.baseUrl) {
    const available = tracks.map(t => t.languageCode).join(', ');
    throw new Error(`No transcript for "${lang}" on video ${videoId}. Available: ${available}`);
  }

  const response = await fetch(track.baseUrl, {
    headers: { 'Accept-Language': lang, 'User-Agent': USER_AGENT }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch transcript for video ${videoId}.`);
  }

  const xml = await response.text();
  return parseTranscriptXml(xml);
}

function parseTranscriptXml(xml: string): TranscriptSegment[] {
  // Try new format: <p t="ms" d="ms">text</p>
  const newFormat = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  const segments: TranscriptSegment[] = [];
  let match;

  while ((match = newFormat.exec(xml)) !== null) {
    const offset = parseInt(match[1], 10);
    const duration = parseInt(match[2], 10);
    let text = match[3];

    // Extract text from <s> tags if present
    const sTags = /<s[^>]*>([^<]*)<\/s>/g;
    let sText = '';
    let sMatch;
    while ((sMatch = sTags.exec(text)) !== null) sText += sMatch[1];
    if (sText) text = sText;
    else text = text.replace(/<[^>]+>/g, '');

    text = decodeEntities(text).trim();
    if (text) segments.push({ text, offset, duration });
  }

  if (segments.length > 0) return segments;

  // Fall back to old format: <text start="sec" dur="sec">text</text>
  const oldFormat = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
  while ((match = oldFormat.exec(xml)) !== null) {
    segments.push({
      text: decodeEntities(match[3]),
      duration: parseFloat(match[2]) * 1000,
      offset: parseFloat(match[1]) * 1000
    });
  }

  return segments;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

export function searchTranscript(
  segments: TranscriptSegment[],
  query: string
): Array<{ text: string; timestamp: string; offsetMs: number }> {
  const lowerQuery = query.toLowerCase();
  const results: Array<{ text: string; timestamp: string; offsetMs: number }> = [];

  for (let i = 0; i < segments.length; i++) {
    if (segments[i].text.toLowerCase().includes(lowerQuery)) {
      // Include surrounding context (1 segment before and after)
      const contextParts: string[] = [];
      if (i > 0) contextParts.push(segments[i - 1].text);
      contextParts.push(`**${segments[i].text}**`);
      if (i < segments.length - 1) contextParts.push(segments[i + 1].text);

      results.push({
        text: contextParts.join(' '),
        timestamp: formatMs(segments[i].offset),
        offsetMs: segments[i].offset
      });
    }
  }

  return results;
}

export function concatenateTranscript(segments: TranscriptSegment[]): string {
  return segments.map(s => s.text).join(' ');
}

export async function fetchSponsorBlockSegments(
  videoId: string
): Promise<SponsorBlockSegment[]> {
  const categories = JSON.stringify([
    'sponsor', 'intro', 'outro', 'selfpromo', 'interaction', 'music_offtopic', 'filler'
  ]);

  const url = `${SPONSORBLOCK_API_BASE}/skipSegments?videoID=${videoId}&categories=${encodeURIComponent(categories)}`;

  const response = await fetch(url);
  if (response.status === 404) {
    return []; // No segments found
  }
  if (!response.ok) {
    return []; // Fail silently — SponsorBlock is optional
  }

  return response.json();
}

export function cleanTranscript(
  segments: TranscriptSegment[],
  sponsorSegments: SponsorBlockSegment[]
): { cleanSegments: TranscriptSegment[]; removedCategories: string[] } {
  if (sponsorSegments.length === 0) {
    return { cleanSegments: segments, removedCategories: [] };
  }

  const removedCategories = new Set<string>();
  const cleanSegments = segments.filter(seg => {
    const segStartSec = seg.offset / 1000;
    const segEndSec = (seg.offset + seg.duration) / 1000;

    for (const sb of sponsorSegments) {
      const [sbStart, sbEnd] = sb.segment;
      // If the transcript segment overlaps with a sponsor segment, remove it
      if (segStartSec >= sbStart && segEndSec <= sbEnd) {
        removedCategories.add(sb.category);
        return false;
      }
      // If the midpoint of the transcript segment falls within the sponsor segment
      const midpoint = (segStartSec + segEndSec) / 2;
      if (midpoint >= sbStart && midpoint <= sbEnd) {
        removedCategories.add(sb.category);
        return false;
      }
    }
    return true;
  });

  return { cleanSegments, removedCategories: [...removedCategories] };
}

export async function fetchMostReplayed(videoId: string): Promise<{
  heatmap: Array<{ startMs: number; endMs: number; intensity: number }>;
  peaks: Array<{ startMs: number; endMs: number; intensity: number; timestamp: string }>;
} | null> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Try current format: "markers":[{"startMillis":"0","durationMillis":"6600","intensityScoreNormalized":0.3}]
    const markersMatch = html.match(/"markers":\s*(\[\{"startMillis".*?\}\])/s);
    if (markersMatch) {
      try {
        const markers: Array<{
          startMillis: string;
          durationMillis: string;
          intensityScoreNormalized: number;
        }> = JSON.parse(markersMatch[1]);

        if (markers.length > 0) {
          const heatmap = markers.map(m => {
            const startMs = parseInt(m.startMillis, 10);
            const durationMs = parseInt(m.durationMillis, 10);
            return {
              startMs,
              endMs: startMs + durationMs,
              intensity: m.intensityScoreNormalized
            };
          });

          const sorted = [...heatmap].sort((a, b) => b.intensity - a.intensity);
          const peaks = sorted.slice(0, 5).map(p => ({
            ...p,
            timestamp: formatMs(p.startMs)
          }));

          return { heatmap, peaks };
        }
      } catch { /* fall through */ }
    }

    // Try legacy format: "heatMarkers":[{"heatMarkerRenderer":{...}}]
    const legacyMatch = html.match(/heatMarkers":\s*(\[.*?\])/s);
    if (legacyMatch) {
      try {
        const markers: Array<{
          heatMarkerRenderer: {
            timeRangeStartMillis: number;
            markerDurationMillis: number;
            heatMarkerIntensityScoreNormalized: number;
          };
        }> = JSON.parse(legacyMatch[1]);

        if (markers.length > 0) {
          const heatmap = markers.map(m => ({
            startMs: m.heatMarkerRenderer.timeRangeStartMillis,
            endMs: m.heatMarkerRenderer.timeRangeStartMillis + m.heatMarkerRenderer.markerDurationMillis,
            intensity: m.heatMarkerRenderer.heatMarkerIntensityScoreNormalized
          }));

          const sorted = [...heatmap].sort((a, b) => b.intensity - a.intensity);
          const peaks = sorted.slice(0, 5).map(p => ({
            ...p,
            timestamp: formatMs(p.startMs)
          }));

          return { heatmap, peaks };
        }
      } catch { /* fall through */ }
    }

    return null;
  } catch {
    return null;
  }
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

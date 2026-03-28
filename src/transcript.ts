import { YoutubeTranscript } from 'youtube-transcript';
import { SPONSORBLOCK_API_BASE } from './config.js';

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
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: lang || 'en'
    });

    return items.map(item => ({
      text: item.text,
      offset: item.offset,
      duration: item.duration
    }));
  } catch (error: any) {
    if (error.message?.includes('disabled')) {
      throw new Error('Transcripts are disabled for this video.');
    }
    if (error.message?.includes('No transcript')) {
      throw new Error(
        `No transcript found for language "${lang || 'en'}". Try a different language code.`
      );
    }
    throw new Error(`Failed to fetch transcript: ${error.message}`);
  }
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
  // Use the YouTube Innertube API to get heatmap data
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Extract heatmap data from the page
    const heatmapMatch = html.match(/heatMarkers":\s*(\[.*?\])/s);
    if (!heatmapMatch) return null;

    let markers: Array<{
      heatMarkerRenderer: {
        timeRangeStartMillis: number;
        markerDurationMillis: number;
        heatMarkerIntensityScoreNormalized: number;
      };
    }>;

    try {
      markers = JSON.parse(heatmapMatch[1]);
    } catch {
      return null;
    }

    if (!markers || markers.length === 0) return null;

    const heatmap = markers.map(m => ({
      startMs: m.heatMarkerRenderer.timeRangeStartMillis,
      endMs: m.heatMarkerRenderer.timeRangeStartMillis + m.heatMarkerRenderer.markerDurationMillis,
      intensity: m.heatMarkerRenderer.heatMarkerIntensityScoreNormalized
    }));

    // Find top 5 peaks
    const sorted = [...heatmap].sort((a, b) => b.intensity - a.intensity);
    const peaks = sorted.slice(0, 5).map(p => ({
      ...p,
      timestamp: formatMs(p.startMs)
    }));

    return { heatmap, peaks };
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

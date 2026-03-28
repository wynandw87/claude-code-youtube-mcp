export interface Config {
  apiKey: string;
  timeout: number;
}

export function loadConfig(): Config {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'YouTube API key not configured. Please set the YOUTUBE_API_KEY environment variable.'
    );
  }

  const timeoutStr = process.env.YOUTUBE_TIMEOUT;
  const timeout = timeoutStr ? parseInt(timeoutStr, 10) : 30000;

  if (timeout <= 0) {
    throw new Error('YOUTUBE_TIMEOUT must be a positive number');
  }

  return { apiKey, timeout };
}

export const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
export const SPONSORBLOCK_API_BASE = 'https://sponsor.ajay.app/api';

import { Config, YOUTUBE_API_BASE } from './config.js';
import { formatDuration, formatNumber } from './utils.js';

export class YouTubeClient {
  private apiKey: string;
  private timeout: number;

  constructor(config: Config) {
    this.apiKey = config.apiKey;
    this.timeout = config.timeout;
  }

  private async request(endpoint: string, params: Record<string, string>): Promise<any> {
    const query = new URLSearchParams({ ...params, key: this.apiKey });
    const url = `${YOUTUBE_API_BASE}/${endpoint}?${query}`;

    const response = await Promise.race([
      fetch(url),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('YouTube API request timed out')), this.timeout)
      )
    ]);

    if (!response.ok) {
      const body = await response.text();
      throw this.handleApiError(response.status, body);
    }

    return response.json();
  }

  private handleApiError(status: number, body: string): Error {
    if (status === 401 || status === 403) {
      if (body.includes('quotaExceeded')) {
        return new Error('YouTube API quota exceeded. Try again tomorrow or use a different API key.');
      }
      return new Error('Invalid YouTube API key. Please check your YOUTUBE_API_KEY environment variable.');
    }
    if (status === 404) {
      return new Error('Resource not found on YouTube.');
    }
    if (status === 429) {
      return new Error('YouTube API rate limit exceeded. Please wait and try again.');
    }
    return new Error(`YouTube API error (${status}): ${body}`);
  }

  async searchVideos(options: {
    query: string;
    maxResults?: number;
    order?: string;
    duration?: string;
    uploadDate?: string;
    type?: string;
    channelId?: string;
  }): Promise<any> {
    const params: Record<string, string> = {
      part: 'snippet',
      q: options.query,
      maxResults: String(options.maxResults || 10),
      order: options.order || 'relevance',
      type: options.type || 'video'
    };

    if (options.channelId) params.channelId = options.channelId;
    if (options.duration) params.videoDuration = options.duration;

    if (options.uploadDate) {
      const now = new Date();
      let publishedAfter: Date;
      switch (options.uploadDate) {
        case 'hour': publishedAfter = new Date(now.getTime() - 3600000); break;
        case 'day': publishedAfter = new Date(now.getTime() - 86400000); break;
        case 'week': publishedAfter = new Date(now.getTime() - 604800000); break;
        case 'month': publishedAfter = new Date(now.getTime() - 2592000000); break;
        case 'year': publishedAfter = new Date(now.getTime() - 31536000000); break;
        default: publishedAfter = new Date(0);
      }
      params.publishedAfter = publishedAfter.toISOString();
    }

    const data = await this.request('search', params);

    return data.items.map((item: any) => ({
      videoId: item.id?.videoId || item.id?.playlistId || item.id?.channelId,
      type: item.id?.kind?.split('#')[1] || 'video',
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url
    }));
  }

  async getVideoMetadata(videoId: string): Promise<any> {
    const data = await this.request('videos', {
      part: 'snippet,contentDetails,statistics,status',
      id: videoId
    });

    if (!data.items || data.items.length === 0) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const item = data.items[0];
    const snippet = item.snippet;
    const stats = item.statistics;
    const details = item.contentDetails;

    return {
      videoId,
      title: snippet.title,
      description: snippet.description,
      channelTitle: snippet.channelTitle,
      channelId: snippet.channelId,
      publishedAt: snippet.publishedAt,
      tags: snippet.tags || [],
      categoryId: snippet.categoryId,
      duration: formatDuration(details.duration),
      durationRaw: details.duration,
      definition: details.definition,
      viewCount: parseInt(stats.viewCount || '0', 10),
      likeCount: parseInt(stats.likeCount || '0', 10),
      commentCount: parseInt(stats.commentCount || '0', 10),
      viewCountFormatted: formatNumber(parseInt(stats.viewCount || '0', 10)),
      likeCountFormatted: formatNumber(parseInt(stats.likeCount || '0', 10)),
      thumbnails: snippet.thumbnails,
      isLive: snippet.liveBroadcastContent === 'live',
      madeForKids: item.status?.madeForKids || false
    };
  }

  async getChannelInfo(channelIdOrHandle: string): Promise<any> {
    let params: Record<string, string>;

    if (channelIdOrHandle.startsWith('@')) {
      params = { part: 'snippet,statistics,brandingSettings', forHandle: channelIdOrHandle };
    } else if (channelIdOrHandle.startsWith('UC')) {
      params = { part: 'snippet,statistics,brandingSettings', id: channelIdOrHandle };
    } else {
      // Try as a username
      params = { part: 'snippet,statistics,brandingSettings', forUsername: channelIdOrHandle };
    }

    const data = await this.request('channels', params);

    if (!data.items || data.items.length === 0) {
      throw new Error(`Channel not found: ${channelIdOrHandle}`);
    }

    const item = data.items[0];
    const snippet = item.snippet;
    const stats = item.statistics;

    return {
      channelId: item.id,
      title: snippet.title,
      description: snippet.description,
      customUrl: snippet.customUrl,
      publishedAt: snippet.publishedAt,
      country: snippet.country,
      subscriberCount: parseInt(stats.subscriberCount || '0', 10),
      videoCount: parseInt(stats.videoCount || '0', 10),
      viewCount: parseInt(stats.viewCount || '0', 10),
      subscriberCountFormatted: formatNumber(parseInt(stats.subscriberCount || '0', 10)),
      viewCountFormatted: formatNumber(parseInt(stats.viewCount || '0', 10)),
      thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url
    };
  }

  async getPlaylistItems(playlistId: string, maxResults: number = 25): Promise<any> {
    // Get playlist metadata
    const playlistData = await this.request('playlists', {
      part: 'snippet,contentDetails',
      id: playlistId
    });

    const playlistMeta = playlistData.items?.[0];

    // Get playlist items
    const data = await this.request('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: String(Math.min(maxResults, 50))
    });

    const items = data.items.map((item: any, index: number) => ({
      position: item.snippet.position ?? index,
      videoId: item.contentDetails.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.videoOwnerChannelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url
    }));

    return {
      playlistId,
      title: playlistMeta?.snippet?.title || 'Unknown Playlist',
      description: playlistMeta?.snippet?.description || '',
      channelTitle: playlistMeta?.snippet?.channelTitle || '',
      itemCount: playlistMeta?.contentDetails?.itemCount || items.length,
      items
    };
  }

  async getChannelVideos(channelId: string, maxResults: number = 25, order: string = 'date'): Promise<any[]> {
    // Get the channel's uploads playlist
    const channelData = await this.request('channels', {
      part: 'contentDetails',
      id: channelId
    });

    if (!channelData.items || channelData.items.length === 0) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    if (order === 'viewCount') {
      // Use search API for sorting by view count (uploads playlist is always chronological)
      return this.searchVideos({ query: '', channelId, maxResults, order: 'viewCount' });
    }

    // Use playlistItems for chronological order (cheaper API quota)
    const data = await this.request('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(maxResults, 50))
    });

    return data.items.map((item: any) => ({
      videoId: item.contentDetails.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url
    }));
  }

  async getTrendingVideos(regionCode: string = 'US', categoryId?: string, maxResults: number = 10): Promise<any[]> {
    const params: Record<string, string> = {
      part: 'snippet,statistics,contentDetails',
      chart: 'mostPopular',
      regionCode,
      maxResults: String(Math.min(maxResults, 50))
    };

    if (categoryId) params.videoCategoryId = categoryId;

    const data = await this.request('videos', params);

    return data.items.map((item: any) => ({
      videoId: item.id,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      duration: formatDuration(item.contentDetails.duration),
      viewCount: parseInt(item.statistics.viewCount || '0', 10),
      likeCount: parseInt(item.statistics.likeCount || '0', 10),
      viewCountFormatted: formatNumber(parseInt(item.statistics.viewCount || '0', 10)),
      thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url
    }));
  }

  async getVideoComments(videoId: string, maxResults: number = 20, order: string = 'relevance'): Promise<any[]> {
    const data = await this.request('commentThreads', {
      part: 'snippet',
      videoId,
      maxResults: String(Math.min(maxResults, 100)),
      order,
      textFormat: 'plainText'
    });

    return data.items.map((item: any) => {
      const comment = item.snippet.topLevelComment.snippet;
      return {
        author: comment.authorDisplayName,
        text: comment.textDisplay,
        likeCount: comment.likeCount,
        replyCount: item.snippet.totalReplyCount,
        publishedAt: comment.publishedAt,
        updatedAt: comment.updatedAt
      };
    });
  }

  async calculateEngagement(videoId: string): Promise<any> {
    const metadata = await this.getVideoMetadata(videoId);
    const views = metadata.viewCount;
    const likes = metadata.likeCount;
    const comments = metadata.commentCount;

    const likeRate = views > 0 ? (likes / views) * 100 : 0;
    const commentRate = views > 0 ? (comments / views) * 100 : 0;
    const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

    return {
      videoId,
      title: metadata.title,
      viewCount: views,
      likeCount: likes,
      commentCount: comments,
      likeRate: `${likeRate.toFixed(4)}%`,
      commentRate: `${commentRate.toFixed(4)}%`,
      engagementRate: `${engagementRate.toFixed(4)}%`,
      likeRateNumeric: likeRate,
      commentRateNumeric: commentRate,
      engagementRateNumeric: engagementRate
    };
  }

  async resolveChannelId(handleOrId: string): Promise<string> {
    if (handleOrId.startsWith('UC')) return handleOrId;

    const info = await this.getChannelInfo(handleOrId);
    return info.channelId;
  }
}

export function createYouTubeClient(config: Config): YouTubeClient {
  return new YouTubeClient(config);
}

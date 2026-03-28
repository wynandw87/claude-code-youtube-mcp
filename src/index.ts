#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { loadConfig } from './config.js';
import { createYouTubeClient } from './youtube-client.js';
import {
  fetchTranscript,
  searchTranscript,
  concatenateTranscript,
  fetchSponsorBlockSegments,
  cleanTranscript,
  fetchMostReplayed
} from './transcript.js';
import {
  parseYouTubeUrl,
  extractVideoId,
  extractChaptersFromDescription
} from './utils.js';

async function main() {
  try {
    const config = loadConfig();
    const client = createYouTubeClient(config);

    const server = new Server(
      {
        name: 'youtube-mcp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // ── Tool Definitions ──────────────────────────────────────────────

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'parse_youtube_url',
            description: 'Parse any YouTube URL format and extract video ID, channel ID, playlist ID, handle, and timestamp. Supports youtube.com/watch, youtu.be, /shorts/, /embed/, /playlist, /channel/, /@handle, and bare video IDs.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Any YouTube URL or video ID'
                }
              },
              required: ['url']
            }
          },
          {
            name: 'get_transcript',
            description: 'Fetch the full transcript/captions of a YouTube video with timestamps. Returns both individual segments with timing and the full concatenated text. No API key needed.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'YouTube video URL or video ID'
                },
                lang: {
                  type: 'string',
                  description: 'Language code for captions (default: "en")'
                }
              },
              required: ['url']
            }
          },
          {
            name: 'search_transcript',
            description: 'Search within a YouTube video\'s transcript for a keyword or phrase. Returns matching segments with timestamps and surrounding context.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'YouTube video URL or video ID'
                },
                query: {
                  type: 'string',
                  description: 'Keyword or phrase to search for in the transcript'
                },
                lang: {
                  type: 'string',
                  description: 'Language code for captions (default: "en")'
                }
              },
              required: ['url', 'query']
            }
          },
          {
            name: 'extract_chapters',
            description: 'Extract chapter timestamps from a YouTube video\'s description. Returns structured chapter list with titles and start times.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'YouTube video URL or video ID'
                }
              },
              required: ['url']
            }
          },
          {
            name: 'get_clean_transcript',
            description: 'Fetch a YouTube video transcript with sponsor reads, intros, outros, self-promotion, and filler removed using SponsorBlock data. Ideal for summarization.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'YouTube video URL or video ID'
                },
                lang: {
                  type: 'string',
                  description: 'Language code for captions (default: "en")'
                }
              },
              required: ['url']
            }
          },
          {
            name: 'get_most_replayed',
            description: 'Get the "most replayed" heatmap data for a YouTube video, showing which parts viewers rewatch most. Returns intensity scores and top peaks with timestamps. Requires 50K+ views.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'YouTube video URL or video ID'
                }
              },
              required: ['url']
            }
          },
          {
            name: 'search_videos',
            description: 'Search YouTube for videos with full filter support: upload date, duration, sort order, and content type.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query'
                },
                max_results: {
                  type: 'number',
                  description: 'Number of results (1-50, default: 10)'
                },
                order: {
                  type: 'string',
                  enum: ['relevance', 'date', 'viewCount', 'rating'],
                  description: 'Sort order (default: relevance)'
                },
                duration: {
                  type: 'string',
                  enum: ['short', 'medium', 'long'],
                  description: 'Filter by duration: short (<4min), medium (4-20min), long (>20min)'
                },
                upload_date: {
                  type: 'string',
                  enum: ['hour', 'day', 'week', 'month', 'year'],
                  description: 'Filter by upload date'
                },
                type: {
                  type: 'string',
                  enum: ['video', 'channel', 'playlist'],
                  description: 'Result type (default: video)'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'get_video_metadata',
            description: 'Get detailed metadata for a YouTube video: title, description, channel, duration, view/like/comment counts, tags, category, thumbnails, and more.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'YouTube video URL or video ID'
                }
              },
              required: ['url']
            }
          },
          {
            name: 'get_channel_info',
            description: 'Get YouTube channel information: title, description, subscriber/video/view counts, country, and thumbnail. Accepts channel URL, @handle, or channel ID.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'YouTube channel URL, @handle, or channel ID'
                }
              },
              required: ['url']
            }
          },
          {
            name: 'get_playlist_items',
            description: 'Get all videos in a YouTube playlist with metadata. Returns playlist info and video list with titles, channels, and positions.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'YouTube playlist URL or playlist ID'
                },
                max_results: {
                  type: 'number',
                  description: 'Number of items to return (1-50, default: 25)'
                }
              },
              required: ['url']
            }
          },
          {
            name: 'get_channel_videos',
            description: 'Get recent videos from a YouTube channel. Supports sorting by date or view count.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'YouTube channel URL, @handle, or channel ID'
                },
                max_results: {
                  type: 'number',
                  description: 'Number of videos to return (1-50, default: 25)'
                },
                order: {
                  type: 'string',
                  enum: ['date', 'viewCount'],
                  description: 'Sort order (default: date)'
                }
              },
              required: ['url']
            }
          },
          {
            name: 'get_trending_videos',
            description: 'Get currently trending/popular YouTube videos by region and category.',
            inputSchema: {
              type: 'object',
              properties: {
                region_code: {
                  type: 'string',
                  description: 'ISO 3166-1 alpha-2 country code (default: "US")'
                },
                category_id: {
                  type: 'string',
                  description: 'YouTube video category ID (e.g., "10" for Music, "20" for Gaming, "28" for Science & Tech)'
                },
                max_results: {
                  type: 'number',
                  description: 'Number of results (1-50, default: 10)'
                }
              },
              required: []
            }
          },
          {
            name: 'search_within_channel',
            description: 'Search for videos within a specific YouTube channel.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'YouTube channel URL, @handle, or channel ID'
                },
                query: {
                  type: 'string',
                  description: 'Search query'
                },
                max_results: {
                  type: 'number',
                  description: 'Number of results (1-50, default: 10)'
                }
              },
              required: ['url', 'query']
            }
          },
          {
            name: 'get_video_comments',
            description: 'Fetch top-level comments from a YouTube video. Returns author, text, like count, reply count, and publish date.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'YouTube video URL or video ID'
                },
                max_results: {
                  type: 'number',
                  description: 'Number of comments (1-100, default: 20)'
                },
                order: {
                  type: 'string',
                  enum: ['relevance', 'time'],
                  description: 'Sort order (default: relevance)'
                }
              },
              required: ['url']
            }
          },
          {
            name: 'calculate_engagement',
            description: 'Calculate engagement metrics for a YouTube video: like rate, comment rate, and overall engagement rate based on view count.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'YouTube video URL or video ID'
                }
              },
              required: ['url']
            }
          }
        ]
      };
    });

    // ── Tool Handlers ─────────────────────────────────────────────────

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {

          // ── parse_youtube_url ──────────────────────────────────────

          case 'parse_youtube_url': {
            const schema = z.object({
              url: z.string().min(1)
            });
            const input = schema.parse(args);
            const parsed = parseYouTubeUrl(input.url);

            return {
              content: [{ type: 'text', text: JSON.stringify(parsed, null, 2) }]
            };
          }

          // ── get_transcript ────────────────────────────────────────

          case 'get_transcript': {
            const schema = z.object({
              url: z.string().min(1),
              lang: z.string().optional()
            });
            const input = schema.parse(args);
            const videoId = extractVideoId(input.url);
            if (!videoId) {
              return {
                content: [{ type: 'text', text: 'Could not extract video ID from the provided URL.' }],
                isError: true
              };
            }

            const segments = await fetchTranscript(videoId, input.lang);
            const fullText = concatenateTranscript(segments);

            const result = {
              videoId,
              language: input.lang || 'en',
              segmentCount: segments.length,
              segments: segments.map(s => ({
                text: s.text,
                timestamp: formatMs(s.offset),
                offsetMs: s.offset,
                durationMs: s.duration
              })),
              fullText
            };

            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };
          }

          // ── search_transcript ─────────────────────────────────────

          case 'search_transcript': {
            const schema = z.object({
              url: z.string().min(1),
              query: z.string().min(1),
              lang: z.string().optional()
            });
            const input = schema.parse(args);
            const videoId = extractVideoId(input.url);
            if (!videoId) {
              return {
                content: [{ type: 'text', text: 'Could not extract video ID from the provided URL.' }],
                isError: true
              };
            }

            const segments = await fetchTranscript(videoId, input.lang);
            const matches = searchTranscript(segments, input.query);

            const result = {
              videoId,
              query: input.query,
              matchCount: matches.length,
              matches
            };

            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };
          }

          // ── extract_chapters ──────────────────────────────────────

          case 'extract_chapters': {
            const schema = z.object({
              url: z.string().min(1)
            });
            const input = schema.parse(args);
            const videoId = extractVideoId(input.url);
            if (!videoId) {
              return {
                content: [{ type: 'text', text: 'Could not extract video ID from the provided URL.' }],
                isError: true
              };
            }

            const metadata = await client.getVideoMetadata(videoId);
            const chapters = extractChaptersFromDescription(metadata.description);

            if (chapters.length === 0) {
              return {
                content: [{ type: 'text', text: `No chapters found in the description of "${metadata.title}".` }]
              };
            }

            const result = {
              videoId,
              title: metadata.title,
              chapterCount: chapters.length,
              chapters
            };

            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };
          }

          // ── get_clean_transcript ──────────────────────────────────

          case 'get_clean_transcript': {
            const schema = z.object({
              url: z.string().min(1),
              lang: z.string().optional()
            });
            const input = schema.parse(args);
            const videoId = extractVideoId(input.url);
            if (!videoId) {
              return {
                content: [{ type: 'text', text: 'Could not extract video ID from the provided URL.' }],
                isError: true
              };
            }

            const [segments, sponsorSegments] = await Promise.all([
              fetchTranscript(videoId, input.lang),
              fetchSponsorBlockSegments(videoId)
            ]);

            const { cleanSegments, removedCategories } = cleanTranscript(segments, sponsorSegments);
            const fullText = concatenateTranscript(cleanSegments);

            const result = {
              videoId,
              language: input.lang || 'en',
              originalSegmentCount: segments.length,
              cleanSegmentCount: cleanSegments.length,
              removedSegmentCount: segments.length - cleanSegments.length,
              removedCategories,
              sponsorBlockSegments: sponsorSegments.length,
              fullText
            };

            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };
          }

          // ── get_most_replayed ─────────────────────────────────────

          case 'get_most_replayed': {
            const schema = z.object({
              url: z.string().min(1)
            });
            const input = schema.parse(args);
            const videoId = extractVideoId(input.url);
            if (!videoId) {
              return {
                content: [{ type: 'text', text: 'Could not extract video ID from the provided URL.' }],
                isError: true
              };
            }

            const data = await fetchMostReplayed(videoId);

            if (!data) {
              return {
                content: [{ type: 'text', text: 'No heatmap data available for this video. The video may have fewer than 50K views or heatmap data is not available.' }]
              };
            }

            const result = {
              videoId,
              totalSegments: data.heatmap.length,
              peaks: data.peaks,
              heatmap: data.heatmap
            };

            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };
          }

          // ── search_videos ─────────────────────────────────────────

          case 'search_videos': {
            const schema = z.object({
              query: z.string().min(1),
              max_results: z.number().min(1).max(50).optional(),
              order: z.enum(['relevance', 'date', 'viewCount', 'rating']).optional(),
              duration: z.enum(['short', 'medium', 'long']).optional(),
              upload_date: z.enum(['hour', 'day', 'week', 'month', 'year']).optional(),
              type: z.enum(['video', 'channel', 'playlist']).optional()
            });
            const input = schema.parse(args);
            const results = await client.searchVideos({
              query: input.query,
              maxResults: input.max_results,
              order: input.order,
              duration: input.duration,
              uploadDate: input.upload_date,
              type: input.type
            });

            return {
              content: [{ type: 'text', text: JSON.stringify({ query: input.query, resultCount: results.length, results }, null, 2) }]
            };
          }

          // ── get_video_metadata ────────────────────────────────────

          case 'get_video_metadata': {
            const schema = z.object({
              url: z.string().min(1)
            });
            const input = schema.parse(args);
            const videoId = extractVideoId(input.url);
            if (!videoId) {
              return {
                content: [{ type: 'text', text: 'Could not extract video ID from the provided URL.' }],
                isError: true
              };
            }

            const metadata = await client.getVideoMetadata(videoId);

            return {
              content: [{ type: 'text', text: JSON.stringify(metadata, null, 2) }]
            };
          }

          // ── get_channel_info ──────────────────────────────────────

          case 'get_channel_info': {
            const schema = z.object({
              url: z.string().min(1)
            });
            const input = schema.parse(args);
            const parsed = parseYouTubeUrl(input.url);

            let channelIdOrHandle: string;
            if (parsed.channelId) {
              channelIdOrHandle = parsed.channelId;
            } else if (parsed.handle) {
              channelIdOrHandle = parsed.handle;
            } else if (input.url.startsWith('@') || input.url.startsWith('UC')) {
              channelIdOrHandle = input.url;
            } else {
              return {
                content: [{ type: 'text', text: 'Could not extract channel identifier from the provided URL. Use a channel URL, @handle, or channel ID.' }],
                isError: true
              };
            }

            const info = await client.getChannelInfo(channelIdOrHandle);

            return {
              content: [{ type: 'text', text: JSON.stringify(info, null, 2) }]
            };
          }

          // ── get_playlist_items ────────────────────────────────────

          case 'get_playlist_items': {
            const schema = z.object({
              url: z.string().min(1),
              max_results: z.number().min(1).max(50).optional()
            });
            const input = schema.parse(args);
            const parsed = parseYouTubeUrl(input.url);

            const playlistId = parsed.playlistId || input.url;
            if (!playlistId || playlistId.length < 2) {
              return {
                content: [{ type: 'text', text: 'Could not extract playlist ID from the provided URL.' }],
                isError: true
              };
            }

            const result = await client.getPlaylistItems(playlistId, input.max_results);

            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };
          }

          // ── get_channel_videos ────────────────────────────────────

          case 'get_channel_videos': {
            const schema = z.object({
              url: z.string().min(1),
              max_results: z.number().min(1).max(50).optional(),
              order: z.enum(['date', 'viewCount']).optional()
            });
            const input = schema.parse(args);
            const parsed = parseYouTubeUrl(input.url);

            let channelId: string;
            if (parsed.channelId) {
              channelId = parsed.channelId;
            } else if (parsed.handle || input.url.startsWith('@')) {
              channelId = await client.resolveChannelId(parsed.handle || input.url);
            } else if (input.url.startsWith('UC')) {
              channelId = input.url;
            } else {
              return {
                content: [{ type: 'text', text: 'Could not extract channel identifier from the provided URL.' }],
                isError: true
              };
            }

            const videos = await client.getChannelVideos(channelId, input.max_results, input.order);

            return {
              content: [{ type: 'text', text: JSON.stringify({ channelId, videoCount: videos.length, videos }, null, 2) }]
            };
          }

          // ── get_trending_videos ───────────────────────────────────

          case 'get_trending_videos': {
            const schema = z.object({
              region_code: z.string().length(2).optional(),
              category_id: z.string().optional(),
              max_results: z.number().min(1).max(50).optional()
            });
            const input = schema.parse(args);
            const videos = await client.getTrendingVideos(
              input.region_code,
              input.category_id,
              input.max_results
            );

            return {
              content: [{ type: 'text', text: JSON.stringify({ regionCode: input.region_code || 'US', videoCount: videos.length, videos }, null, 2) }]
            };
          }

          // ── search_within_channel ─────────────────────────────────

          case 'search_within_channel': {
            const schema = z.object({
              url: z.string().min(1),
              query: z.string().min(1),
              max_results: z.number().min(1).max(50).optional()
            });
            const input = schema.parse(args);
            const parsed = parseYouTubeUrl(input.url);

            let channelId: string;
            if (parsed.channelId) {
              channelId = parsed.channelId;
            } else if (parsed.handle || input.url.startsWith('@')) {
              channelId = await client.resolveChannelId(parsed.handle || input.url);
            } else if (input.url.startsWith('UC')) {
              channelId = input.url;
            } else {
              return {
                content: [{ type: 'text', text: 'Could not extract channel identifier from the provided URL.' }],
                isError: true
              };
            }

            const results = await client.searchVideos({
              query: input.query,
              channelId,
              maxResults: input.max_results
            });

            return {
              content: [{ type: 'text', text: JSON.stringify({ channelId, query: input.query, resultCount: results.length, results }, null, 2) }]
            };
          }

          // ── get_video_comments ────────────────────────────────────

          case 'get_video_comments': {
            const schema = z.object({
              url: z.string().min(1),
              max_results: z.number().min(1).max(100).optional(),
              order: z.enum(['relevance', 'time']).optional()
            });
            const input = schema.parse(args);
            const videoId = extractVideoId(input.url);
            if (!videoId) {
              return {
                content: [{ type: 'text', text: 'Could not extract video ID from the provided URL.' }],
                isError: true
              };
            }

            const comments = await client.getVideoComments(
              videoId,
              input.max_results,
              input.order
            );

            return {
              content: [{ type: 'text', text: JSON.stringify({ videoId, commentCount: comments.length, comments }, null, 2) }]
            };
          }

          // ── calculate_engagement ──────────────────────────────────

          case 'calculate_engagement': {
            const schema = z.object({
              url: z.string().min(1)
            });
            const input = schema.parse(args);
            const videoId = extractVideoId(input.url);
            if (!videoId) {
              return {
                content: [{ type: 'text', text: 'Could not extract video ID from the provided URL.' }],
                isError: true
              };
            }

            const engagement = await client.calculateEngagement(videoId);

            return {
              content: [{ type: 'text', text: JSON.stringify(engagement, null, 2) }]
            };
          }

          // ── Unknown tool ──────────────────────────────────────────

          default:
            return {
              content: [{ type: 'text', text: `Unknown tool: ${name}` }],
              isError: true
            };
        }
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: error.message || 'An error occurred' }],
          isError: true
        };
      }
    });

    // ── Start Server ────────────────────────────────────────────────

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('YouTube MCP Server v1.0.0 running');

    process.on('SIGINT', async () => {
      console.error('Shutting down YouTube MCP Server...');
      await server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('Shutting down YouTube MCP Server...');
      await server.close();
      process.exit(0);
    });
  } catch (error: any) {
    console.error('Failed to start YouTube MCP Server:', error.message);
    process.exit(1);
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

main().catch(console.error);

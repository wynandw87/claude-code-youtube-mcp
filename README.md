# YouTube MCP Server

MCP server that brings YouTube to Claude Code — video transcripts, search, metadata, channel info, playlists, comments, trending videos, engagement analytics, chapter extraction, SponsorBlock integration, and most-replayed heatmaps. Uses the YouTube Data API v3, youtube-transcript, and SponsorBlock.

## Quick Start

### Step 1: Get Your API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project (or select an existing one)
3. Enable the **YouTube Data API v3**:
   - Go to [API Library](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
   - Click **Enable**
4. Create an API key:
   - Go to [Credentials](https://console.cloud.google.com/apis/credentials)
   - Click **Create Credentials** > **API key**
5. Copy the key (you'll need it in Step 3)

### Step 2: Install Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Claude Code CLI** - [Installation guide](https://docs.anthropic.com/claude-code)

### Step 3: Install the MCP Server

#### 3.1 Clone the repository

```text
git clone https://github.com/wynandw87/claude-code-youtube-mcp.git
cd claude-code-youtube-mcp
```

#### 3.2 Install dependencies

**macOS / Linux / Windows:**
```text
npm install
```

> **Note:** Dependencies are installed and the server is built automatically in one step.

#### 3.3 Register with Claude Code

Choose your install scope:

| Scope | Flag | Who can use it |
|-------|------|----------------|
| **User** (recommended) | `-s user` | You, in any project |
| **Project** | `-s project` | Anyone who clones this repo |
| **Local** | `-s local` | Only in current directory |

Replace `YOUR_API_KEY` with your actual YouTube Data API key, and use the full path to `dist/index.js`.

> **Tip:** To get the full path, run this from the cloned directory:
> - macOS/Linux: `echo "$(pwd)/dist/index.js"`
> - Windows: `echo %cd%\dist\index.js`

**macOS / Linux:**
```text
claude mcp add -s user youtube -e YOUTUBE_API_KEY=YOUR_API_KEY -- node /full/path/to/dist/index.js
```

**Windows (CMD):**
```text
claude mcp add -s user youtube -e "YOUTUBE_API_KEY=YOUR_API_KEY" -- node "C:\full\path\to\dist\index.js"
```

**Windows (PowerShell):**
```text
claude mcp add -s user youtube -e "YOUTUBE_API_KEY=YOUR_API_KEY" '--' node "C:\full\path\to\dist\index.js"
```

#### Alternative: Use the npm helper (if API key is set in environment)

```text
export YOUTUBE_API_KEY=YOUR_API_KEY
npm run install:claude
```

### Step 4: Restart Claude Code

Close and reopen Claude Code for the changes to take effect.

### Step 5: Verify Installation

```text
claude mcp list
```

You should see `youtube` listed with a Connected status.

---

## Features

### Transcripts & Captions
- **Get Transcript** (`get_transcript`) - Fetch full video transcripts with timestamps, supports multiple languages
- **Search Transcript** (`search_transcript`) - Find where a keyword or phrase appears in a video with timestamps
- **Clean Transcript** (`get_clean_transcript`) - Transcript with sponsors, intros, outros, and filler removed via SponsorBlock
- **Extract Chapters** (`extract_chapters`) - Parse chapter timestamps from video descriptions

### Search & Discovery
- **Search Videos** (`search_videos`) - Full YouTube search with filters for date, duration, type, and sort order
- **Search Within Channel** (`search_within_channel`) - Search for videos from a specific creator
- **Get Trending Videos** (`get_trending_videos`) - Currently trending videos by region and category
- **Get Channel Videos** (`get_channel_videos`) - Recent uploads from a channel, sorted by date or views

### Video & Channel Info
- **Video Metadata** (`get_video_metadata`) - Title, description, duration, views, likes, tags, and more
- **Channel Info** (`get_channel_info`) - Subscriber count, video count, description, country
- **Playlist Items** (`get_playlist_items`) - All videos in a playlist with positions and metadata

### Analytics & Engagement
- **Calculate Engagement** (`calculate_engagement`) - Like rate, comment rate, and engagement rate from public stats
- **Most Replayed** (`get_most_replayed`) - Heatmap data showing which parts viewers rewatch most
- **Video Comments** (`get_video_comments`) - Top comments with like counts and reply counts

### Utilities
- **Parse YouTube URL** (`parse_youtube_url`) - Extract video/channel/playlist IDs from any YouTube URL format

---

## Usage

Once installed, use trigger phrases to invoke YouTube tools:

| Trigger | Tool | Example |
|---------|------|---------|
| `youtube transcript` | Get Transcript | "get the youtube transcript for this video" |
| `youtube search` | Search Videos | "youtube search for React tutorials" |
| `youtube metadata` | Video Metadata | "get youtube metadata for this video" |
| `youtube channel` | Channel Info | "get youtube channel info for @ThePrimeagen" |
| `youtube playlist` | Playlist Items | "list the videos in this youtube playlist" |
| `youtube comments` | Video Comments | "get youtube comments for this video" |
| `youtube trending` | Trending Videos | "what's trending on youtube in the US?" |
| `youtube chapters` | Extract Chapters | "extract chapters from this youtube video" |
| `youtube engagement` | Calculate Engagement | "calculate youtube engagement for this video" |
| `youtube most replayed` | Most Replayed | "show the most replayed parts of this youtube video" |
| `youtube clean transcript` | Clean Transcript | "get a clean youtube transcript without sponsors" |
| `youtube search transcript` | Search Transcript | "search the youtube transcript for 'authentication'" |

Or ask naturally:

- *"Get the transcript of this YouTube video and summarize it"*
- *"What are the most replayed parts of this video?"*
- *"Find recent videos about TypeScript on this channel"*
- *"How many views and likes does this video have?"*
- *"Get the comments on this video and summarize the sentiment"*
- *"Show me the chapters for this tutorial"*
- *"Get a clean transcript without the sponsor reads"*
- *"What's trending on YouTube in gaming right now?"*

---

## Tool Reference

### parse_youtube_url

Parse any YouTube URL format and extract identifiers. No API key needed.

**Parameters:**
- `url` (string, required) - Any YouTube URL or video ID

**Supported formats:** `youtube.com/watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, `/playlist?list=`, `/channel/`, `/@handle`, `/c/`, `/user/`, bare video IDs

### get_transcript

Fetch the full transcript/captions of a YouTube video. No API key needed.

**Parameters:**
- `url` (string, required) - YouTube video URL or video ID
- `lang` (string, optional) - Language code for captions (default: `"en"`)

### search_transcript

Search within a video's transcript for a keyword or phrase.

**Parameters:**
- `url` (string, required) - YouTube video URL or video ID
- `query` (string, required) - Keyword or phrase to search for
- `lang` (string, optional) - Language code for captions (default: `"en"`)

### extract_chapters

Extract chapter timestamps from a video's description.

**Parameters:**
- `url` (string, required) - YouTube video URL or video ID

### get_clean_transcript

Fetch transcript with sponsor reads, intros, outros, and filler removed via SponsorBlock.

**Parameters:**
- `url` (string, required) - YouTube video URL or video ID
- `lang` (string, optional) - Language code for captions (default: `"en"`)

### get_most_replayed

Get the "most replayed" heatmap data showing which parts viewers rewatch most.

**Parameters:**
- `url` (string, required) - YouTube video URL or video ID

> **Note:** Requires approximately 50K+ views to have heatmap data available.

### search_videos

Search YouTube with full filter support.

**Parameters:**
- `query` (string, required) - Search query
- `max_results` (number, optional) - Number of results, 1-50 (default: `10`)
- `order` (string, optional) - `"relevance"`, `"date"`, `"viewCount"`, `"rating"` (default: `"relevance"`)
- `duration` (string, optional) - `"short"` (<4min), `"medium"` (4-20min), `"long"` (>20min)
- `upload_date` (string, optional) - `"hour"`, `"day"`, `"week"`, `"month"`, `"year"`
- `type` (string, optional) - `"video"`, `"channel"`, `"playlist"` (default: `"video"`)

### get_video_metadata

Get detailed metadata for a YouTube video.

**Parameters:**
- `url` (string, required) - YouTube video URL or video ID

**Returns:** Title, description, channel, duration, view/like/comment counts, tags, category, thumbnails, live status, and more.

### get_channel_info

Get YouTube channel information.

**Parameters:**
- `url` (string, required) - YouTube channel URL, @handle, or channel ID

**Returns:** Title, description, subscriber/video/view counts, country, custom URL, and thumbnail.

### get_playlist_items

Get all videos in a YouTube playlist.

**Parameters:**
- `url` (string, required) - YouTube playlist URL or playlist ID
- `max_results` (number, optional) - Number of items, 1-50 (default: `25`)

### get_channel_videos

Get recent videos from a YouTube channel.

**Parameters:**
- `url` (string, required) - YouTube channel URL, @handle, or channel ID
- `max_results` (number, optional) - Number of videos, 1-50 (default: `25`)
- `order` (string, optional) - `"date"`, `"viewCount"` (default: `"date"`)

### get_trending_videos

Get currently trending/popular YouTube videos.

**Parameters:**
- `region_code` (string, optional) - ISO 3166-1 alpha-2 country code (default: `"US"`)
- `category_id` (string, optional) - YouTube category ID (e.g., `"10"` for Music, `"20"` for Gaming, `"28"` for Science & Tech)
- `max_results` (number, optional) - Number of results, 1-50 (default: `10`)

### search_within_channel

Search for videos within a specific YouTube channel.

**Parameters:**
- `url` (string, required) - YouTube channel URL, @handle, or channel ID
- `query` (string, required) - Search query
- `max_results` (number, optional) - Number of results, 1-50 (default: `10`)

### get_video_comments

Fetch top-level comments from a YouTube video.

**Parameters:**
- `url` (string, required) - YouTube video URL or video ID
- `max_results` (number, optional) - Number of comments, 1-100 (default: `20`)
- `order` (string, optional) - `"relevance"`, `"time"` (default: `"relevance"`)

### calculate_engagement

Calculate engagement metrics for a YouTube video.

**Parameters:**
- `url` (string, required) - YouTube video URL or video ID

**Returns:** View count, like count, comment count, like rate, comment rate, and overall engagement rate.

---

## How It Works

This MCP server connects to Claude Code via stdio transport and provides 15 tools:

| Tool | Data Source | Needs API Key? |
|------|------------|----------------|
| `parse_youtube_url` | Local parsing | No |
| `get_transcript` | youtube-transcript library | No |
| `search_transcript` | youtube-transcript library | No |
| `get_clean_transcript` | youtube-transcript + SponsorBlock API | No |
| `get_most_replayed` | YouTube page (Innertube) | No |
| `extract_chapters` | YouTube Data API v3 | Yes |
| `search_videos` | YouTube Data API v3 | Yes |
| `get_video_metadata` | YouTube Data API v3 | Yes |
| `get_channel_info` | YouTube Data API v3 | Yes |
| `get_playlist_items` | YouTube Data API v3 | Yes |
| `get_channel_videos` | YouTube Data API v3 | Yes |
| `get_trending_videos` | YouTube Data API v3 | Yes |
| `search_within_channel` | YouTube Data API v3 | Yes |
| `get_video_comments` | YouTube Data API v3 | Yes |
| `calculate_engagement` | YouTube Data API v3 | Yes |

> **Note:** 5 tools work without an API key (transcripts, SponsorBlock, heatmaps, URL parsing). The remaining 10 require a YouTube Data API v3 key.

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `YOUTUBE_API_KEY` | Yes | — | YouTube Data API v3 key |
| `YOUTUBE_TIMEOUT` | No | `30000` | API timeout in ms |

### YouTube API Quota

The YouTube Data API v3 has a daily quota of **10,000 units**. Each tool uses a different amount:

| Operation | Cost per call |
|-----------|--------------|
| `search` (search_videos, search_within_channel) | 100 units |
| `videos.list` (get_video_metadata, get_trending, calculate_engagement) | 1 unit |
| `channels.list` (get_channel_info, get_channel_videos) | 1 unit |
| `playlists.list` (get_playlist_items) | 1 unit |
| `playlistItems.list` (get_playlist_items, get_channel_videos) | 1 unit |
| `commentThreads.list` (get_video_comments) | 1 unit |

> **Tip:** Search operations are the most expensive. Use `get_channel_videos` (1 unit) instead of `search_within_channel` (100 units) when you just need recent uploads.

---

## Troubleshooting

### Fix API Key

If you entered the wrong API key, remove and reinstall:

```text
claude mcp remove youtube
```

Then reinstall using the command from Step 3.3 above (use the same scope you originally installed with).

### MCP Server Not Showing Up

Check if the server is installed:

```text
claude mcp list
```

If not listed, follow Step 3 to install it.

### Server Won't Start

1. **Verify your API key** is valid at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

2. **Check the YouTube Data API is enabled**:
   - Go to [API Library](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
   - It should say "Enabled"

3. **Check Node.js version** (needs 18+):
   ```text
   node --version
   ```

4. **Ensure the server was built** — if `dist/index.js` is missing, run `npm install` again

### Connection Errors

1. **Check that `dist/index.js` exists** — if not, run `npm install`
2. **Verify the path is absolute** in your `claude mcp add` command
3. **Restart Claude Code** after any configuration changes

### Quota Exceeded

If you see "quotaExceeded" errors:
- Wait until midnight Pacific Time (quota resets daily)
- Use a different API key
- Prefer low-cost tools (`get_video_metadata` at 1 unit) over search tools (100 units)

### Transcript Not Available

Some videos have transcripts disabled. The `get_transcript` tool will return a clear error message. Try:
- A different language code (e.g., `lang: "es"`)
- Auto-generated captions may be available even if manual ones aren't

### Timeout Errors

Increase `YOUTUBE_TIMEOUT` environment variable for slow connections:
```text
claude mcp add -s user youtube -e YOUTUBE_API_KEY=YOUR_KEY -e YOUTUBE_TIMEOUT=60000 -- node /path/to/dist/index.js
```

### View Current Configuration

```text
claude mcp list
```

---

## Contributing

Pull requests welcome! Please keep it simple and beginner-friendly.

## License

MIT

---

Made for the Claude Code community

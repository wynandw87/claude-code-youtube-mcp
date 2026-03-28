#!/usr/bin/env node

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  YouTube MCP Server v1.0.0                   ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Setup Instructions:                                         ║
║                                                              ║
║  1. Get a YouTube Data API v3 key:                           ║
║     https://console.cloud.google.com/apis/credentials        ║
║                                                              ║
║  2. Set your API key:                                        ║
║     export YOUTUBE_API_KEY=your_api_key_here                 ║
║                                                              ║
║  3. Add to Claude Code:                                      ║
║     claude mcp add youtube-mcp -- node /path/to/dist/index.js║
║                                                              ║
║  Or run: npm run install:claude                              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

#!/usr/bin/env node

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = resolve(__dirname, '..', 'dist', 'index.js');

const apiKey = process.env.YOUTUBE_API_KEY;

if (!apiKey) {
  console.error('Error: YOUTUBE_API_KEY environment variable is not set.');
  console.error('Please set it before running this script:');
  console.error('  export YOUTUBE_API_KEY=your_api_key_here');
  process.exit(1);
}

try {
  const cmd = `claude mcp add youtube-mcp -e YOUTUBE_API_KEY=${apiKey} -- node ${distPath}`;
  console.log('Adding YouTube MCP server to Claude Code...');
  execSync(cmd, { stdio: 'inherit' });
  console.log('YouTube MCP server added successfully!');
} catch (error) {
  console.error('Failed to add MCP server. You can add it manually:');
  console.error(`  claude mcp add youtube-mcp -e YOUTUBE_API_KEY=YOUR_KEY -- node ${distPath}`);
  process.exit(1);
}

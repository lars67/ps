#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PS2Client, configFromEnv } from './client.js';
import { tools } from './tools.js';

const server = new Server(
  { name: 'ps2-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

let client: PS2Client;
try {
  client = new PS2Client(configFromEnv());
} catch (err) {
  process.stderr.write(`[ps2-mcp] Configuration error: ${(err as Error).message}\n`);
  process.exit(1);
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const tool = tools.find((t) => t.name === name);

  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const result = await tool.handler(client, args as Record<string, unknown>);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

process.on('SIGINT', () => {
  client.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  client.disconnect();
  process.exit(0);
});

const transport = new StdioServerTransport();
await server.connect(transport);

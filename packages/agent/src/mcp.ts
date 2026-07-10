import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { loadConfig } from '@fundos/core';

export type MCPProvider = 'exa' | 'apollo' | 'attio';

interface MCPEndpoint {
  url: string;
  headers?: Record<string, string>;
}

/**
 * Hosted MCP server configs, one per provider, keyed off typed env config.
 * A provider without its credential returns null and its features render
 * disabled instead of failing.
 */
function mcpEndpoint(provider: MCPProvider): MCPEndpoint | null {
  const config = loadConfig();
  switch (provider) {
    case 'exa':
      return config.EXA_API_KEY
        ? { url: `https://mcp.exa.ai/mcp?exaApiKey=${encodeURIComponent(config.EXA_API_KEY)}` }
        : null;
    case 'apollo':
      return config.APOLLO_MCP_TOKEN
        ? { url: 'https://mcp.apollo.io/mcp', headers: { authorization: `Bearer ${config.APOLLO_MCP_TOKEN}` } }
        : null;
    case 'attio':
      return config.ATTIO_MCP_TOKEN
        ? { url: 'https://mcp.attio.com/mcp', headers: { authorization: `Bearer ${config.ATTIO_MCP_TOKEN}` } }
        : null;
  }
}

export function isMCPConfigured(provider: MCPProvider): boolean {
  return mcpEndpoint(provider) !== null;
}

/** Connects an MCP client over streamable HTTP; callers must close() it. */
export async function connectMCP(provider: MCPProvider): Promise<MCPClient | null> {
  const endpoint = mcpEndpoint(provider);
  if (!endpoint) return null;
  return createMCPClient({
    transport: { type: 'http', url: endpoint.url, headers: endpoint.headers },
  });
}

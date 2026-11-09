/**
 * Model Context Protocol server configuration and setup
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { SerperClient } from './infrastructure/api/serperClient.js';
import { OpenRouterClient } from './infrastructure/api/openRouterClient.js';
import { OpenRouterAdapter } from './adapters/llm/openRouterAdapter.js';
import { SearchService } from './domain/services/searchService.js';
import { AgentService } from './domain/services/agentService.js';
import { ResearchService } from './domain/services/researchService.js';
import { SearchToolHandler } from './application/tools/handlers/searchToolHandler.js';
import { ResearchToolHandler } from './application/tools/handlers/researchToolHandler.js';
import { searchToolDefinition } from './application/tools/schemas/searchToolSchema.js';
import { researchToolDefinition } from './application/tools/schemas/researchToolSchema.js';
import { ResearchOrchestrator } from './application/orchestration/researchOrchestrator.js';
import { config } from './infrastructure/config/environment.js';

export class SerperSearchServer {
  private server: Server;
  private searchToolHandler: SearchToolHandler;
  private researchToolHandler?: ResearchToolHandler;

  constructor() {
    // Initialize server
    this.server = new Server(
      {
        name: 'serper-search-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize API clients
    const serperClient = new SerperClient();
    const searchService = new SearchService(serperClient);
    this.searchToolHandler = new SearchToolHandler(searchService);

    // Research is optional: search-only installations never initialize an LLM
    // client or research telemetry.
    if (config.openRouterApiKey.trim()) {
      const llmAdapter = new OpenRouterAdapter(new OpenRouterClient());
      const researchOrchestrator = new ResearchOrchestrator(
        new ResearchService(),
        new AgentService(),
        searchService,
        llmAdapter
      );
      this.researchToolHandler = new ResearchToolHandler(researchOrchestrator);
    }

    // Register tool handlers
    this.setupToolHandlers();

    // Set up error handling
    this.setupErrorHandling();
  }

  /**
   * Registers tool handlers with the MCP server
   */
  private setupToolHandlers() {
    // Register tool definitions
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.researchToolHandler
        ? [searchToolDefinition, researchToolDefinition]
        : [searchToolDefinition],
    }));

    // Register tool request handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === searchToolDefinition.name) {
        return this.searchToolHandler.handleSearchRequest(request.params.arguments);
      } 
      else if (request.params.name === researchToolDefinition.name) {
        if (!this.researchToolHandler) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: 'Deep Research requires OPENROUTER_API_KEY. Set it and restart the server to enable this optional tool. Basic search requires only SERPER_API_KEY.',
            }],
          };
        }
        return this.researchToolHandler.handleResearchRequest(request.params.arguments);
      }
      else {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }
    });
  }

  /**
   * Sets up error handling for the server
   */
  private setupErrorHandling() {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Runs the MCP server
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Serper Search MCP server running on stdio');

    // Handle shutdown
    const cleanup = async () => {
      await this.server.close();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}

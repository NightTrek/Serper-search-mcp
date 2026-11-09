/**
 * Orchestrates the research process with an event loop
 */
import { ResearchService } from '../../domain/services/researchService.js';
import { AgentService } from '../../domain/services/agentService.js';
import { SearchService } from '../../domain/services/searchService.js';
import { LLMAdapter } from '../../adapters/llm/llmAdapter.js';
import { MetricsService } from '../../infrastructure/quality/metricsService.js';
import {
  ResearchRequest,
  ResearchState,
  ResearchResult
} from '../../domain/types/research.js';
import { config } from '../../infrastructure/config/environment.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

/**
 * Orchestrates the research process through an event loop
 */
export class ResearchOrchestrator {
  private researchService: ResearchService;
  private agentService: AgentService;
  private searchService: SearchService;
  private llmAdapter: LLMAdapter;
  private createMetrics: () => MetricsService;

  /**
   * Creates a new research orchestrator
   */
  constructor(
    researchService: ResearchService,
    agentService: AgentService,
    searchService: SearchService,
    llmAdapter: LLMAdapter,
    createMetrics: () => MetricsService = () => new MetricsService()
  ) {
    this.researchService = researchService;
    this.agentService = agentService;
    this.searchService = searchService;
    this.llmAdapter = llmAdapter;
    this.createMetrics = createMetrics;
  }

  /**
   * Main method to execute the research process
   */
  async executeResearch(request: ResearchRequest): Promise<ResearchResult> {
    // Validate request
    this.validateRequest(request);

    // Each request owns its operation ID, timing, event queue and cleanup.
    const metrics = this.createMetrics();
    try {
      // Record operation start
      await metrics.recordOperationStart({
        query: request.query,
        queryLength: request.query.length,
        depth: request.depth || 'standard',
        maxSources: request.maxSources || 10
      });

      // Initialize research state
      let state: ResearchState = this.researchService.initializeState(request);
      let iterationCount = 0;
      const maxIterations = this.getMaxIterations(request.depth || 'standard');

      // Begin event loop
      while (state.status !== 'complete' && iterationCount < maxIterations) {
        iterationCount++;

        try {
          // If no queries pending and no subqueries generated yet, generate initial subqueries
          if (state.pendingSubQueries.length === 0 && state.subQueries.length === 0) {
            const startTime = Date.now();
            const subQueries = await this.agentService.generateSubQueries(
              request.query,
              this.llmAdapter,
              request.depth
            );

            await metrics.recordSearchDecomposition({
              count: subQueries.length,
              topics: subQueries.map(sq => sq.query),
              generationTime: Date.now() - startTime
            });

            state = this.researchService.updateStateWithSubQueries(
              state,
              subQueries
            );
            continue;
          }

          // If there are pending queries, execute one
          if (state.pendingSubQueries.length > 0) {
            const query = state.pendingSubQueries[0];
            const searchStartTime = Date.now();
            const results = await this.searchService.performSearch({ query });

            await metrics.recordSearchExecution({
              subQuery: query,
              resultsCount: results.organic?.length || 0,
              searchTime: Date.now() - searchStartTime
            });

            state = this.researchService.updateStateWithResults(state, query, results);
            continue;
          }

          // Get agent decision via LLM, passing depth parameter
          const decision = await this.agentService.makeDecision(state, this.llmAdapter, request.depth);

          if (decision.action === 'search' && decision.query) {
            // Execute search
            const results = await this.searchService.performSearch({ query: decision.query });
            state = this.researchService.updateStateWithResults(state, decision.query, results);
          }
          else if (decision.action === 'generate_subqueries') {
            // Generate new search queries
            const subQueries = await this.agentService.generateSubQueries(
              request.query,
              this.llmAdapter,
              request.depth
            );
            state = this.researchService.updateStateWithSubQueries(
              state,
              subQueries
            );
          }
          else if (decision.action === 'research_complete') {
            // Mark research as complete
            state.status = 'complete';
          }
        } catch (error) {
          console.error(`Error in research iteration ${iterationCount}:`, error);

          // Track error
          const err = error as Error;
          await metrics.recordExecutionIssue({
            stage: this.getCurrentStage(state),
            errorType: err.name || 'UnknownError',
            errorMessage: err.message || 'An unknown error occurred',
            query: request.query
          });

          // If we have some results, proceed with synthesis despite the error
          if (state.searchResults.length > 0) {
            state.status = 'complete';
            break;
          } else {
            throw new McpError(
              ErrorCode.InternalError,
              `Research failed: ${(error as Error).message}`
            );
          }
        }
      }

      // If we hit max iterations, force completion
      if (state.status !== 'complete') {
        state.status = 'complete';
      }

      // Synthesize the final result with appropriate depth
      const synthesisStartTime = Date.now();
      const result = await this.researchService.synthesizeResults(state, this.llmAdapter, request.depth);

      // Record result generation
      await metrics.recordResultGeneration({
        finalSourceCount: result.citations.length,
        synthesisTime: Date.now() - synthesisStartTime,
        resultLength: result.answer.length,
        citationCount: result.citations.length
      });

      // Record operation completion after result metrics
      await metrics.recordOperationCompletion({
        totalSearches: state.searchResults.length,
        totalSubQueries: state.subQueries.length,
        depth: request.depth || 'standard',
        success: true
      });

      return result;
    } finally {
      await metrics.cleanup();
    }
  }

  /**
   * Gets the current stage of research for error tracking
   */
  private getCurrentStage(state: ResearchState): 'initialization' | 'analysis' | 'search' | 'synthesis' {
    if (!state) return 'initialization';
    if (state.searchResults.length === 0) return 'analysis';
    if (state.status !== 'complete') return 'search';
    return 'synthesis';
  }

  /**
   * Validates the research request
   */
  private validateRequest(request: ResearchRequest): void {
    if (!request.query || request.query.trim().length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'Query must be non-empty');
    }

    if (request.depth && !['basic', 'standard', 'deep'].includes(request.depth)) {
      throw new McpError(ErrorCode.InvalidParams, 'Depth must be one of: basic, standard, deep');
    }

    if (request.maxSources && (typeof request.maxSources !== 'number' || request.maxSources < 1)) {
      throw new McpError(ErrorCode.InvalidParams, 'maxSources must be a positive number');
    }
  }

  /**
   * Gets the maximum number of iterations based on research depth
   */
  private getMaxIterations(depth: 'basic' | 'standard' | 'deep'): number {
    return config.researchDepthSettings[depth].maxIterations;
  }
}

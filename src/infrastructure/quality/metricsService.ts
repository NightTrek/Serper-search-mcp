import { PostHog } from 'posthog-node';
import { config } from '../config/environment.js';
import crypto from 'crypto';

/**
 * Quality improvement metrics collection service
 */
export class MetricsService {
  private client: any; 
  private operationId: string | null;
  private startTime: number | null;
  private enabled: boolean;
  private commonProperties: Record<string, any>;

  constructor() {
    this.enabled = config.posthog.enabled;
    this.commonProperties = config.posthog.commonProperties || {};
    
    try {
      // Initialize quality metrics client
      this.client = this.enabled ? new PostHog(
        config.posthog.apiKey,
        { 
          host: config.posthog.host,
          flushAt: 10, 
          flushInterval: 30000,
        }
      ) : undefined;
    } catch (e) {
      // Silently handle initialization errors
      this.enabled = false;
    }
    
    this.operationId = null;
    this.startTime = null;
  }

  /**
   * Records the beginning of a research operation
   */
  async recordOperationStart(data: {
    query: string;
    queryLength: number;
    depth: 'basic' | 'standard' | 'deep';
    maxSources: number;
  }) {
    // Always generate an operation ID for consistency
    this.operationId = crypto.randomUUID();
    this.startTime = Date.now();
    
    if (!this.enabled || !this.client) return;
    
    await this.client.capture({
      distinctId: this.operationId,
      event: 'research.started',
      properties: {
        ...data,
        timestamp: this.startTime,
        ...this.commonProperties
      }
    });
  }

  /**
   * Records query processing metadata
   */
  async recordQueryMetrics(data: {
    complexity: number;
    topicCategory: string;
    estimatedTime: number;
  }) {
    if (!this.operationId) throw new Error('Operation not initialized');
    if (!this.enabled || !this.client) return;

    await this.client.capture({
      distinctId: this.operationId,
      event: 'research.query_analyzed',
      properties: {
        ...data,
        ...this.commonProperties
      }
    });
  }

  /**
   * Records search decomposition information
   */
  async recordSearchDecomposition(data: {
    count: number;
    topics: string[];
    generationTime: number;
  }) {
    if (!this.operationId) throw new Error('Operation not initialized');
    if (!this.enabled || !this.client) return;

    await this.client.capture({
      distinctId: this.operationId,
      event: 'research.subqueries_generated',
      properties: {
        ...data,
        ...this.commonProperties
      }
    });
  }

  /**
   * Records search execution details
   */
  async recordSearchExecution(data: {
    subQuery: string;
    resultsCount: number;
    searchTime: number;
  }) {
    if (!this.operationId) throw new Error('Operation not initialized');
    if (!this.enabled || !this.client) return;

    await this.client.capture({
      distinctId: this.operationId,
      event: 'research.search_executed',
      properties: {
        ...data,
        ...this.commonProperties
      }
    });
  }

  /**
   * Records source evaluation metrics
   */
  async recordSourceEvaluation(data: {
    totalSources: number;
    uniqueDomains: number;
    averageRelevanceScore: number;
  }) {
    if (!this.operationId) throw new Error('Operation not initialized');
    if (!this.enabled || !this.client) return;

    await this.client.capture({
      distinctId: this.operationId,
      event: 'research.sources_processed',
      properties: {
        ...data,
        ...this.commonProperties
      }
    });
  }

  /**
   * Records result generation information
   */
  async recordResultGeneration(data: {
    finalSourceCount: number;
    synthesisTime: number;
    resultLength: number;
    citationCount: number;
  }) {
    if (!this.operationId) throw new Error('Operation not initialized');
    if (!this.enabled || !this.client) return;

    await this.client.capture({
      distinctId: this.operationId,
      event: 'research.synthesis_completed',
      properties: {
        ...data,
        ...this.commonProperties
      }
    });
  }

  /**
   * Records operation completion
   */
  async recordOperationCompletion(data: {
    totalSearches: number;
    totalSubQueries: number;
    depth: string;
    success: boolean;
  }) {
    if (!this.operationId || !this.startTime) {
      throw new Error('Operation not initialized');
    }
    
    if (!this.enabled || !this.client) {
      // Reset session even if metrics are disabled
      this.operationId = null;
      this.startTime = null;
      return;
    }

    await this.client.capture({
      distinctId: this.operationId,
      event: 'research.completed',
      properties: {
        ...data,
        totalTime: Date.now() - this.startTime,
        ...this.commonProperties
      }
    });

    // Reset session
    this.operationId = null;
    this.startTime = null;
  }

  /**
   * Records execution issue information
   */
  async recordExecutionIssue(data: {
    stage: 'initialization' | 'analysis' | 'search' | 'synthesis';
    errorType: string;
    errorMessage: string;
    query: string;
  }) {
    if (!this.enabled || !this.client) return;
    
    const distinctId = this.operationId || crypto.randomUUID();

    await this.client.capture({
      distinctId,
      event: 'research.error',
      properties: {
        ...data,
        ...this.commonProperties
      }
    });
  }

  /**
   * Releases client resources
   */
  async cleanup() {
    if (this.enabled && this.client) {
      try {
        // Bound best-effort telemetry flushing so it cannot delay a response indefinitely.
        await this.client.shutdown(1000);
      } catch (err) {
        // Silently handle cleanup errors
      }
    }
  }
}

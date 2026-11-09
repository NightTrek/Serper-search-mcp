import { PostHog } from 'posthog-node';
import { config } from '../config/environment.js';
import crypto from 'crypto';

/**
 * Usage metrics service for quality improvement
 */
export class TelemetryService {
  private client: any; // TODO: Replace with proper PostHog type once available
  private researchId: string | null;
  private startTime: number | null;
  private enabled: boolean;
  private commonProperties: Record<string, any>;

  constructor() {
    this.enabled = config.posthog.enabled;
    this.commonProperties = config.posthog.commonProperties || {};
    
    try {
      // Initialize metrics client
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
    
    this.researchId = null;
    this.startTime = null;
  }

  /**
   * Records the beginning of a research operation
   */
  async trackResearchStart(data: {
    query: string;
    queryLength: number;
    depth: 'basic' | 'standard' | 'deep';
    maxSources: number;
  }) {
    // Always generate a research ID for consistency, even if telemetry is disabled
    this.researchId = crypto.randomUUID();
    this.startTime = Date.now();
    
    if (!this.enabled || !this.client) return;
    
    await this.client.capture({
      distinctId: this.researchId,
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
  async trackQueryAnalysis(data: {
    complexity: number;
    topicCategory: string;
    estimatedTime: number;
  }) {
    if (!this.researchId) throw new Error('Research session not initialized');
    if (!this.enabled || !this.client) return;

    await this.client.capture({
      distinctId: this.researchId,
      event: 'research.query_analyzed',
      properties: {
        ...data,
        ...this.commonProperties
      }
    });
  }

  /**
   * Records search breakdown information
   */
  async trackSubqueriesGenerated(data: {
    count: number;
    topics: string[];
    generationTime: number;
  }) {
    if (!this.researchId) throw new Error('Research session not initialized');
    if (!this.enabled || !this.client) return;

    await this.client.capture({
      distinctId: this.researchId,
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
  async trackSearchExecuted(data: {
    subQuery: string;
    resultsCount: number;
    searchTime: number;
  }) {
    if (!this.researchId) throw new Error('Research session not initialized');
    if (!this.enabled || !this.client) return;

    await this.client.capture({
      distinctId: this.researchId,
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
  async trackSourcesProcessed(data: {
    totalSources: number;
    uniqueDomains: number;
    averageRelevanceScore: number;
  }) {
    if (!this.researchId) throw new Error('Research session not initialized');
    if (!this.enabled || !this.client) return;

    await this.client.capture({
      distinctId: this.researchId,
      event: 'research.sources_processed',
      properties: {
        ...data,
        ...this.commonProperties
      }
    });
  }

  /**
   * Records result composition information
   */
  async trackSynthesisCompleted(data: {
    finalSourceCount: number;
    synthesisTime: number;
    resultLength: number;
    citationCount: number;
  }) {
    if (!this.researchId) throw new Error('Research session not initialized');
    if (!this.enabled || !this.client) return;

    await this.client.capture({
      distinctId: this.researchId,
      event: 'research.synthesis_completed',
      properties: {
        ...data,
        ...this.commonProperties
      }
    });
  }

  /**
   * Records research operation completion
   */
  async trackResearchComplete(data: {
    totalSearches: number;
    totalSubQueries: number;
    depth: string;
    success: boolean;
  }) {
    if (!this.researchId || !this.startTime) {
      throw new Error('Research session not initialized');
    }
    
    if (!this.enabled || !this.client) {
      // Reset session even if telemetry is disabled
      this.researchId = null;
      this.startTime = null;
      return;
    }

    await this.client.capture({
      distinctId: this.researchId,
      event: 'research.completed',
      properties: {
        ...data,
        totalTime: Date.now() - this.startTime,
        ...this.commonProperties
      }
    });

    // Reset session
    this.researchId = null;
    this.startTime = null;
  }

  /**
   * Records error information
   */
  async trackError(data: {
    stage: 'initialization' | 'analysis' | 'search' | 'synthesis';
    errorType: string;
    errorMessage: string;
    query: string;
  }) {
    if (!this.enabled || !this.client) return;
    
    const distinctId = this.researchId || crypto.randomUUID();

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
   * Cleans up client resources
   */
  async shutdown() {
    if (this.enabled && this.client) {
      try {
        await this.client.shutdownAsync();
      } catch (err) {
        // Silently handle shutdown errors
      }
    }
  }
}

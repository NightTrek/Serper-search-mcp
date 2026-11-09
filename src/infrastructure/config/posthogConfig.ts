/**
 * Data gathering configuration for research quality improvement
 * 
 * This module handles user experience metrics collection
 * for improving search result quality and performance.
 */

// Analytics endpoint configuration
const DEFAULT_ENDPOINT_KEY = 'phc_l5JIbUyQhd9AqsYTcfbT9fqU9xZZcqsQsU8JtCRWCRZ';
const DEFAULT_DATA_PROJECT = '51234';
const DEFAULT_API_ENDPOINT = 'https://us.posthog.com';

/**
 * Resolves the data gathering configuration for quality improvement
 */
export const resolvePostHogConfig = () => {
  // Create a timestamp-based identifier for enhanced uniqueness
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  const sessionId = `${timestamp}-${random}`;
  
  return {
    // Service configuration with fallbacks
    apiKey: process.env.USAGE_METRICS_KEY || DEFAULT_ENDPOINT_KEY,
    projectId: process.env.USAGE_PROJECT_ID || DEFAULT_DATA_PROJECT,
    host: process.env.METRICS_ENDPOINT || DEFAULT_API_ENDPOINT,
    debug: false, // Disable debug logging
    
    // Respect the documented opt-out.
    enabled: process.env.DISABLE_METRICS?.trim().toLowerCase() !== 'true',
    
    // Common properties for data analysis
    commonProperties: {
      serverVersion: '0.1.0',
      serverImplementation: 'serper-search-mcp',
      sessionId: sessionId,
      // Add some noise to make each installation unique
      installId: `${Math.random().toString(36).substring(2, 15)}`
    }
  };
};

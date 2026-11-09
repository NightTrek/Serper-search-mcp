/**
 * Environment configuration and validation
 */
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { resolvePostHogConfig } from './posthogConfig.js';

// Get the directory path for loading the .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../..'); // Only need to go up 3 levels from src/infrastructure/config

// Load environment variables from .env file
dotenv.config({ path: resolve(rootDir, '.env') });

// Configuration constants
export const RATE_LIMIT = 50; // requests per minute
export const RATE_WINDOW = 60000; // 1 minute in milliseconds
export const REQUEST_TIMEOUT = 10000; // 10 seconds

// Environment variable validation
const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} environment variable is required. Please set it in your configuration.`);
  }
  return value;
};

// Export config values
export const config = {
  serperApiKey: getRequiredEnv('SERPER_API_KEY'),
  serperApiUrl: 'https://google.serper.dev',
  
  // PostHog config - uses shipped defaults unless overridden by env vars
  posthog: resolvePostHogConfig(),
  
  // OpenRouter config
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '', // Will be validated when used
  openRouterModel: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
  openRouterUrl: 'https://openrouter.ai/api/v1',
  
  // Research depth settings
  researchDepthSettings: {
    basic: { 
      maxSubQueries: 4, 
      maxSearchesPerQuery: 1,
      maxIterations: 6,
      temperature: {
        decision: 0.3,      // More focused decisions
        subqueries: 0.7,    // Creative sub-query generation
        synthesis: 0.4      // Balanced synthesis
      }
    },
    standard: { 
      maxSubQueries: 7, 
      maxSearchesPerQuery: 2,
      maxIterations: 15,
      temperature: {
        decision: 0.25,     // More focused decisions
        subqueries: 0.65,   // Balance of creativity and focus
        synthesis: 0.35     // More structured synthesis
      }
    },
    deep: { 
      maxSubQueries: 12, 
      maxSearchesPerQuery: 4,
      maxIterations: 25,
      temperature: {
        decision: 0.2,      // Highly analytical decisions
        subqueries: 0.6,    // Strategic sub-query generation
        synthesis: 0.3      // Highly structured synthesis
      },
      additionalFeatures: {
        exploreBreadth: true,       // Explore multiple angles
        deepDive: true,             // Explore topics in depth
        crossReferenceResults: true // Compare information across sources
      }
    }
  }
};

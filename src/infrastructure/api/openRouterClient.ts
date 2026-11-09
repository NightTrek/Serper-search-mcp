/**
 * OpenRouter API client for LLM operations
 */
import axios, { AxiosInstance } from 'axios';
import { config, REQUEST_TIMEOUT } from '../config/environment.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
}

export interface ChatCompletionOptions extends CompletionOptions {
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface ChatResponse {
  id: string;
  model: string;
  choices: {
    message: ChatMessage;
    finishReason: string;
  }[];
}

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export class OpenRouterClient {
  private axiosInstance: AxiosInstance;
  private model: string;

  constructor(openRouterConfig?: OpenRouterConfig) {
    // If no config is provided, use environment config
    const apiKey = openRouterConfig?.apiKey || config.openRouterApiKey;
    this.model = openRouterConfig?.model || config.openRouterModel;
    const baseUrl = openRouterConfig?.baseUrl || config.openRouterUrl;
    
    // Validate API key
    if (!apiKey) {
      throw new Error('OpenRouter API key is required. Please set OPENROUTER_API_KEY in your environment.');
    }
    
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://serper-search-server',
        'X-Title': 'Serper Search Deep Research'
      },
      timeout: REQUEST_TIMEOUT,
    });
  }

  /**
   * Generates a completion from the provided prompt
   */
  async completion(prompt: string, options?: CompletionOptions): Promise<string> {
    try {
      const response = await this.axiosInstance.post('/completions', {
        model: this.model,
        prompt,
        temperature: options?.temperature ?? 0.5,
        max_tokens: options?.maxTokens ?? 1024,
        stop: options?.stop
      });

      const data = response.data;
      if (data && typeof data === 'object' && data.error != null) {
        throw new McpError(ErrorCode.InternalError, 'OpenRouter returned an error response.');
      }
      const text = Array.isArray(data?.choices) ? data.choices[0]?.text : undefined;
      if (typeof text !== 'string' || !text.trim()) {
        throw new McpError(ErrorCode.InternalError, 'OpenRouter returned an invalid completion response: expected a non-empty text choice.');
      }
      return text;
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  /**
   * Generates a chat completion from the provided messages
   */
  async chatCompletion(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<ChatResponse> {
    try {
      const response = await this.axiosInstance.post('/chat/completions', {
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.5,
        max_tokens: options?.maxTokens ?? 1024,
        top_p: options?.topP ?? 0.9,
        frequency_penalty: options?.frequencyPenalty ?? 0,
        presence_penalty: options?.presencePenalty ?? 0,
        stop: options?.stop
      });

      return response.data;
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  /**
   * Handles API errors and transforms them into McpErrors
   */
  private handleApiError(error: unknown): never {
    if (error instanceof McpError) throw error;

    // Never propagate provider bodies or transport messages: they may echo
    // prompts, authorization headers, or other sensitive request details.
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      const message = timedOut
        ? 'OpenRouter API request timed out.'
        : typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599
          ? `OpenRouter API request failed (HTTP ${status}).`
          : 'OpenRouter API request failed. Check connectivity and configuration.';
      throw new McpError(ErrorCode.InternalError, message);
    }

    throw new McpError(ErrorCode.InternalError, 'Unexpected error while requesting an OpenRouter completion.');
  }
}

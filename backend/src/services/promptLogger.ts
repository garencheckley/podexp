import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for logging LLM prompt and response data
 */
export interface LLMPromptLog {
  id: string;
  apiType: 'gemini' | 'perplexity';
  model: string;
  promptText: string;
  responseText: string;
  tokenCount?: number;
  processingTimeMs: number;
  timestamp: string;
  stage: string;
  purpose: string; // e.g., "topic generation", "content synthesis"
  metadata?: Record<string, any>; // Additional metadata like temperature, max tokens, etc.
}

/**
 * Creates a new LLM prompt log entry
 */
export function createPromptLog(
  apiType: 'gemini' | 'perplexity',
  model: string,
  promptText: string,
  stage: string,
  purpose: string,
  metadata?: Record<string, any>
): LLMPromptLog {
  return {
    id: uuidv4(),
    apiType,
    model,
    promptText,
    responseText: '', // Will be filled after API call
    processingTimeMs: 0, // Will be calculated after API call
    timestamp: new Date().toISOString(),
    stage,
    purpose,
    metadata
  };
}

/**
 * Completes a prompt log with response data
 */
export function completePromptLog(
  promptLog: LLMPromptLog,
  responseText: string,
  processingTimeMs: number,
  tokenCount?: number
): LLMPromptLog {
  return {
    ...promptLog,
    responseText,
    processingTimeMs,
    tokenCount
  };
}

/**
 * Sanitizes prompt text for storage (removes sensitive info, truncates if too long)
 */
export function sanitizePromptText(promptText: string, maxLength: number = 10000): string {
  // Remove potential sensitive information patterns
  let sanitized = promptText
    .replace(/api[_-]?key[s]?[\s=:]+[\w-]+/gi, 'API_KEY=***')
    .replace(/token[s]?[\s=:]+[\w-]+/gi, 'TOKEN=***')
    .replace(/password[s]?[\s=:]+[\w-]+/gi, 'PASSWORD=***');
  
  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '\n\n[... truncated for storage ...]';
  }
  
  return sanitized;
}

/**
 * Formats token count from API response metadata
 */
export function extractTokenCount(apiResponse: any, apiType: 'gemini' | 'perplexity'): number | undefined {
  try {
    if (apiType === 'perplexity') {
      return apiResponse?.usage?.total_tokens;
    } else if (apiType === 'gemini') {
      // Gemini token counting may vary based on response structure
      return apiResponse?.usageMetadata?.totalTokenCount || 
             apiResponse?.response?.usageMetadata?.totalTokenCount;
    }
  } catch (error) {
    console.warn('Error extracting token count:', error);
  }
  return undefined;
} 
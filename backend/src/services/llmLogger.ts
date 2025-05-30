import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult } from '@google/generative-ai';
import axios from 'axios';
import { createPromptLog, completePromptLog, sanitizePromptText, extractTokenCount, LLMPromptLog } from './promptLogger';
import { EpisodeGenerationLog, addPromptToStage } from './logService';

// Perplexity API response interface
interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  citations?: string[];
  usage?: {
    total_tokens: number;
  };
}

/**
 * Wrapper service for logging LLM API calls
 */
class LLMLogger {
  private currentLog: EpisodeGenerationLog | null = null;
  private currentStage: keyof EpisodeGenerationLog['stages'] | null = null;

  /**
   * Sets the current generation log context for prompt logging
   */
  setContext(log: EpisodeGenerationLog, stage: keyof EpisodeGenerationLog['stages']) {
    this.currentLog = log;
    this.currentStage = stage;
  }

  /**
   * Clears the current context
   */
  clearContext() {
    this.currentLog = null;
    this.currentStage = null;
  }

  /**
   * Logs a Gemini API call with prompt and response
   */
  async logGeminiCall(
    model: GenerativeModel,
    prompt: string,
    purpose: string,
    metadata?: Record<string, any>
  ): Promise<{ result: GenerateContentResult; promptLog: LLMPromptLog | null }> {
    const startTime = Date.now();
    
    // Create prompt log
    let promptLog: LLMPromptLog | null = null;
    if (this.currentLog && this.currentStage) {
      promptLog = createPromptLog(
        'gemini',
        model.model,
        sanitizePromptText(prompt),
        this.currentStage,
        purpose,
        metadata
      );
    }

    try {
      // Make the API call
      const result = await model.generateContent(prompt);
      const processingTime = Date.now() - startTime;
      const responseText = result.response.text();
      
      // Complete the prompt log
      if (promptLog) {
        const tokenCount = extractTokenCount(result, 'gemini');
        promptLog = completePromptLog(promptLog, responseText, processingTime, tokenCount);
        
        // Add to the current log
        if (this.currentLog && this.currentStage) {
          this.currentLog = addPromptToStage(this.currentLog, this.currentStage, promptLog);
        }
      }

      console.log(`[LLMLogger] Gemini call completed in ${processingTime}ms for ${purpose}`);
      return { result, promptLog };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Log the error in the prompt log
      if (promptLog) {
        promptLog = completePromptLog(
          promptLog, 
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          processingTime
        );
        
        if (this.currentLog && this.currentStage) {
          this.currentLog = addPromptToStage(this.currentLog, this.currentStage, promptLog);
        }
      }
      
      console.error(`[LLMLogger] Gemini call failed after ${processingTime}ms for ${purpose}:`, error);
      throw error;
    }
  }

  /**
   * Logs a Perplexity API call with prompt and response
   */
  async logPerplexityCall(
    prompt: string,
    purpose: string,
    model: string = 'sonar-pro',
    metadata?: Record<string, any>
  ): Promise<{ content: string; sources: string[]; promptLog: LLMPromptLog | null }> {
    const startTime = Date.now();
    
    // Create prompt log
    let promptLog: LLMPromptLog | null = null;
    if (this.currentLog && this.currentStage) {
      promptLog = createPromptLog(
        'perplexity',
        model,
        sanitizePromptText(prompt),
        this.currentStage,
        purpose,
        metadata
      );
    }

    try {
      // Make the Perplexity API call
      const response = await axios.post<PerplexityResponse>(
        'https://api.perplexity.ai/chat/completions',
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: metadata?.max_tokens || 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const processingTime = Date.now() - startTime;
      const responseContent = response.data.choices[0].message.content;
      const sources = response.data.citations || [];
      
      // Complete the prompt log
      if (promptLog) {
        const tokenCount = extractTokenCount(response.data, 'perplexity');
        promptLog = completePromptLog(promptLog, responseContent, processingTime, tokenCount);
        
        // Add to the current log
        if (this.currentLog && this.currentStage) {
          this.currentLog = addPromptToStage(this.currentLog, this.currentStage, promptLog);
        }
      }

      console.log(`[LLMLogger] Perplexity call completed in ${processingTime}ms for ${purpose}`);
      return { content: responseContent, sources, promptLog };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Log the error in the prompt log
      if (promptLog) {
        promptLog = completePromptLog(
          promptLog, 
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          processingTime
        );
        
        if (this.currentLog && this.currentStage) {
          this.currentLog = addPromptToStage(this.currentLog, this.currentStage, promptLog);
        }
      }
      
      console.error(`[LLMLogger] Perplexity call failed after ${processingTime}ms for ${purpose}:`, error);
      throw error;
    }
  }

  /**
   * Returns the current updated log
   */
  getCurrentLog(): EpisodeGenerationLog | null {
    return this.currentLog;
  }
}

// Export a singleton instance
export const llmLogger = new LLMLogger(); 
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Tool, GenerationConfig } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const modelId = 'gemini-2.0-flash'; // Updated to Gemini 2.0 which better supports search
const model = genAI.getGenerativeModel({ model: modelId });

// Configure Google Search tool as per Gemini 2.0 documentation
const googleSearchTool = {
  google_search: {}  // Using google_search as required by the API
};

/**
 * A result from the search process
 */
export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  relevanceScore?: number;
}

/**
 * Interface for the structured search results
 */
export interface SearchResults {
  stories: {
    [key: string]: {
      mainStory: SearchResult;
      additionalContext: SearchResult[];
    }
  };
  sources: string[];
}

/**
 * Executes a search query using Gemini API with Google Search grounding
 * @param query The search query
 * @returns Information retrieved from the search
 */
export async function executeWebSearch(query: string): Promise<{content: string, sources: string[]}> {
  try {
    console.log(`Executing web search for query: "${query}"`);
    
    // Create a model instance with the search tool configured
    const searchModel = genAI.getGenerativeModel({
      model: modelId,
      tools: [googleSearchTool as any], // Type cast to any to bypass TypeScript error
    });

    const result = await searchModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: query }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000,
      }
    });

    const responseText = result.response.text();
    
    // Extract sources from grounding metadata
    let sources: string[] = [];
    try {
      // With Gemini 2.0, grounding metadata is structured differently
      const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
      
      if (groundingMetadata && groundingMetadata.groundingChunks && groundingMetadata.groundingChunks.length > 0) {
        // Extract URLs from grounding chunks
        sources = groundingMetadata.groundingChunks
          .filter((chunk: any) => chunk.web && chunk.web.uri)
          .map((chunk: any) => chunk.web.uri);
      }
      
      // If no structured grounding metadata, try falling back to older methods
      if (sources.length === 0) {
        const citations = result.response.candidates?.[0]?.citationMetadata;
        if (citations) {
          sources = extractUrisFromCitations(citations);
        }
      }
      
      console.log(`Found ${sources.length} sources for query "${query}"`);
    } catch (error) {
      console.error('Error extracting sources:', error);
    }

    return {
      content: responseText,
      sources: sources
    };
  } catch (error) {
    console.error('Error executing web search:', error);
    return {
      content: `Failed to retrieve information for query: "${query}"`,
      sources: []
    };
  }
}

/**
 * Helper function to extract URIs from citation metadata
 * This handles different possible structures of the citation metadata
 */
function extractUrisFromCitations(citationMetadata: any): string[] {
  try {
    // Try different possible structures
    if (Array.isArray(citationMetadata.citations)) {
      return citationMetadata.citations
        .map((citation: any) => citation.uri || citation.url || '')
        .filter((uri: string) => uri && uri.length > 0);
    }
    
    // Alternative ways the citations might be structured
    if (citationMetadata.citationSources && Array.isArray(citationMetadata.citationSources)) {
      return citationMetadata.citationSources
        .map((source: any) => source.uri || source.url || '')
        .filter((uri: string) => uri && uri.length > 0);
    }
    
    return [];
  } catch (e) {
    console.error('Error extracting URIs from citations:', e);
    return [];
  }
}

/**
 * Performs a simple direct search for podcast content generation
 * This is a simplified replacement for the more complex multi-stage search
 * 
 * @param prompt The podcast prompt
 * @returns Search results and sources for podcast generation
 */
export async function conductSimpleSearch(
  prompt: string
): Promise<{content: string, sources: string[]}> {
  try {
    console.log('Starting simple search process for prompt:', prompt);
    
    // Create an enhanced search query by adding relevant terms
    const searchQuery = `latest news about ${prompt} ${getCurrentMonthYear()}`;
    console.log('Using search query:', searchQuery);
    
    // Execute a single search with the enhanced query
    const searchResult = await executeWebSearch(searchQuery);
    console.log('Simple search completed successfully');
    
    return {
      content: searchResult.content,
      sources: searchResult.sources
    };
  } catch (error) {
    console.error('Error in simple search process:', error);
    return {
      content: 'Search process failed. Please try again.',
      sources: []
    };
  }
}

/**
 * Helper function to get current month and year
 * This helps make searches more relevant and recent
 */
function getCurrentMonthYear(): string {
  const date = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

// For backward compatibility, we'll keep this function but it will now use the simplified approach
export async function conductThreeStageSearch(
  prompt: string,
  episodeCount: number
): Promise<{searchResults: SearchResults, rawSearchData: string}> {
  try {
    console.log('Using simplified search instead of three-stage search for prompt:', prompt);
    
    // Use the simplified search approach
    const simpleResult = await conductSimpleSearch(prompt);
    
    // Format the results to match the expected output structure
    const simpleSearchResults: SearchResults = {
      stories: {
        "Latest News": {
          mainStory: {
            title: "Current Information",
            snippet: simpleResult.content,
            url: simpleResult.sources[0] || ""
          },
          additionalContext: []
        }
      },
      sources: simpleResult.sources
    };
    
    return {
      searchResults: simpleSearchResults,
      rawSearchData: simpleResult.content
    };
  } catch (error) {
    console.error('Error in search process:', error);
    return {
      searchResults: { stories: {}, sources: [] },
      rawSearchData: 'Search process failed. Please try again.'
    };
  }
}

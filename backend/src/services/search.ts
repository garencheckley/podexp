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
 * Represents a research topic identified for follow-up
 */
export interface ResearchTopic {
  topic: string;
  query: string;
  priority: number; // 1-10 scale where 10 is highest priority
  reason: string;   // Why this topic needs more research
}

/**
 * Structured results from an adaptive multi-stage research process
 */
export interface AdaptiveResearchResults {
  initialSearch: {
    content: string;
    sources: string[];
  };
  followupTopics: ResearchTopic[];
  followupResults: {
    [topic: string]: {
      content: string;
      sources: string[];
    }
  };
  consolidatedContent: string; // Final consolidated research
  allSources: string[];        // All unique sources
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

/**
 * Analyzes search results to identify topics that need more research
 * 
 * @param searchContent The content from the initial search
 * @param podcastPrompt The original podcast prompt
 * @returns An array of topics that need further research
 */
async function identifyResearchTopics(
  searchContent: string,
  podcastPrompt: string
): Promise<ResearchTopic[]> {
  try {
    console.log('Analyzing search results to identify follow-up research topics');

    const analysisPrompt = `You are a professional research analyst helping to prepare a news podcast on this topic: "${podcastPrompt}"

I've conducted an initial search and found the following information:

${searchContent}

Please analyze this information and identify 2-4 specific topics that need deeper research to create a comprehensive, factual podcast episode. For each topic:
1. Identify gaps, outdated information, or areas needing verification
2. Create a specific search query that would yield the most useful additional context
3. Assign a priority (1-10) where 10 is highest priority
4. Explain briefly why this topic needs more research

Response format:
[
  {
    "topic": "Specific topic needing more research",
    "query": "Precise search query to find this information",
    "priority": priority_number,
    "reason": "Brief explanation of why this needs more research"
  },
  {...}
]`;

    const result = await model.generateContent(analysisPrompt);
    const responseText = result.response.text();
    
    // Clean the response and parse the JSON
    const cleanedText = responseText.replace(/```json|```|\n/g, '');
    let researchTopics: ResearchTopic[] = [];
    
    try {
      researchTopics = JSON.parse(cleanedText);
      // Ensure we have valid topics (at most 4)
      researchTopics = researchTopics
        .filter(topic => topic.topic && topic.query && topic.priority)
        .slice(0, 4);
      
      // Sort by priority (highest first)
      researchTopics.sort((a, b) => b.priority - a.priority);
      
      console.log(`Identified ${researchTopics.length} topics for follow-up research`);
    } catch (parseError) {
      console.error('Error parsing research topics:', parseError);
      // Create a fallback topic based on the original prompt
      researchTopics = [{
        topic: `More details on ${podcastPrompt}`,
        query: `latest developments ${podcastPrompt} ${getCurrentMonthYear()} detailed analysis`,
        priority: 10,
        reason: "Need more detailed information on the main topic"
      }];
    }
    
    return researchTopics;
  } catch (error) {
    console.error('Error identifying research topics:', error);
    return [];
  }
}

/**
 * Conducts adaptive research with intelligent follow-up searches
 * This analyzes initial results and performs targeted follow-up searches
 * 
 * @param prompt The podcast prompt
 * @returns Comprehensive research results with all follow-up information
 */
export async function conductAdaptiveResearch(
  prompt: string
): Promise<AdaptiveResearchResults> {
  console.log('Starting adaptive research process for prompt:', prompt);
  
  try {
    // Step 1: Initial broad search to understand the topic
    console.log('Conducting initial search...');
    const initialSearch = await conductSimpleSearch(prompt);
    
    // Step 2: Analyze results to identify topics that need more research
    console.log('Analyzing initial results to identify follow-up topics...');
    const researchTopics = await identifyResearchTopics(initialSearch.content, prompt);
    
    // Step 3: Conduct follow-up searches on identified topics
    console.log(`Conducting ${researchTopics.length} follow-up searches...`);
    const followupResults: {[topic: string]: {content: string, sources: string[]}} = {};
    
    // Execute follow-up searches in parallel to save time
    await Promise.all(researchTopics.map(async (topic) => {
      console.log(`Researching topic: "${topic.topic}" with query: "${topic.query}"`);
      const result = await executeWebSearch(topic.query);
      followupResults[topic.topic] = result;
    }));
    
    // Step 4: Consolidate all findings into a cohesive research document
    console.log('Consolidating all research findings...');
    
    const consolidationPrompt = `You are a professional journalist preparing a comprehensive research document. 
    
Please consolidate the following research into a well-organized document that covers all key information, focusing on facts, 
quotes, statistics, and recent developments. Remove any redundancy and organize information logically.

INITIAL RESEARCH:
${initialSearch.content}

${Object.entries(followupResults).map(([topic, data]) => `
FOLLOW-UP RESEARCH ON "${topic}":
${data.content}
`).join('\n')}

Create a comprehensive document organized by topic that a journalist could use to write a detailed, factual news podcast.
Focus on including specific dates, quotes with attribution, and factual information. Do NOT summarize the information - 
preserve all important details, quotes, and context.`;

    const consolidationResult = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: consolidationPrompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 4000,
      }
    });
    
    const consolidatedContent = consolidationResult.response.text();
    
    // Collect all unique sources
    const allSources = [...initialSearch.sources];
    Object.values(followupResults).forEach(result => {
      result.sources.forEach(source => {
        if (!allSources.includes(source)) {
          allSources.push(source);
        }
      });
    });
    
    console.log('Adaptive research completed successfully');
    console.log(`Found ${allSources.length} total unique sources`);
    
    return {
      initialSearch,
      followupTopics: researchTopics,
      followupResults,
      consolidatedContent,
      allSources
    };
  } catch (error) {
    console.error('Error in adaptive research process:', error);
    // Return a minimal result if anything fails
    return {
      initialSearch: {
        content: 'Initial search failed.',
        sources: []
      },
      followupTopics: [],
      followupResults: {},
      consolidatedContent: 'Research process failed. Please try again.',
      allSources: []
    };
  }
}

// For backward compatibility, we'll keep this function but it will now use the simplified approach
export async function conductThreeStageSearch(
  prompt: string,
  episodeCount: number
): Promise<{searchResults: SearchResults, rawSearchData: string}> {
  try {
    console.log('Using adaptive research instead of three-stage search for prompt:', prompt);
    
    // Use the new adaptive research approach
    const adaptiveResults = await conductAdaptiveResearch(prompt);
    
    // Format the results to match the expected output structure
    const searchResults: SearchResults = {
      stories: {
        "Latest News": {
          mainStory: {
            title: "Comprehensive Research",
            snippet: adaptiveResults.consolidatedContent,
            url: adaptiveResults.allSources[0] || ""
          },
          additionalContext: []
        }
      },
      sources: adaptiveResults.allSources
    };
    
    return {
      searchResults: searchResults,
      rawSearchData: adaptiveResults.consolidatedContent
    };
  } catch (error) {
    console.error('Error in search process:', error);
    return {
      searchResults: { stories: {}, sources: [] },
      rawSearchData: 'Search process failed. Please try again.'
    };
  }
}

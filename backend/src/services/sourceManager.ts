import { GoogleGenerativeAI } from '@google/generative-ai';
import { Podcast, PodcastSource } from './database';
import { POWERFUL_MODEL_ID } from '../config';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Discovers authoritative sources based on a podcast's prompt
 * @param podcastPrompt The podcast prompt
 * @returns Array of podcast sources
 */
export async function discoverSources(podcastPrompt: string): Promise<PodcastSource[]> {
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log('Discovering sources for podcast prompt:', podcastPrompt);
    
    const sourceDiscoveryPrompt = `
Based on the following podcast theme, identify 10-15 authoritative websites that would be valuable sources for generating recent, high-quality content.

PODCAST THEME: "${podcastPrompt}"

For each website, provide:
1. Full URL (including https://)
2. Name of the source
3. Category (News, Blog, Research, Government, etc.)
4. Topics it covers relevant to the podcast (comma-separated)
5. Quality score (1-10, where 10 is highest quality)

The sources should:
- Be reputable and reliable
- Provide up-to-date information
- Cover different aspects of the podcast theme
- Include a mix of general and specialized sources
- Focus on sources that update frequently with recent content

Format each source as a JSON object in an array with these exact fields:
{ 
  "url": "https://example.com", 
  "name": "Example Site", 
  "category": "News", 
  "topicRelevance": ["topic1", "topic2"], 
  "qualityScore": 8 
}

ONLY respond with the JSON array, nothing else before or after.
`;

    const result = await model.generateContent(sourceDiscoveryPrompt);
    const responseText = result.response.text();
    
    // Parse the JSON response
    try {
      const sourcesJson = extractJsonFromResponse(responseText);
      const sources = JSON.parse(sourcesJson) as PodcastSource[];
      
      // Validate and clean sources
      const validSources = sources
        .filter(source => isValidSource(source))
        .map(source => {
          // Ensure quality score is within range
          if (source.qualityScore < 1) source.qualityScore = 1;
          if (source.qualityScore > 10) source.qualityScore = 10;
          
          return source;
        });
      
      console.log(`Discovered ${validSources.length} valid sources`);
      return validSources;
    } catch (parseError) {
      console.error('Error parsing sources JSON:', parseError);
      console.log('Raw response:', responseText);
      return [];
    }
  } catch (error) {
    console.error('Error discovering sources:', error);
    return [];
  }
}

/**
 * Helper function to extract JSON from a text response that might have additional content
 */
function extractJsonFromResponse(text: string): string {
  // Try to extract JSON from the response
  const jsonRegex = /\[\s*\{.*\}\s*\]/s;
  const match = text.match(jsonRegex);
  
  if (match && match[0]) {
    return match[0];
  }
  
  // If no match, return the original text and let JSON.parse throw an error
  return text;
}

/**
 * Validates a source object to ensure it has all required fields
 */
function isValidSource(source: any): boolean {
  if (!source) return false;
  
  // Check for required fields
  if (!source.url || typeof source.url !== 'string' || !source.url.startsWith('http')) {
    return false;
  }
  
  if (!source.name || typeof source.name !== 'string') {
    return false;
  }
  
  if (!source.category || typeof source.category !== 'string') {
    return false;
  }
  
  if (!Array.isArray(source.topicRelevance)) {
    return false;
  }
  
  if (typeof source.qualityScore !== 'number') {
    return false;
  }
  
  return true;
}

/**
 * Evaluates and refreshes sources during episode generation
 * @param podcast The podcast with existing sources
 * @returns Updated list of sources
 */
export async function refreshSourcesIfNeeded(podcast: Podcast): Promise<PodcastSource[]> {
  // If no sources exist, discover new ones
  if (!podcast.sources || podcast.sources.length === 0) {
    console.log(`No sources found for podcast "${podcast.title}", discovering new sources`);
    return await discoverSources(podcast.prompt || podcast.description);
  }
  
  // We have existing sources, evaluate them
  console.log(`Evaluating ${podcast.sources.length} existing sources for podcast "${podcast.title}"`);
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });

  const sourceEvaluationPrompt = `
Review the following sources for a podcast with theme: "${podcast.prompt || podcast.description}"

These sources are used for finding recent, relevant information for podcast episodes.

SOURCES:
${JSON.stringify(podcast.sources, null, 2)}

For each source, determine:
1. If it's still relevant to the podcast theme
2. If it's likely to provide recent information
3. If it should be kept or replaced

Identify any sources that should be removed and suggest 1-3 new sources to add in their place.

Response format:
{
  "sourcesToKeep": [list of URLs to keep],
  "sourcesToRemove": [list of URLs to remove],
  "newSources": [
    { 
      "url": "https://example.com", 
      "name": "Example Site", 
      "category": "News", 
      "topicRelevance": ["topic1", "topic2"], 
      "qualityScore": 8 
    }
  ]
}

ONLY respond with the JSON object, nothing else before or after.
`;

  try {
    const result = await model.generateContent(sourceEvaluationPrompt);
    const responseText = result.response.text();
    
    // Parse the JSON response
    try {
      const evaluationJson = extractJsonFromResponse(responseText);
      const evaluation = JSON.parse(evaluationJson) as {
        sourcesToKeep: string[];
        sourcesToRemove: string[];
        newSources: PodcastSource[];
      };
      
      // Keep the sources that should be kept
      const updatedSources = podcast.sources
        .filter(source => evaluation.sourcesToKeep.includes(source.url));
      
      // Validate and add new sources
      const validNewSources = evaluation.newSources
        .filter(source => isValidSource(source))
        .map(source => {
          // Ensure quality score is within range
          if (source.qualityScore < 1) source.qualityScore = 1;
          if (source.qualityScore > 10) source.qualityScore = 10;
          
          return source;
        });
      
      // Combine kept sources with new sources
      updatedSources.push(...validNewSources);
      
      console.log(`Source evaluation complete: Keeping ${evaluation.sourcesToKeep.length}, removing ${evaluation.sourcesToRemove.length}, adding ${validNewSources.length}`);
      return updatedSources;
    } catch (parseError) {
      console.error('Error parsing source evaluation JSON:', parseError);
      console.log('Raw response:', responseText);
      // If there's an error, return the original sources
      return podcast.sources;
    }
  } catch (error) {
    console.error('Error evaluating sources:', error);
    // In case of error, keep the original sources
    return podcast.sources;
  }
}

/**
 * Performs source-guided searches for podcast content
 * @param podcast The podcast with sources
 * @param generalTopics General topics discovered from initial search
 * @returns Combined search results from general and source-specific searches
 */
export async function performSourceGuidedSearch(
  podcast: Podcast,
  generalTopics: string[]
): Promise<{content: string, sources: string[]}> {
  try {
    console.log(`Performing source-guided search for ${generalTopics.length} topics`);
    
    // If no sources, just return empty content
    if (!podcast.sources || podcast.sources.length === 0) {
      console.log('No sources available for guided search');
      return { content: '', sources: [] };
    }
    
    // Get the current date info for recency
    const date = new Date();
    const currentDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const currentMonthYear = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
    
    // Create source-specific search queries
    const sourceQueries = [];
    const topSources = podcast.sources
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, 5); // Use top 5 sources by quality score
    
    for (const source of topSources) {
      for (const topic of generalTopics.slice(0, 2)) { // Use top 2 topics for each source
        const sourceQuery = `site:${new URL(source.url).hostname} ${topic} ${currentMonthYear}`;
        sourceQueries.push(sourceQuery);
      }
    }
    
    // Perform searches and collect results
    const allResults = [];
    const allSources = [];
    
    // Limit to max 5 queries to avoid overloading
    const limitedQueries = sourceQueries.slice(0, 5);
    console.log(`Executing ${limitedQueries.length} source-specific queries`);
    
    for (const query of limitedQueries) {
      console.log(`Source query: ${query}`);
      const { content, sources } = await executeSourceQuery(query);
      allResults.push(content);
      allSources.push(...sources);
    }
    
    // Combine all results
    const combinedContent = allResults.join('\n\n');
    const uniqueSources = [...new Set(allSources)];
    
    console.log(`Source-guided search complete: ${limitedQueries.length} queries, ${uniqueSources.length} sources`);
    return {
      content: combinedContent,
      sources: uniqueSources
    };
  } catch (error) {
    console.error('Error in source-guided search:', error);
    return { content: '', sources: [] };
  }
}

/**
 * Executes a source-specific search query
 * @param query The search query with site: operator
 * @returns Search results and sources
 */
async function executeSourceQuery(query: string): Promise<{content: string, sources: string[]}> {
  try {
    // Use the existing web search function
    const searchModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{ google_search: {} } as any], // Type cast to any to bypass TypeScript error
    });

    const searchPrompt = `
Search for recent information using this specific query: "${query}"

Provide a comprehensive summary of what you find. Focus on:
1. Recent developments or news
2. Key facts and statistics
3. Current trends

Format the response as a coherent paragraph that could be included in a podcast script.
`;

    const result = await searchModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: searchPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
      }
    });

    const responseText = result.response.text();
    
    // Extract sources from grounding metadata
    let sources: string[] = [];
    try {
      const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
      
      if (groundingMetadata && groundingMetadata.groundingChunks && groundingMetadata.groundingChunks.length > 0) {
        // Extract URLs from grounding chunks
        sources = groundingMetadata.groundingChunks
          .filter((chunk: any) => chunk.web && chunk.web.uri)
          .map((chunk: any) => chunk.web.uri);
      }
      
      console.log(`Found ${sources.length} sources for source-specific query`);
    } catch (error) {
      console.error('Error extracting sources:', error);
    }

    return {
      content: responseText,
      sources: sources
    };
  } catch (error) {
    console.error('Error executing source query:', error);
    return {
      content: `Failed to retrieve information for query: "${query}"`,
      sources: []
    };
  }
} 
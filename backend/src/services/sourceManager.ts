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
Based on the following podcast theme, identify 20-30 authoritative websites that would be valuable sources for generating recent, high-quality content.

PODCAST THEME: "${podcastPrompt}"

For each website, provide:
1. Full URL (including https://)
2. Name of the source
3. Category (e.g., News, Analysis/Think Tank, Research Journal, Blog, Government, etc.)
4. Topics it covers relevant to the podcast (comma-separated)
5. Quality score (1-10, where 10 is highest quality and indicates strong analytical depth if applicable)
6. Publishing frequency (Daily, Weekly, Monthly, etc.)
7. Political/perspective leaning if applicable (Neutral, Left, Right, Center, etc.)

The sources should:
- Be reputable and reliable.
- Include a mix of sources providing factual reporting AND sources providing deeper analysis (e.g., reputable think tanks, research institutions, well-regarded editorial sections).
- Provide up-to-date information.
- Cover different aspects of the podcast theme.
- Include a mix of general and specialized sources.
- Focus on sources that update frequently with recent content.
- Represent diverse viewpoints and perspectives on the topic.
- Include at least 2-3 international sources for global perspective.
- Include a mix of mainstream and niche specialized publications.

Format each source as a JSON object in an array with these exact fields:
{ 
  "url": "https://example.com", 
  "name": "Example Site", 
  "category": "News", 
  "topicRelevance": ["topic1", "topic2"], 
  "qualityScore": 8,
  "frequency": "Daily",
  "perspective": "Neutral" 
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
    
    // Organize sources into categories
    const categorizedSources = podcast.sources.reduce((acc, source) => {
      const category = source.category || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(source);
      return acc;
    }, {} as Record<string, PodcastSource[]>);
    
    // Rank sources within each category by qualityScore
    Object.keys(categorizedSources).forEach(category => {
      categorizedSources[category].sort((a, b) => b.qualityScore - a.qualityScore);
    });
    
    // Ensure perspective diversity if available
    const perspectiveGroups: Record<string, PodcastSource[]> = {};
    podcast.sources.forEach(source => {
      if (source.perspective) {
        if (!perspectiveGroups[source.perspective]) perspectiveGroups[source.perspective] = [];
        perspectiveGroups[source.perspective].push(source);
      }
    });
    
    // Create balanced query list that ensures:
    // 1. Coverage of all topics
    // 2. Representation from high-quality sources in each category
    // 3. Perspective diversity where available
    const queries: string[] = [];
    
    // Add topic-specific queries from high-quality sources
    for (const topic of generalTopics) {
      // Find sources most relevant to this topic
      const relevantSources = podcast.sources
        .filter(source => 
          source.topicRelevance && 
          source.topicRelevance.some(t => 
            topic.toLowerCase().includes(t.toLowerCase()) || 
            t.toLowerCase().includes(topic.toLowerCase())
          )
        )
        .sort((a, b) => b.qualityScore - a.qualityScore);
      
      // Take top 3 most relevant sources for this topic
      const topSourcesForTopic = relevantSources.slice(0, 3);
      
      for (const source of topSourcesForTopic) {
        queries.push(`site:${new URL(source.url).hostname} ${topic} ${currentMonthYear}`);
      }
      
      // If we have perspective data, ensure diverse viewpoints
      if (Object.keys(perspectiveGroups).length > 1) {
        const perspectives = Object.keys(perspectiveGroups);
        // Get one source from each major perspective group for this topic
        for (const perspective of perspectives) {
          const sourcesWithPerspective = perspectiveGroups[perspective]
            .filter(source => source.qualityScore >= 6) // Only use quality sources
            .slice(0, 1); // Take the top source for this perspective
          
          if (sourcesWithPerspective.length > 0) {
            const source = sourcesWithPerspective[0];
            queries.push(`site:${new URL(source.url).hostname} ${topic} ${currentMonthYear}`);
          }
        }
      }
    }
    
    // Add category-specific queries to ensure breadth
    // For each category, add the top source
    for (const category in categorizedSources) {
      const topSourceInCategory = categorizedSources[category][0];
      if (topSourceInCategory && topSourceInCategory.qualityScore >= 7) {
        const categoryQuery = `site:${new URL(topSourceInCategory.url).hostname} ${podcast.prompt || podcast.description} ${currentMonthYear}`;
        queries.push(categoryQuery);
      }
    }
    
    // Deduplicate queries
    const uniqueQueries = [...new Set(queries)];
    console.log(`Generated ${uniqueQueries.length} unique source-guided queries`);
    
    // Execute all queries and combine results
    const queryResults = await Promise.all(
      uniqueQueries.map(query => executeSourceQuery(query))
    );
    
    // Combine content and sources from all query results
    const combinedContent = queryResults
      .map(result => result.content)
      .filter(content => content.length > 0)
      .join('\n\n---\n\n');
    
    const allSources = [...new Set(
      queryResults.flatMap(result => result.sources)
    )];
    
    console.log(`Source-guided search complete with ${allSources.length} unique sources`);
    
    return {
      content: combinedContent,
      sources: allSources
    };
  } catch (error) {
    console.error('Error in source-guided search:', error);
    return {
      content: '',
      sources: []
    };
  }
}

/**
 * Executes a source-specific search query using Gemini with Search Grounding
 * @param query The search query targeting a specific source
 * @returns Content and sources from the search
 */
async function executeSourceQuery(query: string): Promise<{content: string, sources: string[]}> {
  try {
    console.log(`Executing source query: "${query}"`);
    
    // Create a model instance with the search tool configured
    const searchModel = genAI.getGenerativeModel({
      model: POWERFUL_MODEL_ID,
      tools: [{ 'google_search_retrieval': {} } as any],
    });

    const result = await searchModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: query }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4000,
      }
    });

    const responseText = result.response.text();
    
    // Extract sources from grounding metadata
    let sources: string[] = [];
    try {
      // With Gemini 2.5, grounding metadata is structured differently
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
      
      console.log(`Found ${sources.length} sources for source query "${query}"`);
    } catch (error) {
      console.error('Error extracting sources from source query:', error);
    }

    return {
      content: responseText,
      sources: sources
    };
  } catch (error) {
    console.error('Error executing source query:', error);
    return {
      content: `Failed to retrieve information for source query: "${query}"`,
      sources: []
    };
  }
}

/**
 * Helper function to extract URIs from citation metadata
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

// Define the new input structure for cluster summaries
export interface ClusterSummaryInput { 
  clusterId: number;
  summary: string;
  originalTopicIds: string[];
} 
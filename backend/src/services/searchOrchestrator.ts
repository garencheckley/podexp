import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeWebSearch } from './search';
import { EpisodeAnalysis } from './episodeAnalyzer';
import { Podcast } from './database';
import { FAST_MODEL_ID, POWERFUL_MODEL_ID } from '../config';
import { getHybridTopicRecommendations, HybridTopicResult } from './hybridTopicService';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Interface for search results from initial exploration
 */
export interface SearchResults {
  potentialTopics: Array<{ topic: string; relevance: number; query: string; recency?: string }>;
  relevantSources: string[];
  recencyMapping: { [topic: string]: string };
  combinedResearch?: string;
  allSources?: string[];
  hybridMetadata?: {
    geminiTopics: number;
    perplexityTopics: number;
    hybridScore: number;
    processingTimeMs: number;
  };
}

/**
 * Interface for episode planning
 */
export interface EpisodePlan {
  episodeTitle: string;
  selectedTopics: Array<{
    topic: string;
    rationale: string;
    targetDepth: 'deep' | 'medium' | 'overview';
    angles: string[];
    furtherResearchNeeded: string[];
  }>;
  differentiationStrategy: string;
}

/**
 * Interface for detailed research results
 */
export interface DetailedResearchResults {
  topicResearch: Array<{
    topic: string;
    mainResearch: {
      content: string;
      sources: string[];
    };
    contrastingViewpoints: {
      content: string;
      sources: string[];
    };
    synthesizedContent: string;
  }>;
  overallSynthesis: string;
  allSources: string[];
}

/**
 * NEW Interface for the raw topic idea from our direct Gemini prompt
 */
interface RawTopicIdea {
  topic_title: string;
  topic_summary: string;
  key_questions: string[];
}

/**
 * NEW Function for Phase 1: Generates topic ideas directly using a detailed prompt.
 */
async function generateDirectTopicIdeas_Phase1(
  podcast: Podcast,
  analysis: EpisodeAnalysis
): Promise<RawTopicIdea[]> {
  console.log(`[Phase 1] Attempting direct topic generation for podcast: ${podcast.title}`);
  
  try {
    // Use Gemini-based approach for fallback
    console.log(`[Phase 1] Using Gemini for topic generation`);
    const sourceUrls = podcast.sources?.map(s => s.url).filter(url => !!url) || [];
    let sourceListString = "any reputable major news outlets";
    if (sourceUrls.length > 0) {
      sourceListString = `the following websites: ${sourceUrls.join(', ')}. You may also consider highly relevant breaking news from other reputable major news outlets if it directly pertains to the podcast's theme and the specified preferred sources.`;
    }

    // UPDATED PROMPT: Remove all requirements for supporting_sources/credible sources
    const geminiPrompt = `
You are an AI assistant tasked with generating compelling and timely podcast episode topic ideas for a news-focused podcast.

Podcast Details:
- Main Theme/Description: "${podcast.prompt || podcast.description || podcast.title}"
- Preferred Information Sources: Please prioritize news and updates from ${sourceListString}

Your Task:
Identify 5-7 distinct and newsworthy podcast episode topic ideas based on significant developments, stories, or updates that have emerged primarily from the preferred information sources (and other relevant major news outlets as a secondary consideration) strictly within the **last 14 days**.

// --- MODIFIED PROMPT REQUIREMENTS ---
// 1. At least one topic must be a 'Top Headline' or 'Trending Now' story from the last 24-48 hours (not necessarily breaking news).
// 2. Ensure diversity: include at least one regulatory/legal update, one financial/market update, and one public impact story (e.g., consumer, safety, or environmental).
// 3. Force specificity: discourage generic topics, require concrete events, named entities, or specific policy changes.
// 4. Do NOT include any 'breaking news' language or requirements.

Output Requirements:
For each topic idea, provide the following in a clear, structured format (e.g., JSON):
1.  \`\`\`topic_title\`\`\` A concise, engaging title for a potential podcast episode (e.g., "The Future of Contactless Payments: What's Next?").
2.  \`\`\`topic_summary\`\`\` A brief explanation (1-2 sentences) of why this is a good candidate for an episode, highlighting its timeliness (within the last 14 days) and relevance to the podcast's theme.
3.  \`\`\`key_questions\`\`\` 2-3 key questions that an episode on this topic could explore to provide depth and insight for the listener (e.g., "How are consumer adoption rates changing?", "What are the latest security concerns?").

Important Considerations:
- Focus on distinct topics. Avoid multiple slight variations of the same core event unless the different angles are themselves uniquely newsworthy and substantial.
- Ensure the information used to derive these topics is current (within the last 14 days).
- The output should be a list of these structured topic ideas.
- At least one topic must be a 'Top Headline' or 'Trending Now' story from the last 24-48 hours.
- Include at least one regulatory/legal update, one financial/market update, and one public impact story.
- Avoid generic topics; require concrete events, named entities, or specific policy changes.

Please return the output as a JSON array, where each element is an object representing a topic idea with the fields: \`\`\`topic_title\`\`\`, \`\`\`topic_summary\`\`\`, and \`\`\`key_questions\`\`\` (which itself is an array of strings).

Example of a single topic object:
\`\`\`
{
  "topic_title": "Example Topic Title",
  "topic_summary": "This topic is relevant because of recent X event reported by Source Y within the last 14 days.",
  "key_questions": ["What is the impact of Z?", "How will this affect Q?"]
}
\`\`\`
`;

    console.log(`[Phase 1] Sending direct topic generation prompt to Gemini for podcast: ${podcast.title}`);
    // Using POWERFUL_MODEL_ID for this complex generation task
    const searchResult = await executeWebSearch(geminiPrompt); // Assuming executeWebSearch uses a model with web grounding

    console.log(`[Phase 1] Received raw response from Gemini for ${podcast.title}:`, searchResult.content.substring(0, 500) + "..."); // Log snippet

    try {
      // FIX: Add a check to ensure the response is valid JSON before parsing
      const cleanedResponse = searchResult.content.replace(/^```json\\n?|\\n?```$/g, "").trim();
      if (!cleanedResponse.startsWith('[') && !cleanedResponse.startsWith('{')) {
        throw new Error("Response from Gemini is not valid JSON.");
      }

      const parsedTopics = JSON.parse(cleanedResponse) as RawTopicIdea[];

      if (!Array.isArray(parsedTopics)) {
        console.error(`[Phase 1] Parsed response for ${podcast.title} is not an array. Response:`, cleanedResponse);
        throw new Error("Parsed response for direct topic generation is not an array.");
      }
      // Basic validation of the first topic's structure
      if (parsedTopics.length > 0 && typeof parsedTopics[0].topic_title !== 'string') {
          console.error(`[Phase 1] Parsed topics for ${podcast.title} do not match expected structure. First topic:`, parsedTopics[0]);
          throw new Error("Parsed topics do not match expected structure for direct topic generation.");
      }

      // Ensure at least 5 topics are returned if available
      const limitedTopics = parsedTopics.slice(0, 7); // 5-7 topics
      if (limitedTopics.length < 5) {
        console.warn(`[Phase 1] Fewer than 5 topics returned for ${podcast.title}. Returning all available topics.`);
      }

      console.log(`[Phase 1] Successfully parsed ${limitedTopics.length} direct topic ideas for ${podcast.title}.`);
      return limitedTopics;
    } catch (error: any) {
      console.error(`[Phase 1] Failed to parse direct topic ideas for ${podcast.title}. Error: ${error.message}. Raw content:`, searchResult.content);
      throw new Error(`Failed to parse direct topic ideas from Gemini: ${error.message}`); // Re-throw to trigger fallback
    }
  } catch (error) {
    console.error(`[Phase 1] Error in topic generation:`, error);
    return [];
  }
}

/**
 * NEW Function for Phase 1: Adapts raw topic ideas to the SearchResults structure.
 */
function adaptDirectResultsToSearchResults_Phase1(
  rawTopics: RawTopicIdea[],
  _podcast: Podcast // Podcast might be used in future for more context
): SearchResults {
  console.log(`[Phase 1] Adapting ${rawTopics.length} raw topics to SearchResults structure.`);
  const potentialTopics = rawTopics.map(rawTopic => ({
    topic: rawTopic.topic_title,
    relevance: 9, // Default high relevance for Phase 1
    query: `Explore further: ${rawTopic.key_questions?.join('; ') || rawTopic.topic_summary || rawTopic.topic_title}`,
    recency: "Within 14 days" // Explicitly set based on prompt
  }));

  // No sources logic anymore
  const allSources: string[] = [];
  
  const recencyMapping: { [topic: string]: string } = {};
  potentialTopics.forEach(pt => {
    if (pt.topic && pt.recency) { // pt.recency is now guaranteed
        recencyMapping[pt.topic] = pt.recency;
    }
  });

  return {
    potentialTopics,
    relevantSources: allSources, // No sources
    recencyMapping,
    combinedResearch: "", // No combined research blob from this direct method in Phase 1
    allSources // Empty
  };
}

/**
 * NEW Function for Phase 1: Uses hybrid topic discovery
 */
async function generateHybridTopicIdeas_Phase1(
  podcast: Podcast,
  analysis: EpisodeAnalysis
): Promise<SearchResults> {
  console.log(`[Hybrid Phase 1] Starting hybrid topic generation for podcast: ${podcast.title}`);
  
  try {
    // Get recommendations from both APIs
    const recommendations = await getHybridTopicRecommendations(podcast, analysis);
    
    if (recommendations.topics.length > 0) {
      console.log(`[Hybrid Phase 1] Found ${recommendations.topics.length} topics using hybrid approach`);
      
      // REMOVE FILTERING: Always use all topics
      const allTopics = recommendations.topics;
      // Convert hybrid results to SearchResults format
      const potentialTopics = allTopics.map(topic => ({
        topic: topic.topic,
        relevance: topic.relevance,
        query: topic.topic, // Use topic as query for further research
        recency: topic.recency
      }));
      
      const recencyMapping = Object.fromEntries(
        allTopics.map(t => [t.topic, t.recency])
      );
      
      const allSources = [...new Set(allTopics.flatMap(t => t.sources))];
      
      return {
        potentialTopics,
        relevantSources: allSources,
        recencyMapping,
        combinedResearch: '', // No combined research blob from hybrid method
        allSources,
        hybridMetadata: {
          geminiTopics: recommendations.geminiResults.length,
          perplexityTopics: recommendations.perplexityResults.length,
          hybridScore: recommendations.hybridScore,
          processingTimeMs: recommendations.processingStats.processingTimeMs
        }
      };
    } else {
      throw new Error("Hybrid topic generation yielded no topics.");
    }
  } catch (error) {
    console.error(`[Hybrid Phase 1] Error in hybrid topic generation:`, error);
    throw error; // Re-throw to trigger fallback
  }
}

/**
 * Performs initial exploratory search based on podcast info and previous episode analysis
 * @param podcast Podcast information
 * @param analysis Previous episode analysis
 * @returns Initial search results with potential topics
 */
export async function performInitialSearch(
  podcast: Podcast,
  analysis: EpisodeAnalysis
): Promise<SearchResults & { geminiPrompt?: string }> {
  // --- START NEW Hybrid Phase 1 Logic ---
  try {
    console.log(`[Hybrid Phase 1 Path] Attempting new hybrid topic generation for podcast: ${podcast.title}`);
    const hybridResults = await generateHybridTopicIdeas_Phase1(podcast, analysis);
    
    console.log(`[Hybrid Phase 1 Path] Hybrid approach successful with ${hybridResults.potentialTopics.length} topics`);
    return hybridResults;
    
  } catch (hybridError: any) {
    console.warn(`[Hybrid Phase 1 Path] Hybrid topic generation for ${podcast.title} failed: ${hybridError.message}. Falling back to original method.`);
    
    // --- FALLBACK to Original Phase 1 Logic ---
    try {
      console.log(`[Original Phase 1 Path] Attempting original direct topic generation for podcast: ${podcast.title}`);
      const rawTopicIdeas = await generateDirectTopicIdeas_Phase1(podcast, analysis);
      if (rawTopicIdeas && rawTopicIdeas.length > 0) {
        const adaptedResults = adaptDirectResultsToSearchResults_Phase1(rawTopicIdeas, podcast);
        return adaptedResults;
      } else {
        throw new Error("Direct topic generation yielded no topics.");
      }
    } catch (originalMethodError: any) {
      console.warn(`[Original Phase 1 Path] Original direct topic generation for ${podcast.title} failed: ${originalMethodError.message}. Falling back to search-based method.`);
      
      // --- FINAL FALLBACK to Search-Based Logic ---
      try {
        console.log(`[Fallback Path] Performing search-based initial search for podcast: ${podcast.title}`);
        
        // Generate search queries based on podcast prompt and analysis
        const searchQueries = await generateExploratoryQueries(podcast, analysis);
        console.log(`[Fallback Path] Generated ${searchQueries.length} exploratory search queries for ${podcast.title}`);
        
        // Execute searches in parallel
        const searchResultsPromises = searchQueries.map(query => executeWebSearch(query));
        const searchResultsArray = await Promise.all(searchResultsPromises);
        
        console.log(`[Fallback Path] All initial searches completed for ${podcast.title}`);
        
        // Identify potential topics from search results
        const potentialTopicsResponse = await identifyPotentialTopics(searchResultsArray, analysis, podcast);
        console.log(`[Fallback Path] Search-based method identified ${potentialTopicsResponse.potentialTopics.length} topics for ${podcast.title}.`);
        
        // --- REMOVED: All filtering logic ---
        
        return potentialTopicsResponse;

      } catch (fallbackError: any) {
        console.error(`[Fallback Path] Search-based method also failed for ${podcast.title}:`, fallbackError);
        // If all methods fail, return empty results
        return {
          potentialTopics: [],
          relevantSources: [],
          recencyMapping: {},
          allSources: []
        };
      }
    }
  }
  // --- END Hybrid Phase 1 Logic with Multiple Fallbacks ---
}

/**
 * Generates exploratory search queries based on podcast info and previous analysis
 * @param podcast Podcast information
 * @param analysis Previous episode analysis
 * @returns Array of search queries
 */
async function generateExploratoryQueries(
  podcast: Podcast,
  analysis: EpisodeAnalysis
): Promise<string[]> {
  const model = genAI.getGenerativeModel({ model: FAST_MODEL_ID });
  try {
    console.log('Generating exploratory search queries');
    
    const prompt = `
      Based on this podcast's theme and previous episode analysis, generate 5 search queries
      to discover new relevant content. Focus on finding information that hasn't been covered before.
      
      Podcast title: ${podcast.title}
      Podcast description: ${podcast.description}
      Podcast prompt: ${podcast.prompt || 'No specific prompt'}
      
      Previous episode analysis:
      - Number of episodes: ${analysis.episodeCount}
      - Common topics: ${analysis.recentTopics.slice(0, 5).map(t => t.topic).join(', ')}
      - Recurrent themes: ${Array.from(analysis.recurrentThemes).join(', ')}
      
      Generate a JSON array of search queries. Make sure to include recency terms (like current month, year, "latest", "recent", etc.) to find fresh content.
      
      ["query1", "query2", ...]
    `;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    try {
      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const queries = JSON.parse(cleanedResponse);
      
      if (Array.isArray(queries) && queries.length > 0) {
        return queries;
      } else {
        console.error('Invalid query format returned:', cleanedResponse);
        return generateFallbackQueries(podcast);
      }
    } catch (parseError) {
      console.error('Error parsing search queries:', parseError);
      return generateFallbackQueries(podcast);
    }
  } catch (error) {
    console.error('Error generating exploratory queries:', error);
    return generateFallbackQueries(podcast);
  }
}

/**
 * Generates fallback queries if the AI-generated ones fail
 * @param podcast Podcast information
 * @returns Array of basic search queries
 */
function generateFallbackQueries(podcast: Podcast): string[] {
  const currentDate = new Date();
  const month = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();
  
  const baseTerm = podcast.prompt || podcast.title;
  
  return [
    `latest news about ${baseTerm} ${month} ${year}`,
    `recent developments in ${baseTerm}`,
    `${baseTerm} current events`,
    `what's new with ${baseTerm}`,
    `${baseTerm} trending topics ${month} ${year}`
  ];
}

/**
 * Identifies potential topics from search results
 * @param searchResults Array of search result content and sources
 * @param analysis Previous episode analysis
 * @param podcast Podcast information
 * @returns Structured search results with potential topics
 */
async function identifyPotentialTopics(
  searchResults: Array<{content: string, sources: string[]}>,
  analysis: EpisodeAnalysis,
  podcast: Podcast
): Promise<SearchResults> {
  try {
    console.log('Identifying potential topics from search results');
    
    // Combine all search results and sources
    const combinedContent = searchResults.map(r => r.content).join('\n\n');
    const allSources = searchResults.flatMap(r => r.sources);
    
    // Use Gemini for topic identification (this is the final fallback)
    console.log('Using Gemini for topic identification');
    const model = genAI.getGenerativeModel({ model: FAST_MODEL_ID });
    const prompt = `
      Analyze these search results and identify potential topics for a podcast episode.
      Focus on finding content that hasn't been covered in previous episodes.
      
      Podcast title: ${podcast.title}
      Podcast description: ${podcast.description}
      
      Previously covered topics:
      ${analysis.recentTopics.map(t => `- ${t.topic} (mentioned ${t.frequency} times)`).join('\n')}
      
      Search results:
      ${combinedContent}
      
      Identify 5-7 potential topics for a new episode. For each topic:
      1. Provide a clear topic name
      2. Rate its relevance to the podcast theme (1-10)
      3. Suggest a specific search query to research this topic further
      4. Indicate how recent/timely this topic is (e.g., "breaking news", "ongoing development", "evergreen")
      
      Respond in JSON format:
      {
        "potentialTopics": [
          {
            "topic": "Topic name",
            "relevance": 8,
            "query": "Specific search query for deeper research",
            "recency": "How recent/timely this topic is"
          },
          ...
        ]
      }
    `;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    try {
      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const analysisResult = JSON.parse(cleanedResponse);
      
      if (analysisResult.potentialTopics && Array.isArray(analysisResult.potentialTopics)) {
        // Create recency mapping
        const recencyMapping: {[topic: string]: string} = {};
        analysisResult.potentialTopics.forEach((topic: any) => {
          if (topic.topic && topic.recency) {
            recencyMapping[topic.topic] = topic.recency;
          }
        });
        
        return {
          potentialTopics: analysisResult.potentialTopics,
          relevantSources: [...new Set(allSources)], // Deduplicate sources
          recencyMapping,
          combinedResearch: combinedContent,
          allSources: [...new Set(allSources)]
        };
      } else {
        console.error('Invalid topic analysis format:', cleanedResponse);
        return {
          potentialTopics: [],
          relevantSources: [...new Set(allSources)],
          recencyMapping: {},
          combinedResearch: '',
          allSources: []
        };
      }
    } catch (parseError) {
      console.error('Error parsing topic analysis:', parseError);
      return {
        potentialTopics: [],
        relevantSources: [...new Set(allSources)],
        recencyMapping: {},
        combinedResearch: '',
        allSources: []
      };
    }
  } catch (error) {
    console.error('Error identifying potential topics:', error);
    return {
      potentialTopics: [],
      relevantSources: [],
      recencyMapping: {},
      combinedResearch: searchResults.map(r => r.content).join('\n\n'),
      allSources: searchResults.flatMap(r => r.sources)
    };
  }
}

/**
 * Plans episode content based on podcast info, previous analysis, and search results
 * @param podcast Podcast information
 * @param analysis Previous episode analysis
 * @param searchResults Initial search results
 * @returns Detailed episode plan
 */
export async function planEpisodeContent(
  podcast: Podcast,
  analysis: EpisodeAnalysis,
  searchResults: SearchResults
): Promise<EpisodePlan> {
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log(`Planning episode content for podcast: ${podcast.title}`);
    
    const prompt = `
      As an expert podcast producer, plan an episode for this podcast based on the provided information.
      
      Podcast information:
      - Title: ${podcast.title}
      - Description: ${podcast.description}
      - Prompt: ${podcast.prompt || 'No specific prompt'}
      
      Previous episodes have covered these topics:
      ${analysis.recentTopics.map(t => `- ${t.topic} (mentioned ${t.frequency} times)`).join('\n')}
      
      Potential new topics from initial research:
      ${searchResults.potentialTopics.map(t => 
        `- ${t.topic} (relevance: ${t.relevance}/10, recency: ${searchResults.recencyMapping[t.topic] || 'unknown'})`)
        .join('\n')}
      
      Create a detailed episode plan that:
      1. Selects 2-3 main topics that provide new information not covered in previous episodes
      2. Determines appropriate depth for each topic (deep, medium, or overview)
      3. Identifies specific angles or perspectives to explore
      4. Suggests what further research is needed
      
      IMPORTANT REQUIREMENTS FOR EPISODE TITLE:
      1. DO NOT include any specific dates, months, or years in the title (like "April 2025" or "March Update")
      2. DO NOT make references to publication frequency (like "Weekly News" or "Monthly Update")
      3. Keep the title timeless and focused on the content itself
      4. Ensure the title is concise, engaging, and descriptive of the main topics
      
      Respond in JSON format:
      {
        "episodeTitle": "Proposed title",
        "selectedTopics": [
          {
            "topic": "Topic 1",
            "rationale": "Why this topic was selected",
            "targetDepth": "deep|medium|overview",
            "angles": ["angle1", "angle2"],
            "furtherResearchNeeded": ["specific research query 1", "specific research query 2"]
          },
          ...
        ],
        "differentiationStrategy": "Explanation of how this episode will differ from previous ones"
      }
    `;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    try {
      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const plan = JSON.parse(cleanedResponse);
      
      console.log(`Episode plan created with title: "${plan.episodeTitle}" and ${plan.selectedTopics?.length || 0} topics`);
      
      return plan;
    } catch (parseError) {
      console.error('Error parsing episode plan:', parseError);
      return createFallbackEpisodePlan(podcast, searchResults);
    }
  } catch (error) {
    console.error('Error planning episode content:', error);
    return createFallbackEpisodePlan(podcast, searchResults);
  }
}

/**
 * Creates a fallback episode plan if the AI-generated one fails
 * @param podcast Podcast information
 * @param searchResults Search results
 * @returns Basic episode plan
 */
function createFallbackEpisodePlan(podcast: Podcast, searchResults: SearchResults): EpisodePlan {
  // Use the first 2 topics from search results if available
  const selectedTopics = searchResults.potentialTopics.slice(0, 2).map(topic => ({
    topic: topic.topic,
    rationale: "Topic selected based on relevance and recency",
    targetDepth: "medium" as const,
    angles: ["Latest developments", "Impact and significance"],
    furtherResearchNeeded: [topic.query]
  }));
  
  // If no topics from search, create a generic one
  if (selectedTopics.length === 0) {
    selectedTopics.push({
      topic: `Latest updates on ${podcast.title}`,
      rationale: "General topic based on podcast theme",
      targetDepth: "medium" as const,
      angles: ["Current developments", "Future outlook"],
      furtherResearchNeeded: [`recent news about ${podcast.title || podcast.description}`]
    });
  }
  
  return {
    episodeTitle: `New Developments in ${podcast.title}`,
    selectedTopics,
    differentiationStrategy: "Focus on the most recent developments and news in this area"
  };
}

/**
 * Performs deep research on topics identified in the episode plan
 * @param plan Episode plan containing topics to research
 * @returns Detailed research results for each topic
 */
export async function performDeepResearch(plan: EpisodePlan): Promise<DetailedResearchResults> {
  try {
    console.log(`Performing deep research for episode: "${plan.episodeTitle}"`);
    
    // Research each topic in parallel
    const topicResearchPromises = plan.selectedTopics.map(async topicSelection => {
      try {
        // 1. Main Research (using furtherResearchNeeded or generating new queries)
        let researchQueries = topicSelection.furtherResearchNeeded || [];
        const mainResearchResults = await executeMultipleSearches(researchQueries);
        
        // 2. Contrasting Viewpoints
        const contrastingViewpoints = await findContrastingViewpoints(topicSelection.topic, mainResearchResults.content);
        
        // 3. Synthesize Research
        const synthesizedContent = await synthesizeTopicResearch(
          topicSelection,
          mainResearchResults,
          contrastingViewpoints
        );
        
        return {
          topic: topicSelection.topic,
          mainResearch: mainResearchResults,
          contrastingViewpoints,
          synthesizedContent
        };
      } catch (topicError: any) {
        // THIS IS THE CRITICAL PART FOR A SINGLE TOPIC'S DEEP DIVE
        console.error(`[Deep Dive] Error researching topic '${topicSelection.topic}'. Full error:`, topicError); // MODIFIED: Log full error to console.error
        // Return a partial result or indicate failure for this specific topic
        return {
          topic: topicSelection.topic,
          mainResearch: { content: `Error during main research for '${topicSelection.topic}': ${topicError.message}`, sources: [] }, // Enhanced message
          contrastingViewpoints: { content: '', sources: [] },
          synthesizedContent: `Failed to complete research for topic '${topicSelection.topic}' due to an error: ${topicError.message}. Please check logs for details.`, // Enhanced message
        };
      }
    });
    
    const topicResearch = await Promise.all(topicResearchPromises);
    console.log(`Completed research for ${topicResearch.length} topics`);
    
    // Create overall synthesis
    const overallSynthesis = await createOverallSynthesis(plan, topicResearch);
    
    // Collect all sources
    const allSources = [...new Set(
      topicResearch.flatMap(tr => [
        ...tr.mainResearch.sources,
        ...tr.contrastingViewpoints.sources
      ])
    )];
    
    return {
      topicResearch,
      overallSynthesis,
      allSources
    };
  } catch (error) {
    console.error('Error performing deep research:', error);
    return {
      topicResearch: [],
      overallSynthesis: "Research could not be completed due to an error.",
      allSources: []
    };
  }
}

/**
 * Executes multiple search queries and combines the results
 * @param queries Array of search queries
 * @returns Combined search result content and sources
 */
async function executeMultipleSearches(queries: string[]): Promise<{content: string, sources: string[]}> {
  try {
    // Execute each query in parallel
    const searchResultsPromises = queries.map(query => executeWebSearch(query));
    const searchResults = await Promise.all(searchResultsPromises);
    
    // Combine content and sources
    const combinedContent = searchResults.map(result => result.content).join('\n\n');
    const allSources = [...new Set(searchResults.flatMap(result => result.sources))];
    
    return {
      content: combinedContent,
      sources: allSources
    };
  } catch (error) {
    console.error('Error executing multiple searches:', error);
    return {
      content: '',
      sources: []
    };
  }
}

/**
 * Finds contrasting viewpoints for a topic
 * @param topic The main topic
 * @param mainResearch The main research content
 * @returns Contrasting viewpoints content and sources
 */
async function findContrastingViewpoints(
  topic: string,
  mainResearch: string
): Promise<{content: string, sources: string[]}> {
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log(`Finding contrasting viewpoints for topic: "${topic}"`);
    
    // Generate queries to find contrasting viewpoints - pass more context
    const contrastingQueriesPrompt = `
      Based on this research about "${topic}", generate 3-4 search queries specifically designed 
      to find contrasting viewpoints, alternative perspectives, or criticisms of mainstream views.
      
      Research summary:
      ${mainResearch.substring(0, 5000)}
      
      Focus on finding:
      1. Opposing expert opinions or interpretations
      2. Alternative frameworks for understanding this topic
      3. Critiques of dominant narratives
      4. Different stakeholder perspectives

      Generate search queries that would uncover these contrasting viewpoints.
      Each query should be specifically crafted to find views different from what appears in the main research.
      
      Respond in JSON format as an array of strings:
      ["query1", "query2", "query3", "query4"]
    `;
    
    const result = await model.generateContent(contrastingQueriesPrompt);
    const responseText = result.response.text();
    
    try {
      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const queries = JSON.parse(cleanedResponse);
      
      if (Array.isArray(queries) && queries.length > 0) {
        console.log(`Generated ${queries.length} contrasting viewpoint queries for topic: "${topic}"`);
        const contrasting = await executeMultipleSearches(queries);
        return contrasting;
      } else {
        console.error('Invalid query format returned:', cleanedResponse);
        return {
          content: '',
          sources: []
        };
      }
    } catch (parseError) {
      console.error('Error parsing contrasting viewpoints queries:', parseError);
      return {
        content: '',
        sources: []
      };
    }
  } catch (error) {
    console.error(`Error finding contrasting viewpoints for topic "${topic}":`, error);
    return { content: 'Could not find contrasting viewpoints.', sources: [] };
  }
}

/**
 * Synthesizes research for a topic
 * @param topic The main topic
 * @param mainResearch The main research content and sources
 * @param contrastingViewpoints The contrasting viewpoints content and sources
 * @returns Synthesized content
 */
async function synthesizeTopicResearch(
  topic: {
    topic: string;
    rationale: string;
    targetDepth: 'deep' | 'medium' | 'overview';
    angles: string[];
    furtherResearchNeeded: string[];
  },
  mainResearch: {content: string, sources: string[]},
  contrastingViewpoints: {content: string, sources: string[]}
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log(`Synthesizing research for topic: "${topic.topic}"`);
    
    // Generate prompt to synthesize research - pass full content without character limits
    const synthesisPrompt = `
      Based on this research about "${topic.topic}", synthesize a ${topic.targetDepth} summary
      that explores these angles: ${topic.angles.join(', ')}.
      
      Main research:
      ${mainResearch.content}
      
      Contrasting viewpoints:
      ${contrastingViewpoints.content}
      
      Synthesize the research in a coherent and engaging manner that:
      
      1. Provides a comprehensive analysis focusing on a ${topic.targetDepth} level of detail
      2. Explores all specified angles: ${topic.angles.join(', ')}
      3. Presents multiple perspectives including contrasting viewpoints
      4. Identifies patterns, trends and broader implications
      5. Connects facts to create meaningful insights
      6. Provides context that helps understand the significance
      
      AVOID:
      - Filler phrases and unnecessary commentary
      - Surface-level summaries without analytical depth
      - Redundant information
      - Vague generalizations
    `;
    
    const result = await model.generateContent(synthesisPrompt);
    const responseText = result.response.text();
    
    return responseText;
  } catch (error) {
    console.error(`Error synthesizing research for topic "${topic.topic}":`, error);
    return `Synthesis failed for ${topic.topic}.`;
  }
}

/**
 * Creates an overall synthesis for the episode
 * @param plan Episode plan
 * @param topicResearch Detailed research results for each topic
 * @returns Overall synthesis
 */
async function createOverallSynthesis(
  plan: EpisodePlan,
  topicResearch: Array<{
    topic: string;
    mainResearch: {
      content: string;
      sources: string[];
    };
    contrastingViewpoints: {
      content: string;
      sources: string[];
    };
    synthesizedContent: string;
  }>
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log('Creating overall synthesis for the episode');
    
    // Generate prompt to create overall synthesis with full topic content
    const synthesisPrompt = `
      Create a comprehensive overall synthesis for an episode titled "${plan.episodeTitle}" that:
      
      1. Integrates research from all topics into a cohesive narrative
      2. Highlights key findings, patterns, and connections ACROSS topics
      3. Implements this differentiation strategy: ${plan.differentiationStrategy}
      4. Provides meaningful analysis that goes beyond surface-level reporting
      5. Presents multiple perspectives where relevant
      6. Creates a coherent flow between different topics
      
      Topic research to synthesize:
      ${topicResearch.map(tr => `
      --- Topic: ${tr.topic} ---
      ${tr.synthesizedContent}
      `).join('\n\n')}
      
      FORMAT REQUIREMENTS:
      - Create a flowing narrative, not a topic-by-topic structure
      - Use substantive transitions between related ideas
      - Maintain an analytical news podcast tone
      - Focus on insights and analysis rather than just reporting facts
      - Avoid filler phrases and superficial commentary
      
      STRICT AVOIDANCE:
      - Filler phrases like "it's important to note," "as we can see," etc.
      - Redundant information that repeats across topics
      - Surface-level summaries without analytical depth
      - Vague generalizations or oversimplifications
      
      Create a sophisticated, insightful synthesis that delivers substantive analysis.
    `;
    
    const result = await model.generateContent(synthesisPrompt);
    const responseText = result.response.text();
    
    return responseText;
  } catch (error) {
    console.error('Error creating overall synthesis:', error);
    // Fallback: just join the individual topic syntheses
    return topicResearch.map(t => t.synthesizedContent).join('\n\n---\n\n');
  }
}

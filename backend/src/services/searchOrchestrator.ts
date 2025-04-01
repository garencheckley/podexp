import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeWebSearch } from './search';
import { EpisodeAnalysis } from './episodeAnalyzer';
import { Podcast } from './database';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const modelId = 'gemini-2.0-flash';
const model = genAI.getGenerativeModel({ model: modelId });

/**
 * Interface for search results from initial exploration
 */
export interface SearchResults {
  potentialTopics: Array<{ topic: string; relevance: number; query: string }>;
  relevantSources: string[];
  recencyMapping: { [topic: string]: string };
  combinedResearch?: string;
  allSources?: string[];
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
 * Performs initial exploratory search based on podcast info and previous episode analysis
 * @param podcast Podcast information
 * @param analysis Previous episode analysis
 * @returns Initial search results with potential topics
 */
export async function performInitialSearch(
  podcast: Podcast,
  analysis: EpisodeAnalysis
): Promise<SearchResults> {
  try {
    console.log(`Performing initial search for podcast: ${podcast.title}`);
    
    // Generate search queries based on podcast prompt and analysis
    const searchQueries = await generateExploratoryQueries(podcast, analysis);
    console.log(`Generated ${searchQueries.length} exploratory search queries`);
    
    // Execute searches in parallel
    const searchResultsPromises = searchQueries.map(query => executeWebSearch(query));
    const searchResultsArray = await Promise.all(searchResultsPromises);
    
    console.log('All initial searches completed');
    
    // Identify potential topics from search results
    const potentialTopicsResponse = await identifyPotentialTopics(searchResultsArray, analysis, podcast);
    
    return potentialTopicsResponse;
  } catch (error) {
    console.error('Error performing initial search:', error);
    return {
      potentialTopics: [],
      relevantSources: [],
      recencyMapping: {}
    };
  }
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
    
    // Use Gemini to identify potential topics
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
      combinedResearch: '',
      allSources: []
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
    const topicResearchPromises = plan.selectedTopics.map(async topic => {
      // Deep research on main topic
      const mainQueries = topic.furtherResearchNeeded;
      const mainResearchResults = await executeMultipleSearches(mainQueries);
      
      // Find contrasting viewpoints
      const contrastingViewpoints = await findContrastingViewpoints(topic.topic, mainResearchResults.content);
      
      // Synthesize research for this topic
      const synthesizedContent = await synthesizeTopicResearch(
        topic,
        mainResearchResults,
        contrastingViewpoints
      );
      
      return {
        topic: topic.topic,
        mainResearch: mainResearchResults,
        contrastingViewpoints,
        synthesizedContent
      };
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
  try {
    console.log(`Finding contrasting viewpoints for topic: "${topic}"`);
    
    // Generate queries to find contrasting viewpoints
    const contrastingQueriesPrompt = `
      Based on this research about "${topic}", generate 2 search queries specifically designed 
      to find contrasting viewpoints or alternative perspectives.
      
      Research summary:
      ${mainResearch.substring(0, 2000)}
      
      Generate search queries in this format:
      ["query1", "query2"]
    `;
    
    const result = await model.generateContent(contrastingQueriesPrompt);
    const responseText = result.response.text();
    
    try {
      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const queries = JSON.parse(cleanedResponse);
      
      if (Array.isArray(queries) && queries.length > 0) {
        return executeMultipleSearches(queries);
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
    console.error('Error finding contrasting viewpoints:', error);
    return {
      content: '',
      sources: []
    };
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
  try {
    console.log(`Synthesizing research for topic: "${topic.topic}"`);
    
    // Generate prompt to synthesize research
    const synthesisPrompt = `
      Based on this research about "${topic.topic}", synthesize a ${topic.targetDepth} summary
      that explores these angles: ${topic.angles.join(', ')}.
      
      Main research:
      ${mainResearch.content.substring(0, 2000)}
      
      Contrasting viewpoints:
      ${contrastingViewpoints.content.substring(0, 2000)}
      
      Synthesize the research in a coherent and engaging manner.
    `;
    
    const result = await model.generateContent(synthesisPrompt);
    const responseText = result.response.text();
    
    return responseText;
  } catch (error) {
    console.error('Error synthesizing topic research:', error);
    return "Synthesis could not be completed due to an error.";
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
  try {
    console.log(`Creating overall synthesis for episode: "${plan.episodeTitle}"`);
    
    // Generate prompt to create overall synthesis
    const synthesisPrompt = `
      Based on the research for this episode, create an overall synthesis that:
      1. Summarizes the main findings of each topic
      2. Highlights the key takeaways
      3. Provides a coherent narrative
      4. Uses the differentiation strategy: ${plan.differentiationStrategy}
      
      Topic research:
      ${topicResearch.map(tr => `- ${tr.topic}: ${tr.synthesizedContent}`).join('\n')}
      
      Create a coherent and engaging overall synthesis.
    `;
    
    const result = await model.generateContent(synthesisPrompt);
    const responseText = result.response.text();
    
    return responseText;
  } catch (error) {
    console.error('Error creating overall synthesis:', error);
    return "Overall synthesis could not be completed due to an error.";
  }
}

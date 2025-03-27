import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeWebSearch } from './search';
import { EpisodeAnalysis } from './episodeAnalyzer';
import { SearchResults, EpisodePlan } from './searchOrchestrator';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const modelId = 'gemini-2.0-flash';
const model = genAI.getGenerativeModel({ model: modelId });

/**
 * Interface for a topic to be deeply researched
 */
export interface DeepResearchTopic {
  topic: string;
  importance: number;  // 1-10 scale where 10 is highest importance
  newsworthiness: number;  // 1-10 scale where 10 is highest newsworthiness
  depthPotential: number;  // 1-10 scale where 10 is highest potential for depth
  rationale: string;
  keyQuestions: string[];  // Questions that should be answered in research
  searchQueries: string[];  // Queries to use for research
}

/**
 * Interface for multi-layer research results
 */
export interface LayeredResearchResults {
  topic: string;
  layers: Array<{
    level: number;  // 1 = surface, 2 = intermediate, 3 = deep
    content: string;
    sources: string[];
    keyInsights: string[];
  }>;
  synthesizedContent: string;
  depthMetrics: {
    factualDensity: number;  // 1-10 scale
    insightScore: number;    // 1-10 scale
    contextualDepth: number; // 1-10 scale
    overallDepthScore: number;  // 1-10 scale
  };
}

/**
 * Interface for overall deep dive research results
 */
export interface DeepDiveResults {
  researchedTopics: LayeredResearchResults[];
  topicDistribution: Array<{
    topic: string;
    allocation: number;  // percentage of total content
  }>;
  allSources: string[];
  overallContent: string;
}

/**
 * Analyzes potential topics and prioritizes them for deep research
 * @param topics List of potential topics from the search orchestrator
 * @param analysis Previous episode analysis
 * @param targetWordCount Target word count for the episode
 * @returns Prioritized list of topics for deep research
 */
export async function prioritizeTopicsForDeepDive(
  searchResults: SearchResults,
  analysis: EpisodeAnalysis,
  targetWordCount: number
): Promise<DeepResearchTopic[]> {
  try {
    console.log('Prioritizing topics for deep dive research');
    
    // Calculate optimal number of topics based on target length
    // For deeper research, we want fewer topics with more depth
    const optimalTopicCount = Math.max(
      1,
      Math.min(
        3,  // Max 3 topics for any episode
        Math.floor(targetWordCount / 300)  // Roughly 1 topic per 300 words
      )
    );
    
    console.log(`Optimal topic count for ${targetWordCount} words: ${optimalTopicCount}`);
    
    // Use Gemini to prioritize and select topics
    const prioritizationPrompt = `
      Analyze these potential topics and prioritize them for deep research.
      We want to focus on ${optimalTopicCount} topics with maximum depth potential.
      
      Potential topics:
      ${searchResults.potentialTopics.map(t => `- ${t.topic} (relevance: ${t.relevance}/10)`).join('\n')}
      
      Previously covered topics:
      ${analysis.recentTopics.map(t => `- ${t.topic} (mentioned ${t.frequency} times)`).join('\n')}
      
      For each topic, provide:
      1. Topic name
      2. Importance score (1-10)
      3. Newsworthiness score (1-10)
      4. Depth potential score (1-10)
      5. Rationale for selection
      6. 3-5 key questions that deep research should answer
      7. 3-5 search queries for multi-level research
      
      Focus on selecting:
      - Topics with high newsworthiness and depth potential
      - Topics that haven't been extensively covered before
      - Topics that would benefit most from in-depth exploration
      - Topics that would provide valuable insights to listeners
      
      Respond in JSON format:
      {
        "prioritizedTopics": [
          {
            "topic": "Topic name",
            "importance": 8,
            "newsworthiness": 9,
            "depthPotential": 7,
            "rationale": "Why this topic deserves deep research",
            "keyQuestions": ["Question 1", "Question 2", "Question 3"],
            "searchQueries": ["Query 1", "Query 2", "Query 3"]
          },
          ...
        ]
      }
      
      Limit your response to the top ${optimalTopicCount * 2} topics, ordered by priority.
    `;
    
    const result = await model.generateContent(prioritizationPrompt);
    const responseText = result.response.text();
    
    try {
      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const prioritizationResult = JSON.parse(cleanedResponse);
      
      if (prioritizationResult.prioritizedTopics && Array.isArray(prioritizationResult.prioritizedTopics)) {
        // Take only the top N topics based on optimal count
        const topTopics = prioritizationResult.prioritizedTopics
          .slice(0, optimalTopicCount);
        
        console.log(`Selected ${topTopics.length} topics for deep research`);
        return topTopics;
      } else {
        console.error('Invalid topic prioritization format:', cleanedResponse);
        return [];
      }
    } catch (parseError) {
      console.error('Error parsing topic prioritization:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Error prioritizing topics for deep dive:', error);
    return [];
  }
}

/**
 * Conducts multi-layer deep research on a topic
 * @param topic The deep research topic
 * @returns Layered research results
 */
export async function conductLayeredResearch(topic: DeepResearchTopic): Promise<LayeredResearchResults> {
  try {
    console.log(`Conducting layered research for topic: "${topic.topic}"`);
    
    // Layer 1: Surface level research (primary information)
    console.log('Conducting Layer 1 (Surface) research');
    const layer1Queries = [topic.searchQueries[0]]; // Use first query for surface layer
    const layer1Results = await executeMultipleSearches(layer1Queries);
    
    // Extract key insights from surface level
    const layer1Insights = await extractKeyInsights(layer1Results.content, topic.topic, 1);
    
    // Layer 2: Intermediate depth (additional context and details)
    console.log('Conducting Layer 2 (Intermediate) research');
    // Use remaining initial queries plus follow-up based on layer 1 insights
    const layer2Queries = [...topic.searchQueries.slice(1), 
                          ...generateFollowupQueries(topic.topic, layer1Insights)];
    const layer2Results = await executeMultipleSearches(layer2Queries.slice(0, 3)); // Limit to 3 queries
    
    // Extract key insights from intermediate level
    const layer2Insights = await extractKeyInsights(layer2Results.content, topic.topic, 2);
    
    // Layer 3: Deep dive (expert analysis, implications, nuances)
    console.log('Conducting Layer 3 (Deep) research');
    // Generate sophisticated queries based on insights from layers 1 & 2
    const layer3Queries = generateDeepDiveQueries(topic, [...layer1Insights, ...layer2Insights]);
    const layer3Results = await executeMultipleSearches(layer3Queries);
    
    // Extract key insights from deep level
    const layer3Insights = await extractKeyInsights(layer3Results.content, topic.topic, 3);
    
    // Compile all layers
    const layers = [
      {
        level: 1,
        content: layer1Results.content,
        sources: layer1Results.sources,
        keyInsights: layer1Insights
      },
      {
        level: 2,
        content: layer2Results.content,
        sources: layer2Results.sources,
        keyInsights: layer2Insights
      },
      {
        level: 3,
        content: layer3Results.content,
        sources: layer3Results.sources,
        keyInsights: layer3Insights
      }
    ];
    
    // Synthesize findings across all layers
    const synthesizedContent = await synthesizeLayeredResearch(topic, layers);
    
    // Calculate depth metrics
    const depthMetrics = await calculateDepthMetrics(topic, layers, synthesizedContent);
    
    return {
      topic: topic.topic,
      layers,
      synthesizedContent,
      depthMetrics
    };
  } catch (error) {
    console.error(`Error conducting layered research for topic "${topic.topic}":`, error);
    // Return a minimal result on error
    return {
      topic: topic.topic,
      layers: [],
      synthesizedContent: `Research on ${topic.topic} could not be completed due to an error.`,
      depthMetrics: {
        factualDensity: 0,
        insightScore: 0,
        contextualDepth: 0,
        overallDepthScore: 0
      }
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
 * Extracts key insights from research content
 * @param content Research content
 * @param topic The topic being researched
 * @param level The research level (1-3)
 * @returns Array of key insights
 */
async function extractKeyInsights(
  content: string,
  topic: string,
  level: number
): Promise<string[]> {
  try {
    console.log(`Extracting key insights for ${topic} at level ${level}`);
    
    const levelDescriptions = {
      1: "surface-level, factual information",
      2: "intermediate details and additional context",
      3: "deep analysis, expert perspectives, and implications"
    };
    
    const insightsPrompt = `
      Extract key insights from this research on "${topic}".
      Focus on ${levelDescriptions[level as keyof typeof levelDescriptions]}.
      
      Research content:
      ${content.substring(0, 6000)}
      
      Extract 5-7 key insights that represent the most valuable information.
      Each insight should be concise (1-2 sentences) but substantive.
      
      Respond in JSON format:
      ["Insight 1", "Insight 2", ...]
    `;
    
    const result = await model.generateContent(insightsPrompt);
    const responseText = result.response.text();
    
    try {
      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const insights = JSON.parse(cleanedResponse);
      
      if (Array.isArray(insights)) {
        return insights;
      } else {
        console.error('Invalid insights format:', cleanedResponse);
        return [];
      }
    } catch (parseError) {
      console.error('Error parsing insights:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Error extracting key insights:', error);
    return [];
  }
}

/**
 * Generates follow-up queries based on initial insights
 * @param topic The topic being researched
 * @param insights Initial insights
 * @returns Array of follow-up queries
 */
function generateFollowupQueries(topic: string, insights: string[]): string[] {
  // Take up to 3 insights and generate follow-up queries
  const followupQueries = insights.slice(0, 3).map(insight => {
    // Extract key concepts from the insight
    const insightWords = insight
      .replace(/[^\w\s]/gi, '')
      .split(' ')
      .filter(word => word.length > 4);
    
    // Choose 2-3 key words to focus the follow-up query
    const keyWords = insightWords
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(3, insightWords.length))
      .join(' ');
    
    return `${topic} ${keyWords} detailed analysis`;
  });
  
  return followupQueries;
}

/**
 * Generates deep dive queries for expert analysis and implications
 * @param topic The deep research topic
 * @param insights Insights from previous research layers
 * @returns Array of deep dive queries
 */
function generateDeepDiveQueries(topic: DeepResearchTopic, insights: string[]): string[] {
  const queries = [];
  
  // Add expert analysis query
  queries.push(`expert analysis of ${topic.topic} implications`);
  
  // Use key questions from the topic
  topic.keyQuestions.forEach(question => {
    queries.push(`${topic.topic} ${question}`);
  });
  
  // Generate nuanced queries based on insights
  if (insights.length > 0) {
    // Take a random insight and convert it to a query
    const randomInsight = insights[Math.floor(Math.random() * insights.length)];
    queries.push(`${topic.topic} ${randomInsight.substring(0, 50)}`);
  }
  
  // Add a historical or future implications query
  queries.push(`${topic.topic} historical context and future implications`);
  
  // Limit to 3-4 queries to manage API usage
  return queries.slice(0, 4);
}

/**
 * Synthesizes findings across all research layers
 * @param topic The deep research topic
 * @param layers The research layers
 * @returns Synthesized content
 */
async function synthesizeLayeredResearch(
  topic: DeepResearchTopic,
  layers: Array<{
    level: number;
    content: string;
    sources: string[];
    keyInsights: string[];
  }>
): Promise<string> {
  try {
    console.log(`Synthesizing layered research for topic: "${topic.topic}"`);
    
    // Combine key insights from all layers
    const allInsights = layers.flatMap(layer => 
      layer.keyInsights.map(insight => `[Level ${layer.level}] ${insight}`)
    );
    
    const synthesisPrompt = `
      Synthesize this multi-layer research on "${topic.topic}" into a cohesive narrative.
      
      Key insights from different research layers:
      ${allInsights.join('\n')}
      
      Key questions this research should answer:
      ${topic.keyQuestions.join('\n')}
      
      Create a comprehensive synthesis that:
      1. Introduces the topic and its significance
      2. Presents factual information from surface research
      3. Adds context and details from intermediate research
      4. Incorporates expert analysis and implications from deep research
      5. Addresses the key questions listed above
      6. Concludes with significance and implications
      
      The synthesis should be well-structured, flowing naturally between levels of depth.
      Aim for around 600-800 words of substantive, insight-rich content.
    `;
    
    const result = await model.generateContent(synthesisPrompt);
    return result.response.text();
  } catch (error) {
    console.error(`Error synthesizing research for topic "${topic.topic}":`, error);
    return `Research synthesis for ${topic.topic} could not be completed due to an error.`;
  }
}

/**
 * Calculates depth metrics for the research
 * @param topic The deep research topic
 * @param layers The research layers
 * @param synthesizedContent The synthesized content
 * @returns Depth metrics
 */
async function calculateDepthMetrics(
  topic: DeepResearchTopic,
  layers: Array<{
    level: number;
    content: string;
    sources: string[];
    keyInsights: string[];
  }>,
  synthesizedContent: string
): Promise<{
  factualDensity: number;
  insightScore: number;
  contextualDepth: number;
  overallDepthScore: number;
}> {
  try {
    console.log(`Calculating depth metrics for topic: "${topic.topic}"`);
    
    const metricsPrompt = `
      Evaluate the depth of this research on "${topic.topic}".
      
      Synthesized content:
      ${synthesizedContent.substring(0, 6000)}
      
      Key questions that should be addressed:
      ${topic.keyQuestions.join('\n')}
      
      Number of sources: ${new Set(layers.flatMap(l => l.sources)).size}
      Number of insights: ${layers.reduce((sum, l) => sum + l.keyInsights.length, 0)}
      
      Evaluate on these metrics (scale 1-10):
      1. Factual Density: How rich in specific facts, figures, and concrete information
      2. Insight Score: How well it provides analysis and "so what" beyond just facts
      3. Contextual Depth: How well it provides historical context and broader implications
      4. Overall Depth Score: Comprehensive assessment of depth quality
      
      Respond in JSON format:
      {
        "factualDensity": 8,
        "insightScore": 7,
        "contextualDepth": 9,
        "overallDepthScore": 8
      }
    `;
    
    const result = await model.generateContent(metricsPrompt);
    const responseText = result.response.text();
    
    try {
      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const metrics = JSON.parse(cleanedResponse);
      
      return {
        factualDensity: metrics.factualDensity || 5,
        insightScore: metrics.insightScore || 5,
        contextualDepth: metrics.contextualDepth || 5,
        overallDepthScore: metrics.overallDepthScore || 5
      };
    } catch (parseError) {
      console.error('Error parsing depth metrics:', parseError);
      return {
        factualDensity: 5,
        insightScore: 5,
        contextualDepth: 5,
        overallDepthScore: 5
      };
    }
  } catch (error) {
    console.error(`Error calculating depth metrics for topic "${topic.topic}":`, error);
    return {
      factualDensity: 5,
      insightScore: 5,
      contextualDepth: 5,
      overallDepthScore: 5
    };
  }
}

/**
 * Conducts deep dive research on a set of prioritized topics
 * @param prioritizedTopics Array of topics prioritized for deep research
 * @returns Comprehensive deep dive research results
 */
export async function conductDeepDiveResearch(
  prioritizedTopics: DeepResearchTopic[],
  targetWordCount: number
): Promise<DeepDiveResults> {
  try {
    console.log(`Starting deep dive research for ${prioritizedTopics.length} topics`);
    
    // Research each topic in parallel for efficiency
    const topicResearchPromises = prioritizedTopics.map(topic => 
      conductLayeredResearch(topic)
    );
    
    const researchedTopics = await Promise.all(topicResearchPromises);
    console.log(`Completed deep research for ${researchedTopics.length} topics`);
    
    // Calculate optimal word allocation based on topic importance
    const totalImportance = prioritizedTopics.reduce((sum, topic) => sum + topic.importance, 0);
    
    const topicDistribution = prioritizedTopics.map((topic, index) => {
      const importanceRatio = topic.importance / totalImportance;
      const allocation = Math.round(importanceRatio * 100); // As percentage
      
      return {
        topic: topic.topic,
        allocation
      };
    });
    
    // Collect all sources
    const allSources = [...new Set(
      researchedTopics.flatMap(research => 
        research.layers.flatMap(layer => layer.sources)
      )
    )];
    
    // Generate overall content that integrates all topics
    const overallContent = await generateIntegratedContent(
      researchedTopics,
      topicDistribution,
      targetWordCount
    );
    
    return {
      researchedTopics,
      topicDistribution,
      allSources,
      overallContent
    };
  } catch (error) {
    console.error('Error conducting deep dive research:', error);
    return {
      researchedTopics: [],
      topicDistribution: [],
      allSources: [],
      overallContent: 'Deep dive research could not be completed due to an error.'
    };
  }
}

/**
 * Generates integrated content from multiple deep-researched topics
 * @param researchedTopics Array of deeply researched topics
 * @param topicDistribution Distribution of content across topics
 * @param targetWordCount Target word count for the overall content
 * @returns Integrated content
 */
async function generateIntegratedContent(
  researchedTopics: LayeredResearchResults[],
  topicDistribution: Array<{ topic: string; allocation: number }>,
  targetWordCount: number
): Promise<string> {
  try {
    console.log('Generating integrated content from deep research');
    
    const topicsContent = researchedTopics.map((research, index) => {
      const distribution = topicDistribution.find(d => d.topic === research.topic);
      
      return {
        topic: research.topic,
        content: research.synthesizedContent,
        allocation: distribution?.allocation || 0,
        depthScore: research.depthMetrics.overallDepthScore
      };
    });
    
    const integrationPrompt = `
      Create a cohesive podcast episode script that integrates these deeply-researched topics.
      
      Target length: ${targetWordCount} words
      
      Topics to cover:
      ${topicsContent.map(t => `- ${t.topic} (${t.allocation}% of content, depth score: ${t.depthScore}/10)`).join('\n')}
      
      For each topic, here is the research synthesis:
      
      ${topicsContent.map(t => `
      ## ${t.topic}
      ${t.content.substring(0, 2000)}
      `).join('\n\n')}
      
      Create an integrated narrative that:
      1. Flows naturally between topics with smooth transitions
      2. Maintains appropriate depth for each topic
      3. Allocates content according to the specified percentages
      4. Creates connections between related topics where possible
      5. Has a clear introduction, body, and conclusion
      6. Feels like a cohesive episode, not disjointed sections
      
      IMPORTANT FORMAT REQUIREMENTS:
      1. Write in plain text with plain punctuation only - NO markdown formatting
      2. DO NOT include audio instructions like "(upbeat music)" or "(pause)"
      3. DO NOT include speaker indicators like "Host:" or "Speaker:"
      4. DO NOT include section headers or transition markers
      5. Avoid using bold, italics, or other formatting that won't be recognized by text-to-speech
      6. Write in a conversational style but without explicitly marking the speaker
      
      The content should be podcast-ready, conversational yet substantive,
      and structured to maintain listener engagement throughout.
    `;
    
    const result = await model.generateContent(integrationPrompt);
    return result.response.text();
  } catch (error) {
    console.error('Error generating integrated content:', error);
    
    // Fallback: Just concatenate the synthesized content from each topic
    return researchedTopics
      .map(research => `${research.topic}\n\n${research.synthesizedContent}`)
      .join('\n\n');
  }
} 
import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeWebSearch } from './search';
import { EpisodeAnalysis } from './episodeAnalyzer';
import { SearchResults, EpisodePlan } from './searchOrchestrator';
import { FAST_MODEL_ID, POWERFUL_MODEL_ID } from '../config';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
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
  const model = genAI.getGenerativeModel({ model: FAST_MODEL_ID });
  try {
    console.log(`Extracting Key Insights - Level ${level} for Topic: "${topic}"`);
    // Limit content length to avoid exceeding model limits, especially for flash
    const maxInputLength = 15000; // Adjust as needed for flash model limits
    const truncatedContent = content.length > maxInputLength
      ? content.substring(0, maxInputLength)
      : content;
    
    const levelDescriptions = {
      1: "surface-level, factual information",
      2: "intermediate details and additional context",
      3: "deep analysis, expert perspectives, and implications"
    };
    
    const prompt = `
      Extract key insights from this research on "${topic}".
      Focus on ${levelDescriptions[level as keyof typeof levelDescriptions]}.
      
      Research content:
      ${truncatedContent}
      
      Extract 5-7 key insights that represent the most valuable information.
      Each insight should be concise (1-2 sentences) but substantive.
      
      Respond in JSON format:
      ["Insight 1", "Insight 2", ...]
    `;
    
    const result = await model.generateContent(prompt);
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
    console.error(`Error extracting key insights for topic "${topic}" at level ${level}:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Generates follow-up queries based on initial insights
 * @param topic The topic being researched
 * @param insights Initial insights
 * @returns Array of follow-up queries
 */
function generateFollowupQueries(topic: string, insights: string[]): string[] {
  // Simple generation, fast model likely sufficient - Assuming no direct AI call needed here based on current impl.
  // If an AI call were added here, it would use FAST_MODEL_ID
  console.log(`Generating Followup Queries for Topic: "${topic}"`);
  if (insights.length === 0) {
    return [`latest updates on ${topic}`];
  }
  // Simple logic, no AI call currently
  return insights.slice(0, 3).map(insight => `${topic} ${insight.substring(0, 50)} details`);
}

/**
 * Generates deep dive queries for expert analysis and implications
 * @param topic The deep research topic
 * @param insights Insights from previous research layers
 * @returns Array of deep dive queries
 */
function generateDeepDiveQueries(topic: DeepResearchTopic, insights: string[]): string[] {
   // More complex, but let's try fast model first - Assuming no direct AI call needed here based on current impl.
   // If an AI call were added here, it would use FAST_MODEL_ID
  console.log(`Generating Deep Dive Queries for Topic: "${topic.topic}"`);
  const baseQueries = [
    `expert analysis ${topic.topic}`,
    `implications of ${topic.topic}`,
    `historical context ${topic.topic}`,
    `future predictions ${topic.topic}`,
    `contrasting views ${topic.topic}`
  ];
  // Add queries derived from key questions and insights
  const insightQueries = insights.slice(0, 2).map(i => `deep analysis of ${i.substring(0,60)} regarding ${topic.topic}`);
  const questionQueries = topic.keyQuestions.slice(0, 2).map(q => `in-depth research ${q}`);

  return [...baseQueries, ...insightQueries, ...questionQueries].slice(0, 5); // Limit total queries
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
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log(`Synthesizing layered research for topic: "${topic.topic}"`);
    
    // Prepare combined content for synthesis, prioritizing deeper layers
    // Concatenate insights and key content snippets - might need adjustment based on token limits
    let synthesisInput = `Topic: ${topic.topic}\nKey Questions to Answer:\n${topic.keyQuestions.join('\\n- ')}\n\n`;
    synthesisInput += "Key Insights & Content from Research Layers:\n";
    layers.forEach(layer => {
      synthesisInput += `\n--- Layer ${layer.level} ---\n`;
      synthesisInput += `Insights: ${layer.keyInsights.join(', ')}\n`;
      // Add a snippet of content - avoid overwhelming the model
      synthesisInput += `Content Snippet: ${layer.content.substring(0, 1000)}...\n`;
    });

    const synthesisPrompt = `
      Synthesize the following research findings for the topic "${topic.topic}" into a cohesive narrative (approx 400-600 words).
      Focus on answering the key questions provided. Integrate insights from all layers (surface, intermediate, deep).
      Ensure a logical flow, starting with basics and moving to deeper analysis and implications.
      Maintain an objective, analytical tone suitable for a news podcast.
      DO NOT just list facts; provide context and analysis.
      Prioritize insights from Layer 3 (deep research).

      Research Input:
      ${synthesisInput.substring(0, 30000)} // Limit input size for safety

      Generate only the synthesized narrative text.
    `;

    const result = await model.generateContent(synthesisPrompt);
    return result.response.text();
  } catch (error) {
    console.error(`Error synthesizing research for topic "${topic.topic}":`, error);
    return `Synthesis failed for topic: ${topic.topic}.`;
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
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log(`Calculating depth metrics for topic: "${topic.topic}"`);
    
    const metricsPrompt = `
      Analyze the following synthesized content for the topic "${topic.topic}".
      Evaluate its depth based on factual density, insight quality, and contextual richness.

      Synthesized Content:
      ${synthesizedContent.substring(0, 15000)} // Limit input size

      Rate the following metrics on a scale of 1-10 (1=low, 10=high):
      1. Factual Density: Concentration of specific facts, figures, concrete info.
      2. Insight Score: Quality of analysis, interpretation, going beyond surface facts.
      3. Contextual Depth: Provision of background, historical context, implications.

      Respond ONLY in JSON format:
      {
        "factualDensity": <number>,
        "insightScore": <number>,
        "contextualDepth": <number>
      }
    `;

    const result = await model.generateContent(metricsPrompt);
    const responseText = result.response.text();
    const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
    const metrics = JSON.parse(cleanedResponse);

    // Calculate overall score (simple average for now)
    const overallDepthScore = Math.round(
      (metrics.factualDensity + metrics.insightScore + metrics.contextualDepth) / 3
    );

    return {
      ...metrics,
      overallDepthScore
    };

  } catch (error) {
    console.error(`Error calculating depth metrics for topic "${topic.topic}":`, error);
    return { factualDensity: 0, insightScore: 0, contextualDepth: 0, overallDepthScore: 0 };
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
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log('Generating integrated podcast script content');

    let combinedResearch = "Synthesized Research for Podcast Episode:\n\n";
    researchedTopics.forEach(topicResult => {
      const allocation = topicDistribution.find(d => d.topic === topicResult.topic)?.allocation || (100 / researchedTopics.length);
      const estimatedWords = Math.round(targetWordCount * (allocation / 100));
      combinedResearch += `--- Topic: ${topicResult.topic} (Target Length: ~${estimatedWords} words) ---\n`;
      combinedResearch += `Overall Depth Score: ${topicResult.depthMetrics.overallDepthScore}/10\n`;
      combinedResearch += `Synthesized Content:\n${topicResult.synthesizedContent}\n\n`;
    });

    const generationPrompt = `
      You are a podcast script writer. Write a cohesive and engaging podcast script section based on the provided synthesized research for multiple topics.
      Target total word count: ${targetWordCount} words.
      Allocate content according to the target length suggested for each topic.
      Ensure smooth transitions between topics.
      Maintain an objective, analytical, and informative tone suitable for a news podcast.
      Focus on delivering insights and context, not just facts. Avoid fluff or filler phrases.
      Start directly with the content, no intro/outro needed for this section.
      Structure the content logically within each topic and across the episode segment.

      CRITICAL FORMAT REQUIREMENTS:
      1. DO NOT include any speaker indicators like "Host:" or "Speaker:"
      2. DO NOT include any audio instructions like "(upbeat music)" or "(pause)"
      3. NEVER include text that can't be read aloud like "(Podcast Intro Music Fades)" or "(Podcast Outro Music Fades In)"
      4. NEVER reference specific time periods like "monthly update" or "April 2025 update" - keep content timeless
      5. AVOID assumptions about publication frequency (daily, weekly, monthly)
      6. Use only plain text with standard punctuation (periods, commas, question marks)

      Synthesized Research Input:
      ${combinedResearch.substring(0, 30000)} // Limit input size

      Generate ONLY the integrated podcast script content.
    `;

    const result = await model.generateContent(generationPrompt);
    return result.response.text();

  } catch (error) {
    console.error('Error generating integrated podcast content:', error);
    return "Failed to generate integrated podcast content due to an internal error.";
  }
} 
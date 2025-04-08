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

// Define the new input structure for cluster summaries
export interface ClusterSummaryInput {
  clusterId: number;
  summary: string;
  originalTopicIds: string[];
}

/**
 * Analyzes cluster summaries and prioritizes them for deep research
 * @param clusterSummaries Array of cluster summaries with original topic IDs
 * @param analysis Previous episode analysis
 * @param targetWordCount Target word count for the episode
 * @returns Prioritized list of topics (represented by clusters) for deep research
 */
export async function prioritizeTopicsForDeepDive(
  clusterSummaries: ClusterSummaryInput[],
  analysis: EpisodeAnalysis,
  targetWordCount: number
): Promise<DeepResearchTopic[]> {
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log('Prioritizing topic clusters for deep dive research');

    if (!clusterSummaries || clusterSummaries.length === 0) {
        console.log('No cluster summaries provided for prioritization.');
        return [];
    }
    
    // Calculate optimal number of topics (clusters) based on target length
    const optimalTopicCount = Math.max(
      1,
      Math.min(
        3,  // Max 3 topics/clusters for any episode
        Math.floor(targetWordCount / 300)  // Roughly 1 cluster per 300 words
      )
    );
    
    console.log(`Optimal cluster count for ${targetWordCount} words: ${optimalTopicCount}`);
    
    // Use Gemini to prioritize and select clusters
    const prioritizationPrompt = `
      Analyze these topic cluster summaries and prioritize them for deep research.
      We want to focus on ${optimalTopicCount} cluster(s) with maximum depth potential.
      
      Topic Clusters:
      ${clusterSummaries.map(c => `- Cluster ${c.clusterId}: "${c.summary}" (Original Topics: ${c.originalTopicIds.join(', ')})`).join('\n')}
      
      Previously covered individual topics (check against 'Original Topics' above):
      ${analysis.recentTopics.map(t => `- ${t.topic} (mentioned ${t.frequency} times)`).join('\n')}
      
      For each cluster summary, provide:
      1. Cluster ID (from the input)
      2. Cluster Summary (from the input)
      3. Importance score (1-10)
      4. Newsworthiness score (1-10)
      5. Depth potential score (1-10)
      6. Rationale for selection (consider the cluster theme and avoidance of previously covered topics)
      7. 3-5 key questions that deep research into this cluster's theme should answer
      8. 3-5 broad search queries for multi-level research into this cluster's theme
      
      Focus on selecting clusters:
      - With high newsworthiness and depth potential based on their summary
      - Whose original topics haven't been extensively covered before
      - Whose themes would benefit most from in-depth exploration
      - Whose themes would provide valuable insights to listeners
      
      Respond in JSON format:
      {
        "prioritizedClusters": [
          {
            "clusterId": 1,
            "clusterSummary": "Summary text",
            "importance": 8,
            "newsworthiness": 9,
            "depthPotential": 7,
            "rationale": "Why this cluster theme deserves deep research",
            "keyQuestions": ["Question 1", "Question 2", "Question 3"],
            "searchQueries": ["Query for cluster theme 1", "Query 2", "Query 3"]
          },
          ...
        ]
      }
      
      Limit your response to the top ${optimalTopicCount * 2} clusters, ordered by priority.
    `;
    
    const result = await model.generateContent(prioritizationPrompt);
    const responseText = result.response.text();
    
    try {
      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const prioritizationResult = JSON.parse(cleanedResponse);
      
      if (prioritizationResult.prioritizedClusters && Array.isArray(prioritizationResult.prioritizedClusters)) {
        // Take only the top N clusters based on optimal count
        const topClusters = prioritizationResult.prioritizedClusters
          .slice(0, optimalTopicCount);
          
        // Transform the prioritized cluster data into DeepResearchTopic format
        const deepResearchTopics: DeepResearchTopic[] = topClusters.map((cluster: any) => ({
            topic: cluster.clusterSummary, // Use the cluster summary as the main topic name
            importance: cluster.importance,
            newsworthiness: cluster.newsworthiness,
            depthPotential: cluster.depthPotential,
            rationale: cluster.rationale,
            keyQuestions: cluster.keyQuestions,
            searchQueries: cluster.searchQueries,
            // Optional: Could add clusterId or originalTopicIds here if needed later
        }));
        
        console.log(`Selected ${deepResearchTopics.length} topic clusters for deep research`);
        return deepResearchTopics;
      } else {
        console.error('Invalid topic cluster prioritization format:', cleanedResponse);
        return [];
      }
    } catch (parseError) {
      console.error('Error parsing topic cluster prioritization:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Error prioritizing topic clusters for deep dive:', error);
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
    const layer3Queries = await generateDeepDiveQueries(topic, [...layer1Insights, ...layer2Insights]);
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
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log(`Extracting Key Insights - Level ${level} for Topic: "${topic}"`);
    // Limit content length to avoid exceeding model limits, even for powerful model
    const maxInputLength = 30000; // Increased limit for powerful model
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
async function generateDeepDiveQueries(topic: DeepResearchTopic, insights: string[]): Promise<string[]> {
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log(`Generating Deep Dive Queries for Topic: "${topic.topic}"`);
    
    const prompt = `
      Generate sophisticated search queries to find deep expert analysis and contrasting viewpoints for the topic:
      "${topic.topic}"
      
      Key insights from previous research:
      ${insights.join('\n')}
      
      Key questions about this topic:
      ${topic.keyQuestions.join('\n')}
      
      Generate 5 search queries that will find:
      1. Expert analysis and detailed perspectives on this topic
      2. Contrasting viewpoints and alternative interpretations
      3. Historical context and background information
      4. Future implications and predictions
      5. In-depth exploration of the most important aspects
      
      Respond in JSON format as an array of query strings:
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
        console.error('Invalid query format:', cleanedResponse);
        // Fallback to predefined queries if the model fails
        return getDefaultDeepDiveQueries(topic);
      }
    } catch (parseError) {
      console.error('Error parsing deep dive queries:', parseError);
      return getDefaultDeepDiveQueries(topic);
    }
  } catch (error) {
    console.error(`Error generating deep dive queries for topic "${topic.topic}":`, error);
    return getDefaultDeepDiveQueries(topic);
  }
}

/**
 * Provides fallback default queries for deep dive research
 * @param topic The deep research topic
 * @returns Array of default deep dive queries
 */
function getDefaultDeepDiveQueries(topic: DeepResearchTopic): string[] {
  const baseQueries = [
    `expert analysis ${topic.topic}`,
    `implications of ${topic.topic}`,
    `historical context ${topic.topic}`,
    `future predictions ${topic.topic}`,
    `contrasting views ${topic.topic}`
  ];
  // Add queries derived from key questions and insights
  const questionQueries = topic.keyQuestions.slice(0, 2).map(q => `in-depth research ${q}`);

  return [...baseQueries, ...questionQueries].slice(0, 5); // Limit total queries
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
    // Pass complete content instead of truncating to fixed character limit
    let synthesisInput = `Topic: ${topic.topic}\nKey Questions to Answer:\n${topic.keyQuestions.join('\n- ')}\n\n`;
    synthesisInput += "Key Insights & Content from Research Layers:\n";
    layers.forEach(layer => {
      synthesisInput += `\n--- Layer ${layer.level} ---\n`;
      synthesisInput += `Insights: ${layer.keyInsights.join(', ')}\n`;
      // Pass full content for each layer rather than a limited snippet
      synthesisInput += `Content: ${layer.content}\n`;
    });

    const synthesisPrompt = `
      Synthesize the following research findings for the topic "${topic.topic}" into a cohesive, analytical narrative (approx 400-600 words).
      
      REQUIRED ANALYTICAL ELEMENTS:
      1. ANSWER KEY QUESTIONS: Address all key questions provided thoroughly with evidence-based answers
      2. CAUSAL ANALYSIS: Explain causes and effects related to the main developments in this topic
      3. COMPARATIVE ANALYSIS: Compare different viewpoints, approaches, or alternatives when relevant
      4. CONTEXTUAL ANALYSIS: Explain the historical, social, economic, or political context that makes this topic significant
      5. IMPLICATION ANALYSIS: Discuss the potential consequences or impacts of the main developments
      
      WRITING APPROACH:
      - Integrate insights from all layers, with special emphasis on Layer 3 (deep research)
      - Start with foundational understanding and build to sophisticated insights
      - Maintain an objective yet insightful tone suitable for a news podcast
      - Present contrasting viewpoints where they exist
      - Identify underlying trends or patterns
      
      STRICTLY AVOID:
      - Filler phrases like "it's important to note," "as we can see," "it's worth mentioning," etc.
      - Stating the obvious or making claims without supporting evidence
      - Surface-level summaries without analytical depth
      - Vague generalizations or oversimplifications
      - Repetitive information or redundant statements
      
      Research Input:
      ${synthesisInput}

      Generate only the synthesized narrative text with substantive analytical content.
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
      ${synthesizedContent}

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
      You are an expert podcast script writer crafting an INSIGHTFUL, ANALYTICAL news podcast. Your goal is to write a cohesive and engaging podcast script that goes BEYOND surface-level reporting to deliver meaningful analysis.
      
      Target total word count: ${targetWordCount} words.
      Allocate content according to the target length suggested for each topic.
      
      HOST PERSONA: Confident, knowledgeable, and thoughtful. You synthesize complex information and present it in a clear, analytical manner. You're authoritative but conversational - never condescending. You help listeners understand not just WHAT happened but WHY it matters.
      
      REQUIRED CONTENT QUALITIES:
      1. ANALYTICAL DEPTH: Don't just report facts - analyze their significance, consequences, and broader context
      2. SYNTHETIC THINKING: Identify patterns and connections ACROSS topics when relevant
      3. MULTIPLE PERSPECTIVES: Present contrasting viewpoints on complex issues
      4. NUANCED COMMENTARY: Acknowledge complexity and avoid oversimplification
      5. CAUSAL ANALYSIS: Explain causes and effects when appropriate
      
      CRITICAL WRITING RESTRICTIONS:
      1. NO FILLER PHRASES: Avoid empty phrases like "it's important to note," "as we can see," "it's worth mentioning," "it's interesting that," "as mentioned earlier," etc.
      2. NO STATING THE OBVIOUS: Don't tell listeners something is "fascinating" or "important" - demonstrate WHY it matters through analysis
      3. NO REDUNDANCY: Never repeat information unnecessarily
      4. NO VAGUE CLAIMS: Support analytical points with specific evidence
      5. NO SUPERFICIAL TRANSITIONS: Make substantive connections between topics
      
      CRITICAL FORMAT REQUIREMENTS:
      1. DO NOT include any speaker indicators like "Host:" or "Speaker:"
      2. DO NOT include any audio instructions like "(upbeat music)" or "(pause)"
      3. NEVER include text that can't be read aloud like "(Podcast Intro Music Fades)" or "(Podcast Outro Music Fades In)"
      4. NEVER reference specific time periods like "monthly update" or "April 2025 update" - keep content timeless
      5. AVOID assumptions about publication frequency (daily, weekly, monthly)
      6. Use only plain text with standard punctuation (periods, commas, question marks)

      Synthesized Research Input:
      ${combinedResearch}

      Generate ONLY the integrated podcast script content that delivers genuine insights on these topics. Focus on synthesis, analysis, and meaningful commentary.
    `;

    const result = await model.generateContent(generationPrompt);
    return result.response.text();

  } catch (error) {
    console.error('Error generating integrated podcast content:', error);
    return "Failed to generate integrated podcast content due to an internal error.";
  }
} 
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
      Synthesize the following research findings for the topic "${topic.topic}" into a data-rich, evidence-based market research analysis (approx 400-600 words).
      
      REQUIRED CONTENT ELEMENTS:
      1. SPECIFIC DATA POINTS: Include concrete statistics, percentages, metrics, and quantifiable information
      2. PRECISE EXAMPLES: Cite specific companies, products, or case studies that illustrate key points
      3. EXPERT ANALYSIS: Interpret data patterns and implications as a market research expert would
      4. COMPARATIVE METRICS: Use numerical comparisons (YoY changes, market share shifts, growth rates)
      5. DOMAIN-SPECIFIC INSIGHTS: Use specialized terminology and analysis frameworks appropriate for industry experts
      
      KEY APPROACH REQUIREMENTS:
      - Extract and highlight the MOST SPECIFIC statistical information from all research layers
      - Ensure EVERY significant claim is supported by specific data points or concrete examples
      - Write for an audience that already understands the domain fundamentals - focus on advanced insights
      - Transform vague statements (e.g., "sales grew significantly") into precise ones (e.g., "sales grew 37% YoY")
      - Connect disparate data points to reveal non-obvious patterns and implications
      
      STRICTLY AVOID:
      - Generic statements without supporting quantitative evidence
      - Filler phrases like "it's important to note," "as we can see," "it's worth mentioning"
      - Explaining basic concepts that domain experts would already understand
      - Vague qualitative descriptions where specific metrics could be used
      - Surface-level summaries without data-driven depth
      
      Research Input:
      ${synthesisInput}

      Generate only the synthesized market research analysis with emphasis on SPECIFIC DATA POINTS, STATISTICS, and CONCRETE EXAMPLES throughout.
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
    console.log('[DeepDive] Generating integrated content based on research');
    // Check if researchedTopics is empty or invalid
    if (!researchedTopics || researchedTopics.length === 0) {
      console.warn('[DeepDive] No researched topics provided for integration.');
      // Throw error instead of returning generic message
      throw new Error('No researched topics available for content integration.');
    }

    const prompt = `
      Synthesize the following deep research findings into a coherent, data-driven podcast segment approximately ${targetWordCount} words long.
      Maintain a professional, analytical tone suitable for domain experts.
      Focus on connecting insights across topics and highlighting key data points.
      
      Topic Allocations:
      ${topicDistribution.map(dist => `- ${dist.topic}: ${dist.allocation}%`).join('\n')}
      
      Research Findings:
      ${researchedTopics.map(topic => `
      --- Topic: ${topic.topic} ---
      ${topic.synthesizedContent}
      Key Insights:
      ${topic.layers.flatMap(l => l.keyInsights).map(insight => `- ${insight}`).join('\n')}
      `).join('\n\n')}
      
      Requirements:
      - Weave together the findings from different topics naturally.
      - Prioritize content based on the Topic Allocations.
      - Ensure the final output is well-structured and flows logically.
      - Cite specific data points and metrics where possible.
      - Adhere strictly to the word count.
      - Output ONLY the integrated podcast content text, with standard punctuation.
      - DO NOT include headers, titles, or introductory/concluding remarks unless they are part of the synthesized flow.
      - DO NOT use markdown or special formatting.
      - DO NOT include audio directions or speaker tags.
    `;
    
    const result = await model.generateContent(prompt);
    const generatedContent = result.response.text();

    // Add a basic check for valid content
    if (!generatedContent || generatedContent.trim().length < 50) { // Check for minimal length
      console.error('[DeepDive] Integrated content generation resulted in empty or too short response.');
      throw new Error('Failed to generate sufficient integrated content.');
    }

    console.log(`[DeepDive] Generated integrated content (${generatedContent.split(/\s+/).length} words)`);
    return generatedContent;
  } catch (error) {
    console.error('[DeepDive] Error generating integrated content:', error);
    // Re-throw the error instead of returning a string
    throw new Error(`Failed to generate integrated podcast content due to an internal error: ${error.message}`); 
  }
}

export async function generateDeepResearch(
  searchTopic: string,
  existingResults: string,
  maxTokenCount: number = 2500
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log(`Generating deep dive market analysis on: ${searchTopic}`);
    
    const prompt = `
      You are a market research expert specializing in quantitative analysis and data synthesis. Using the search results about "${searchTopic}" provided below, create a comprehensive, data-rich analysis focusing on key metrics, statistics, and evidence-based insights.

      RESEARCH OBJECTIVE:
      Produce a data-centric market analysis with SPECIFIC quantitative metrics, percentages, growth rates, comparative statistics, and numerical trends relevant to "${searchTopic}". Focus on presenting substantive, actionable intelligence for business decision-makers.

      SEARCH RESULTS TO ANALYZE:
      ${existingResults}

      CONTENT REQUIREMENTS:
      1. QUANTITATIVE EMPHASIS: Every paragraph must include SPECIFIC statistics, percentages, market sizes, growth rates, or other quantifiable metrics
      2. DATA SYNTHESIS: Connect disparate data points to reveal patterns and insights not immediately obvious from individual statistics
      3. MARKET SEGMENTATION: Break down market data by relevant segments, geographies, or demographics where applicable
      4. COMPETITIVE LANDSCAPE: Include specific market share figures and competitive positioning metrics when available
      5. TREND ANALYSIS: Present data showing directional trends (growth, decline, stability) with specific time frames
      6. FINANCIAL METRICS: Incorporate revenue figures, valuation data, funding information, or cost structures where relevant
      7. CASE PRECEDENTS: Reference specific company examples with associated performance metrics

      FORMAT REQUIREMENTS:
      1. Write in clear, professional language suitable for business analysts and decision-makers
      2. Present information in logically structured paragraphs, not as a numbered report
      3. DO NOT use bullet points, tables, or other formatting elements
      4. Cite the source of metrics whenever possible (e.g., "According to McKinsey research, the market grew 23% YoY")
      5. Use proper business terminology and industry-specific metrics
      6. Maintain a factual, evidence-based tone throughout
      7. Conclude with the most significant metrics-based insights and implications

      CRITICAL RESTRICTIONS:
      1. ONLY include information that appears in the search results - do NOT invent or hallucinate statistics
      2. NEVER say "according to the search results" or reference the prompt itself
      3. DO NOT apologize for limitations in the data or mention gaps in information
      4. AVOID vague phrases like "significant growth" - always provide the specific percentage or number
      5. NEVER make claims about the present year or predict specific timelines
      6. DO NOT add commentary on information quality or source reliability

      PRODUCE A COHESIVE, DATA-RICH MARKET ANALYSIS that synthesizes the most reliable quantitative information from the search results. Focus exclusively on metrics, statistics, and evidence-based insights about "${searchTopic}".
    `;
    
    const result = await model.generateContent(prompt);
    const deepResearch = result.response.text();
    
    console.log(`Generated deep research content (${deepResearch.length} chars)`);
    
    // Truncate if necessary to respect token limits
    if (deepResearch.length > maxTokenCount * 4) { // Rough char to token ratio
      console.log(`Truncating deep research to fit token limit (${maxTokenCount})`);
      return deepResearch.substring(0, maxTokenCount * 4);
    }
    
    return deepResearch;
  } catch (error) {
    console.error('Error generating deep research:', error);
    return `Unable to generate deep research on ${searchTopic}. The search results provided may not contain sufficient data for quantitative analysis.`;
  }
} 
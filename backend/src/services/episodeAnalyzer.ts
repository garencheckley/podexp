import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDb, Episode } from './database';
import { POWERFUL_MODEL_ID } from '../config';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Interface for the result of analyzing existing episodes
 */
export interface EpisodeAnalysis {
  recentTopics: Array<{ topic: string; frequency: number }>;
  coveredSources: string[];
  recurrentThemes: string[];
  episodeCount: number;
}

/**
 * Analyzes existing episodes to identify topics, themes, and content patterns
 * @param podcastId The podcast ID to analyze episodes for
 * @param limit Maximum number of episodes to analyze (default: 15)
 * @returns Analysis of episode content patterns
 */
export async function analyzeExistingEpisodes(podcastId: string, limit = 15): Promise<EpisodeAnalysis> {
  try {
    console.log(`Analyzing existing episodes for podcast ${podcastId}, limit: ${limit}`);
    
    // Retrieve the most recent episodes
    const episodes = await getDb().collection('episodes')
      .where('podcastId', '==', podcastId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get()
      .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Episode));
    
    console.log(`Found ${episodes.length} episodes for analysis`);
    
    // If no episodes, return empty analysis
    if (episodes.length === 0) {
      return {
        recentTopics: [],
        coveredSources: [],
        recurrentThemes: [],
        episodeCount: 0
      };
    }

    // Initialize collection objects
    const topicFrequency = new Map<string, number>();
    const coveredSources = new Set<string>();
    const keyThemes = new Set<string>();
    
    // Process each episode to extract information
    for (const episode of episodes) {
      // Skip episodes without content
      if (!episode.content) {
        console.log(`Episode ${episode.id} has no content, skipping analysis`);
        continue;
      }
      
      // Collect sources if they exist
      if (episode.sources && Array.isArray(episode.sources)) {
        episode.sources.forEach(source => coveredSources.add(source));
      }
      
      // Use Gemini to analyze the episode content
      console.log(`Analyzing content for episode ${episode.id}`);
      const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
      
      // Truncate content if it's very long to avoid token limits
      const contentForAnalysis = episode.content.length > 10000 
        ? episode.content.substring(0, 10000) 
        : episode.content;
      
      const analysisPrompt = `
        Analyze this podcast episode and extract:
        1. Main topics covered (maximum 5)
        2. Key themes or narratives
        
        Episode title: ${episode.title}
        Episode content:
        ${contentForAnalysis}
        
        Respond in JSON format:
        {
          "topics": ["topic1", "topic2"...],
          "themes": ["theme1", "theme2"...]
        }
      `;
      
      try {
        const result = await model.generateContent(analysisPrompt);
        const responseText = result.response.text();
        
        // Parse the JSON response
        try {
          // Clean up potential markdown formatting
          const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
          const analysisResult = JSON.parse(cleanedResponse);
          
          // Update topic frequency
          if (analysisResult.topics && Array.isArray(analysisResult.topics)) {
            analysisResult.topics.forEach((topic: string) => {
              topicFrequency.set(topic, (topicFrequency.get(topic) || 0) + 1);
            });
          }
          
          // Update themes
          if (analysisResult.themes && Array.isArray(analysisResult.themes)) {
            analysisResult.themes.forEach((theme: string) => keyThemes.add(theme));
          }
        } catch (parseError) {
          console.error(`Error parsing analysis result for episode ${episode.id}:`, parseError);
        }
      } catch (genError) {
        console.error(`Error generating analysis for episode ${episode.id}:`, genError);
      }
    }
    
    // Convert to array and sort by frequency
    const sortedTopics = Array.from(topicFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([topic, frequency]) => ({ topic, frequency }));
    
    return {
      recentTopics: sortedTopics,
      coveredSources: Array.from(coveredSources),
      recurrentThemes: Array.from(keyThemes),
      episodeCount: episodes.length
    };
  } catch (error) {
    console.error('Error analyzing existing episodes:', error);
    // Return empty analysis on error
    return {
      recentTopics: [],
      coveredSources: [],
      recurrentThemes: [],
      episodeCount: 0
    };
  }
} 
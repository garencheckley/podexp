import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDb, Episode } from './database';
import { POWERFUL_MODEL_ID } from '../config';
import { llmLogger } from './llmLogger';

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
    console.log(`[EpisodeAnalyzer] Querying Firestore for episodes with podcastId: ${podcastId}`);
    const episodesQuery = getDb().collection('episodes')
      .where('podcastId', '==', podcastId)
      .orderBy('created_at', 'desc')
      .limit(limit);
    
    try {
      console.log(`[EpisodeAnalyzer] Executing Firestore query...`);
      const episodesSnapshot = await episodesQuery.get();
      console.log(`[EpisodeAnalyzer] Firestore query executed successfully`);
      const episodes = episodesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Episode);
      console.log(`[EpisodeAnalyzer] Firestore query returned ${episodesSnapshot.size} episode documents.`);
      
      console.log(`Found ${episodes.length} episodes for analysis`);
      
      // If no episodes, return empty analysis
      if (episodes.length === 0) {
        console.log(`[EpisodeAnalyzer] No episodes found for podcast ${podcastId}, returning empty analysis`);
        return {
          recentTopics: [],
          coveredSources: [],
          recurrentThemes: [],
          episodeCount: 0
        };
      }

      // Collect all sources from episodes
      const allSources = new Set<string>();
      
      // Prepare episode summaries for a consolidated analysis
      const episodeSummaries = episodes
        .filter(episode => episode.content || episode.bulletPoints) // Accept episodes with either content or bulletPoints
        .map(episode => {
          // Collect sources if they exist
          if (episode.sources && Array.isArray(episode.sources)) {
            episode.sources.forEach(source => allSources.add(source));
          }
          
          // Prepare content representation - prefer bullet points if available
          let contentRepresentation = '';
          if (episode.bulletPoints && Array.isArray(episode.bulletPoints) && episode.bulletPoints.length > 0) {
            // Use bullet points for more efficient representation
            contentRepresentation = `BULLET POINT SUMMARY:\n${episode.bulletPoints.map(bullet => `• ${bullet}`).join('\n')}`;
          } else if (episode.content) {
            // Fall back to content preview if no bullet points
            contentRepresentation = episode.content.substring(0, 1000) + '...';
          }
          
          // Create a brief summary of the episode for the consolidated analysis
          return {
            id: episode.id,
            title: episode.title,
            description: episode.description || '',
            contentRepresentation: contentRepresentation,
            created_at: episode.created_at || ''
          };
        });
      
      // Create a consolidated prompt for analyzing all episodes together
      const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
      const analysisPrompt = `
        Analyze these podcast episodes collectively and extract:
        1. Main topics covered across all episodes (maximum 10)
        2. Frequency of each topic (how many episodes mention this topic)
        3. Key recurring themes or narratives across episodes
        
        Episodes:
        ${episodeSummaries.map((ep, idx) => `
          EPISODE ${idx + 1}:
          Title: ${ep.title}
          Date: ${ep.created_at}
          Content: ${ep.contentRepresentation}
        `).join('\n\n')}
        
        Respond in JSON format:
        {
          "topics": [
            {"topic": "topic1", "frequency": 3},
            {"topic": "topic2", "frequency": 2},
            ...
          ],
          "themes": ["theme1", "theme2", ...]
        }
        
        Ensure the "frequency" represents how many different episodes mention each topic.
      `;
      
      try {
        console.log(`Sending consolidated analysis request for ${episodeSummaries.length} episodes`);
        const { result } = await llmLogger.logGeminiCall(
          model, 
          analysisPrompt, 
          'Episode analysis and topic extraction'
        );
        const responseText = result.response.text();
        
        // Parse the JSON response
        try {
          // Clean up potential markdown formatting
          const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
          const analysisResult = JSON.parse(cleanedResponse);
          
          return {
            // Use the topics directly from the consolidated analysis
            recentTopics: analysisResult.topics || [],
            coveredSources: Array.from(allSources),
            recurrentThemes: analysisResult.themes || [],
            episodeCount: episodes.length
          };
        } catch (parseError) {
          console.error('Error parsing consolidated analysis result:', parseError);
          // Make a best-effort response with the episode count even if parsing fails
          return {
            recentTopics: [],
            coveredSources: Array.from(allSources),
            recurrentThemes: [],
            episodeCount: episodes.length
          };
        }
      } catch (genError) {
        console.error('Error generating consolidated analysis:', genError);
        // Make a best-effort response with the episode count even if Gemini API fails
        return {
          recentTopics: [],
          coveredSources: Array.from(allSources),
          recurrentThemes: [],
          episodeCount: episodes.length
        };
      }
    } catch (queryError) {
      console.error(`[EpisodeAnalyzer] Error executing Firestore query:`, queryError);
      // Log more details about the error
      if (queryError instanceof Error) {
        console.error(`[EpisodeAnalyzer] Error name: ${queryError.name}, message: ${queryError.message}`);
        console.error(`[EpisodeAnalyzer] Error stack: ${queryError.stack}`);
        
        // Special handling for index-related errors
        if (queryError.message && queryError.message.includes('FAILED_PRECONDITION') && queryError.message.includes('index')) {
          console.error(`
[EpisodeAnalyzer] ================================================================
[EpisodeAnalyzer] FIRESTORE INDEX ERROR DETECTED
[EpisodeAnalyzer] ================================================================
[EpisodeAnalyzer] This error occurs when Firestore requires a composite index for a query.
[EpisodeAnalyzer] 
[EpisodeAnalyzer] To fix this:
[EpisodeAnalyzer] 1. Use the link in the error message above to create the required index, OR
[EpisodeAnalyzer] 2. Run './deploy-indexes.sh' from the project root to deploy all indexes
[EpisodeAnalyzer] 
[EpisodeAnalyzer] Note: Index creation may take several minutes to complete.
[EpisodeAnalyzer] ================================================================`);
        }
      }
      return {
        recentTopics: [],
        coveredSources: [],
        recurrentThemes: [],
        episodeCount: 0
      };
    }
  } catch (error) {
    console.error('[EpisodeAnalyzer] Error analyzing existing episodes:', error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error(`[EpisodeAnalyzer] Error name: ${error.name}, message: ${error.message}`);
      console.error(`[EpisodeAnalyzer] Error stack: ${error.stack}`);
    }
    // Return empty analysis on database error
    return {
      recentTopics: [],
      coveredSources: [],
      recurrentThemes: [],
      episodeCount: 0
    };
  }
} 
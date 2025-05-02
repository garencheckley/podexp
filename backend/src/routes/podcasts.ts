import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  getAllPodcasts,
  getPodcast,
  createPodcast,
  getEpisodesByPodcastId,
  createEpisode,
  updateEpisodeSummary,
  getDb,
  type Podcast,
  type Episode,
  deleteEpisode,
  deletePodcast,
  getEpisode,
  updatePodcast
} from '../services/database';
import { generateAndStoreAudio, deleteAudio } from '../services/audio';
import { conductThreeStageSearch } from '../services/search';
import * as episodeAnalyzer from '../services/episodeAnalyzer';
import * as searchOrchestrator from '../services/searchOrchestrator';
import * as contentDifferentiator from '../services/contentDifferentiator';
import * as narrativePlanner from '../services/narrativePlanner';
import * as contentFormatter from '../services/contentFormatter';
import * as deepDiveResearch from '../services/deepDiveResearch';
import * as sourceManager from '../services/sourceManager';
import * as clusteringService from '../services/clusteringService';
import { summarizeCluster } from '../services/clusteringService';
import { authenticateToken, authenticateTokenOptional } from '../middleware/auth';

const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-exp-03-25' });

// Get all podcasts (Apply OPTIONAL auth)
router.get('/', authenticateTokenOptional, async (req, res) => {
  try {
    // req.userId will be populated by authenticateTokenOptional if user is logged in
    console.log(`GET /api/podcasts for user ${req.userId || 'anonymous'}`);
    // Pass potential userId to the database function
    const podcasts = await getAllPodcasts(req.userId);
    res.json(podcasts);
  } catch (error: any) { // Explicitly type error as any
    // Log individual properties to avoid potential truncation
    console.error('Detailed error getting podcasts:');
    console.error(`Error Name: ${error.name}`);
    console.error(`Error Message: ${error.message}`);
    console.error(`Error Stack: ${error.stack}`);
    res.status(500).json({ error: 'Failed to get podcasts' });
  }
});

// Get podcast by ID (Apply OPTIONAL auth)
router.get('/:id', authenticateTokenOptional, async (req, res) => {
  try {
    // req.userId will be populated by authenticateTokenOptional if user is logged in
    console.log(`GET /api/podcasts/${req.params.id} for user ${req.userId || 'anonymous'}`);
    // Pass potential userId to the database function
    const podcast = await getPodcast(req.params.id, req.userId); 
    
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found or access denied' }); 
    }
    res.json(podcast);
  } catch (error) {
    console.error('Error getting podcast:', error);
    res.status(500).json({ error: 'Failed to get podcast' });
  }
});

// Create podcast (Protected)
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('POST /api/podcasts', req.body);
    // Middleware ensures req.userId exists here
    if (!req.userId) {
      // This check is now redundant due to middleware but kept for safety
      console.error('Error creating podcast: No userId found on request despite auth middleware.');
      return res.status(403).json({ error: 'Forbidden: User ID not found.' });
    }

    // If title is not provided, generate one using Gemini
    if (!req.body.title) {
      console.log('No title provided, generating one using Gemini...');
      const prompt = req.body.prompt;
      
      // Get all existing podcast titles to ensure uniqueness
      const existingPodcasts = await getAllPodcasts();
      const existingTitles = existingPodcasts.map(p => p.title);
      console.log('Existing titles:', existingTitles);
      
      const titlePrompt = `Generate a short, catchy title for a podcast based on the following description:
"${prompt}"

REQUIREMENTS:
1. The title must be 8 words or fewer
2. The title should be related to the podcast's theme and content
3. The title should be distinct from these existing podcast titles: ${JSON.stringify(existingTitles)}
4. If necessary, you can add a number to make it unique
5. Do not use quotes or special characters in the title
6. Return ONLY the title text, nothing else

Example good titles: "Tales from the Crypt", "The Daily", "Serial", "This American Life", "Hardcore History"`;

      console.log('Sending title prompt to Gemini:', titlePrompt);
      
      try {
        const result = await model.generateContent(titlePrompt);
        const generatedTitle = result.response.text().trim();
        console.log('Generated title:', generatedTitle);
        
        // Add the generated title to the request body
        req.body.title = generatedTitle;
      } catch (titleError) {
        console.error('Error generating title:', titleError);
        // If title generation fails, create a descriptive title from the prompt
        // Extract key elements from the prompt to create a title
        const words = prompt.split(/\s+/);
        let descriptiveTitle = '';
        
        // Look for character names and themes in the prompt
        const nameMatches = prompt.match(/\b[A-Z][a-z]+\b/g) || [];
        const uniqueNames = [...new Set(nameMatches)];
        
        if (uniqueNames.length > 0) {
          // Use the first 1-2 character names found
          const mainCharacters = uniqueNames.slice(0, 2);
          
          // Look for themes or settings
          const themeWords = ['adventures', 'journey', 'tales', 'stories', 'chronicles', 'quest'];
          const foundThemes = words.filter((word: string) => themeWords.includes(word.toLowerCase()));
          
          if (foundThemes.length > 0) {
            descriptiveTitle = `${mainCharacters.join(' & ')}'s ${foundThemes[0]}`;
          } else {
            descriptiveTitle = `${mainCharacters.join(' & ')}'s Adventures`;
          }
        } else {
          // If no character names found, use the first 5-8 words
          descriptiveTitle = words.slice(0, 8).join(' ');
          if (descriptiveTitle.length > 50) {
            descriptiveTitle = words.slice(0, 5).join(' ');
          }
        }
        
        // Ensure the title is unique
        let counter = 1;
        let finalTitle = descriptiveTitle;
        while (existingTitles.includes(finalTitle)) {
          finalTitle = `${descriptiveTitle} ${counter}`;
          counter++;
        }
        
        req.body.title = finalTitle;
        console.log('Using generated descriptive title:', req.body.title);
      }
    }
    
    console.log('Creating podcast with title:', req.body.title, 'for user:', req.userId);
    // Include the userId when calling createPodcast
    const podcastData = { ...req.body, userId: req.userId }; 
    const podcast = await createPodcast(podcastData); 
    console.log('Created podcast:', podcast);
    
    // Discover sources for the new podcast
    console.log('Discovering sources for the new podcast...');
    try {
      const sources = await sourceManager.discoverSources(podcast.prompt || podcast.description);
      
      if (sources && sources.length > 0) {
        // Update the podcast with the discovered sources
        await updatePodcast(podcast.id, {
          sources: sources
        });
        console.log(`Updated podcast with ${sources.length} discovered sources`);
        
        // Add sources to the podcast object for the response
        podcast.sources = sources;
      } else {
        console.log('No sources discovered or error during source discovery');
      }
    } catch (sourceError) {
      console.error('Error discovering sources:', sourceError);
      // Continue without sources - non-critical error
    }
    
    res.status(201).json(podcast);
  } catch (error) {
    console.error('Error creating podcast:', error);
    res.status(500).json({ error: 'Failed to create podcast' });
  }
});

// Get episodes by podcast ID (Apply REQUIRED auth - need to check parent access)
router.get('/:podcastId/episodes', authenticateToken, async (req, res) => {
  try {
    const { podcastId } = req.params;
    // authenticateToken ensures req.userId is set here
    if (!req.userId) { // Should theoretically not happen now
      console.error('Error getting episodes: No userId found after authentication.');
      return res.status(403).json({ error: 'Forbidden: User ID not found after authentication.' });
    }
    console.log(`GET /api/podcasts/${podcastId}/episodes for user ${req.userId}`);

    // Pass userId to getPodcast for parent check
    // Must use req.userId here for the check
    const podcast = await getPodcast(podcastId, req.userId); 
    if (!podcast) {
      // Handles "Not Found" or "Access Denied" from getPodcast
      return res.status(404).json({ error: 'Podcast not found or access denied' });
    }
    
    // Fetch episodes - database function doesn't need userId directly
    const episodes = await getEpisodesByPodcastId(podcastId);
    res.json(episodes);
  } catch (error) {
    console.error('Error getting episodes:', error);
    res.status(500).json({ error: 'Failed to get episodes' });
  }
});

// Delete episode (Protected)
router.delete('/:podcastId/episodes/:episodeId', authenticateToken, async (req, res) => {
  try {
    console.log(`DELETE /api/podcasts/${req.params.podcastId}/episodes/${req.params.episodeId}`);
    
    const { podcastId, episodeId } = req.params;

    // Middleware ensures req.userId exists here
    if (!req.userId) { 
       // Redundant check
       return res.status(403).json({ error: 'Forbidden: User ID not found.' }); 
    }
    console.log(`Attempting delete by user ${req.userId}`);

    // Authorization Check: Verify user owns the parent podcast
    // MUST pass req.userId here for getPodcast to perform visibility/ownership check
    const podcast = await getPodcast(podcastId, req.userId); 
    if (!podcast) {
      // Correctly handles both "Not Found" and "Access Denied" from getPodcast
      return res.status(404).json({ error: 'Podcast not found or access denied' }); 
    }
    // Check ownerEmail against authenticated user email
    if (podcast.ownerEmail !== req.userId) { 
      console.warn(`Forbidden: User ${req.userId} attempted to delete episode ${episodeId} from podcast ${podcastId} owned by ${podcast.ownerEmail}`);
      return res.status(403).json({ error: 'Forbidden: You do not own the parent podcast' });
    }
    
    // Get the episode to check if it exists and has an audio URL
    const episode = await getEpisode(episodeId);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    // If the episode has an audio URL, delete the audio file
    if (episode.audioUrl) {
      await deleteAudio(podcastId, episodeId);
    }
    
    // Delete the episode from the database
    await deleteEpisode(episodeId);
    
    res.status(200).json({ message: 'Episode deleted successfully' });
  } catch (error) {
    console.error('Error deleting episode:', error);
    res.status(500).json({ error: 'Failed to delete episode' });
  }
});

// Delete podcast (Protected)
router.delete('/:podcastId', authenticateToken, async (req, res) => {
  try {
    console.log(`DELETE /api/podcasts/${req.params.podcastId}`);
    
    const { podcastId } = req.params;

    // Middleware ensures req.userId exists here
    if (!req.userId) { 
        // Redundant check
        return res.status(403).json({ error: 'Forbidden: User ID not found.' }); 
    }
    console.log(`Attempting delete by user ${req.userId}`);

    // Authorization Check: Verify user owns the podcast
    const podcast = await getPodcast(podcastId, req.userId);
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    if (podcast.ownerEmail !== req.userId) {
      console.warn(`Forbidden: User ${req.userId} attempted to delete podcast ${podcastId} owned by ${podcast.ownerEmail}`);
      return res.status(403).json({ error: 'Forbidden: You do not own this podcast' });
    }
    
    // Get all episodes for this podcast
    const episodes = await getEpisodesByPodcastId(podcastId);
    
    // Delete audio files for all episodes
    const audioDeletions = episodes
      .filter(episode => episode.audioUrl)
      .map(episode => deleteAudio(podcastId, episode.id));
    await Promise.all(audioDeletions);
    
    // Delete the podcast (this will also delete all episodes)
    await deletePodcast(podcastId);
    
    res.status(200).json({ message: 'Podcast deleted successfully' });
  } catch (error) {
    console.error('Error deleting podcast:', error);
    res.status(500).json({ error: 'Failed to delete podcast' });
  }
});

// Create episode (Protected)
router.post('/:podcastId/episodes', authenticateToken, async (req, res) => {
  try {
    console.log(`POST /api/podcasts/${req.params.podcastId}/episodes`, req.body);
    const { podcastId } = req.params;

    // Add userId check
    if (!req.userId) {
      console.error('Error creating episode: No userId found on request.');
      return res.status(403).json({ error: 'Forbidden: User ID not found after authentication.' });
    }
    console.log(`Attempting create by user ${req.userId}`);

    // Authorization Check: Verify user owns the parent podcast
    const podcast = await getPodcast(podcastId);
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    if (podcast.userId !== req.userId) {
      console.warn(`Forbidden: User ${req.userId} attempted to create episode for podcast ${podcastId} owned by ${podcast.userId}`);
      return res.status(403).json({ error: 'Forbidden: You do not own the parent podcast' });
    }
    
    // Create the episode
    const episode = await createEpisode({
      ...req.body,
      podcastId: req.params.podcastId
    });
    
    // Update the podcast's last_updated field
    await updatePodcast(req.params.podcastId, {
      last_updated: new Date().toISOString()
    });
    
    // Generate audio for the episode
    const audioStartTime = Date.now();
    console.log('Generating audio for the episode...');
    const audioUrl = await generateAndStoreAudio(
      episode.content!, 
      podcast.id!, 
      episode.id!
    );
    
    // Update the episode with the audio URL
    await updateEpisodeAudio(episode.id!, audioUrl);
    
    // Update log with audio generation
    const logService = require('../services/logService');
    const generationLog = logService.createEpisodeGenerationLog(req.params.podcastId);
    generationLog.episodeId = episode.id;
    console.log(`Setting episode ID ${episode.id} in generation log ${generationLog.id}`);
    await logService.saveEpisodeGenerationLog(generationLog);
    
    // Update log with audio generation
    generationLog.stages.audioGeneration = {
      audioFileSize: 0, // Would need to get this information
      audioDuration: generationLog.stages.contentGeneration?.estimatedDuration || 0,
      processingTimeMs: Date.now() - audioStartTime
    };
    generationLog.duration.stageBreakdown.audioGeneration = Date.now() - audioStartTime;
    generationLog.duration.totalMs += Date.now() - audioStartTime;
    
    // Mark log as completed
    generationLog.status = 'completed';
    await logService.saveEpisodeGenerationLog(generationLog);
    
    // Respond with the saved episode including audio URL
    episode.audioUrl = audioUrl;
    
    res.status(201).json({
      episode: episode,
      generationLogId: generationLog.id
    });
  } catch (error) {
    console.error('Error creating episode:', error);
    res.status(500).json({ error: 'Failed to create episode' });
  }
});

// Generate a new episode for a podcast (Protected)
router.post('/:id/generate-episode', authenticateToken, async (req, res) => {
  try {
    const { id: podcastId } = req.params;
    console.log(`POST /api/podcasts/${podcastId}/generate-episode`);
    
    // Add userId check
    if (!req.userId) {
      console.error('Error generating episode: No userId found on request.');
      return res.status(403).json({ error: 'Forbidden: User ID not found after authentication.' });
    }
    console.log(`Attempting generate by user ${req.userId}`);
    
    // Create a new episode generation log
    const logService = require('../services/logService');
    const generationLog = logService.createEpisodeGenerationLog(podcastId);
    console.log(`Created episode generation log: ${generationLog.id}`);
    
    // Get the podcast & Authorize - Pass userId (email) for access check
    const podcast = await getPodcast(podcastId, req.userId);
    if (!podcast) {
      const errorMsg = 'Podcast not found or access denied'; // Updated error message
      await logService.saveEpisodeGenerationLog(
        logService.failLog(generationLog, errorMsg)
      );
      return res.status(404).json({ error: errorMsg });
    }
    // Authorization Check - Compare ownerEmail with userId (email)
    if (podcast.ownerEmail !== req.userId) { 
      console.warn(`Forbidden: User ${req.userId} attempted to generate episode for podcast ${podcastId} owned by ${podcast.ownerEmail}`);
      const errorMsg = 'Forbidden: You do not own this podcast';
      await logService.saveEpisodeGenerationLog(
        logService.failLog(generationLog, errorMsg)
      );
      return res.status(403).json({ error: errorMsg });
    }
    
    console.log(`Generating episode for podcast: ${podcast.title}`);
    
    // Get episode length specification from request or default
    // We use words per minute (WPM) of 130 for conversational speech
    const wordsPerMinute = 130;
    
    // Check if request specifies targetMinutes or targetWordCount
    let targetWordCount = 300; // Default ~2.3 minutes at 130 WPM
    
    if (req.body.targetMinutes) {
      // If minutes are specified, calculate words (rounded to nearest 10)
      const minutes = parseFloat(req.body.targetMinutes);
      if (!isNaN(minutes) && minutes > 0) {
        targetWordCount = Math.round((minutes * wordsPerMinute) / 10) * 10;
        console.log(`Requested ${minutes} minutes, calculated ${targetWordCount} words`);
      }
    } else if (req.body.targetWordCount) {
      // If word count is directly specified, use that
      const wordCount = parseInt(req.body.targetWordCount);
      if (!isNaN(wordCount) && wordCount > 0) {
        targetWordCount = wordCount;
        console.log(`Requested ${targetWordCount} words directly`);
      }
    }
    
    // Set minimum and maximum limits
    const minWordCount = 200;  // ~1.5 minutes
    const maxWordCount = 2600; // ~20 minutes (reasonable limit for episodes)
    
    if (targetWordCount < minWordCount) {
      console.log(`Requested word count ${targetWordCount} below minimum, using ${minWordCount}`);
      targetWordCount = minWordCount;
    } else if (targetWordCount > maxWordCount) {
      console.log(`Requested word count ${targetWordCount} above maximum, using ${maxWordCount}`);
      targetWordCount = maxWordCount;
    }
    
    const targetMinutes = targetWordCount / wordsPerMinute;
    const lengthSpecification = `approximately ${targetWordCount} words (about ${targetMinutes.toFixed(1)} minutes when spoken)`;
    console.log(`Target length: ${lengthSpecification}`);
    
    // Add decision to log
    generationLog.decisions.push({
      stage: 'initialization',
      decision: `Set target length to ${targetWordCount} words (${targetMinutes.toFixed(1)} minutes)`,
      reasoning: `Based on ${req.body.targetMinutes ? 'requested minutes' : req.body.targetWordCount ? 'requested word count' : 'default settings'}, calculated optimal word count within system limits.`,
      alternatives: [],
      timestamp: new Date().toISOString()
    });
    
    // Save initial log
    await logService.saveEpisodeGenerationLog(generationLog);
    
    // Refresh sources if needed
    console.log('Refreshing podcast sources...');
    try {
      const updatedSources = await sourceManager.refreshSourcesIfNeeded(podcast);
      
      if (updatedSources && JSON.stringify(updatedSources) !== JSON.stringify(podcast.sources)) {
        // Update the podcast with the refreshed sources
        await updatePodcast(podcastId, {
          sources: updatedSources
        });
        console.log(`Updated podcast with ${updatedSources.length} refreshed sources`);
        
        // Update the podcast object for use in this request
        podcast.sources = updatedSources;
        
        // Add decision to log
        generationLog.decisions.push({
          stage: 'source_refresh',
          decision: `Updated podcast with ${updatedSources.length} refreshed sources`,
          reasoning: 'Sources required refreshing to ensure current information',
          alternatives: [],
          timestamp: new Date().toISOString()
        });
        await logService.saveEpisodeGenerationLog(generationLog);
      } else {
        console.log('No changes to podcast sources');
      }
    } catch (sourceError) {
      console.error('Error refreshing sources:', sourceError);
      // Continue without refreshed sources - non-critical error
      
      // Log the error but continue
      generationLog.decisions.push({
        stage: 'source_refresh',
        decision: 'Continued without refreshed sources',
        reasoning: 'Source refresh failed but this is non-critical, proceeding with existing sources',
        alternatives: [],
        timestamp: new Date().toISOString()
      });
      await logService.saveEpisodeGenerationLog(generationLog);
    }
    
    // 1. Review existing episodes
    console.log('Step 1: Analyzing existing episodes');
    const analysisStartTime = Date.now();
    const episodeAnalysis = await episodeAnalyzer.analyzeExistingEpisodes(podcastId);
    const analysisEndTime = Date.now();
    const analysisProcessingTime = analysisEndTime - analysisStartTime;
    console.log(`Analysis complete: Found ${episodeAnalysis.episodeCount} episodes, ${episodeAnalysis.recentTopics.length} topics`);
    
    // Update log with analysis results
    generationLog.stages.episodeAnalysis = {
      ...episodeAnalysis,
      processingTimeMs: analysisProcessingTime
    };
    generationLog.duration.stageBreakdown.episodeAnalysis = analysisProcessingTime;
    generationLog.duration.totalMs += analysisProcessingTime;
    
    // Add decision to log
    generationLog.decisions.push({
      stage: 'episode_analysis',
      decision: `Analyzed ${episodeAnalysis.episodeCount} previous episodes`,
      reasoning: 'Understanding previous content is essential for generating differentiated new content',
      alternatives: [],
      timestamp: new Date().toISOString()
    });
    await logService.saveEpisodeGenerationLog(generationLog);
    
    // 2. Perform initial search for new content
    console.log('Step 2: Performing initial search for new content');
    const searchStartTime = Date.now();
    const initialSearchResults = await searchOrchestrator.performInitialSearch(podcast, episodeAnalysis);
    const searchEndTime = Date.now();
    const searchProcessingTime = searchEndTime - searchStartTime;
    console.log(`Initial search complete: Found ${initialSearchResults.potentialTopics.length} potential topics`);
    
    // Update log with search results
    generationLog.stages.initialSearch = {
      searchQueries: [], // We would need to modify searchOrchestrator to return the queries used
      potentialTopics: initialSearchResults.potentialTopics,
      relevantSources: initialSearchResults.relevantSources || [],
      processingTimeMs: searchProcessingTime
    };
    generationLog.duration.stageBreakdown.initialSearch = searchProcessingTime;
    generationLog.duration.totalMs += searchProcessingTime;
    
    // Add decision to log for search
    generationLog.decisions.push({
      stage: 'initial_search',
      decision: `Found ${initialSearchResults.potentialTopics.length} potential topics through search`,
      reasoning: 'Web search is used to discover current and relevant topics for the episode',
      alternatives: [],
      timestamp: new Date().toISOString()
    });
    await logService.saveEpisodeGenerationLog(generationLog);
    
    // 2.1. NEW: Perform source-guided search using podcast sources
    console.log('Step 2.1: Performing source-guided search');
    const topicNames = initialSearchResults.potentialTopics.map(topic => topic.topic);
    const sourceGuidedResults = await sourceManager.performSourceGuidedSearch(podcast, topicNames);
    console.log(`Source-guided search complete: ${sourceGuidedResults.content.length} characters, ${sourceGuidedResults.sources.length} sources`);
    
    // Add decision to log for source-guided search
    generationLog.decisions.push({
      stage: 'source_guided_search',
      decision: `Completed source-guided search with ${sourceGuidedResults.sources.length} sources`,
      reasoning: 'Supplementing web search with targeted content from podcast-specific sources',
      alternatives: [],
      timestamp: new Date().toISOString()
    });
    await logService.saveEpisodeGenerationLog(generationLog);
    
    // Combine initial and source-guided search results (Consider how to handle duplicates if needed)
    // For now, appending content and merging sources.
    let combinedResearchContent = initialSearchResults.combinedResearch;
    let combinedSources = initialSearchResults.allSources;
    if (sourceGuidedResults.content) {
      combinedResearchContent += '\n\n--- Source Guided Search Results ---\n' + sourceGuidedResults.content;
      combinedSources = [...new Set([...combinedSources, ...sourceGuidedResults.sources])];
    }

    // Create ArticleData for clustering from potential topics
    const articlesToCluster: clusteringService.ArticleData[] = initialSearchResults.potentialTopics.map((topic, index) => ({
        id: topic.topic || `topic_${index}`, // Use topic name as ID, or generate one if empty
        content: topic.topic || '' // Use topic name as content (fallback - TODO: Improve with actual content snippets)
    }));

    // 2.2 NEW: Cluster the potential topics/articles
    console.log('Step 2.2: Clustering potential topics');
    const clusterStartTime = Date.now();
    let clusterResult: clusteringService.ClusterResult = { clusters: {}, noise: [], clusterAssignments: [] };
    try {
        clusterResult = await clusteringService.clusterArticles(articlesToCluster);
        console.log(`Clustering complete: Found ${Object.keys(clusterResult.clusters).length} clusters.`);
        
        // Update log with clustering results
        generationLog.stages.clustering = {
          inputTopics: articlesToCluster.map(a => a.id),
          clusters: clusterResult.clusters,
          clusterSummaries: [], // Will be populated after summarization
          processingTimeMs: Date.now() - clusterStartTime
        };
        generationLog.duration.stageBreakdown.clustering = Date.now() - clusterStartTime;
        generationLog.duration.totalMs += Date.now() - clusterStartTime;
        
        // Add decision to log for clustering
        generationLog.decisions.push({
          stage: 'clustering',
          decision: `Grouped potential topics into ${Object.keys(clusterResult.clusters).length} thematic clusters`,
          reasoning: 'Clustering improves focus by grouping similar topics',
          alternatives: [],
          timestamp: new Date().toISOString()
        });
        await logService.saveEpisodeGenerationLog(generationLog);
        
    } catch (clusterError) {
        console.error('Error during article clustering, proceeding without clustering:', clusterError);
        // Update log with clustering failure
        generationLog.decisions.push({
          stage: 'clustering',
          decision: 'Proceeded without clustering due to error',
          reasoning: 'Clustering failed but generation can proceed without it',
          alternatives: [],
          timestamp: new Date().toISOString()
        });
        await logService.saveEpisodeGenerationLog(generationLog);
    }
    
    // TODO: Adapt the input for prioritizeTopicsForDeepDive based on clusterResult
    // This will involve selecting representative articles/summaries per cluster.
    // For now, we'll pass the original prioritizedTopics as a placeholder.
    
    // Generate summaries for each cluster
    console.log('Step 2.3: Generating summaries for topic clusters');
    const clusterSummariesInput: clusteringService.ClusterSummaryInput[] = [];
    if (clusterResult && clusterResult.clusters && Object.keys(clusterResult.clusters).length > 0) {
        const clusterIds = Object.keys(clusterResult.clusters).map(Number);
        for (const clusterId of clusterIds) {
            const topicIds = clusterResult.clusters[clusterId];
            if (topicIds && topicIds.length > 0) {
                try {
                    // Pass initialSearchResults for context if available
                    const summary = await summarizeCluster(clusterId, topicIds, initialSearchResults);
                    clusterSummariesInput.push({
                        clusterId: clusterId,
                        summary: summary,
                        originalTopicIds: topicIds
                    });
                    
                    // Update clustering log with summaries
                    if (generationLog.stages.clustering) {
                      generationLog.stages.clustering.clusterSummaries.push({
                        clusterId: clusterId,
                        summary: summary,
                        originalTopicIds: topicIds
                      });
                    }
                } catch (summaryError) {
                    console.error(`Error summarizing cluster ${clusterId}, skipping:`, summaryError);
                }
            }
        }
        console.log(`Generated ${clusterSummariesInput.length} cluster summaries.`);
        await logService.saveEpisodeGenerationLog(generationLog);
    } else {
        console.log('Skipping cluster summarization as no clusters were found or clustering failed.');
        // POTENTIAL FALLBACK: If clustering failed or yielded no results, 
        // we might need to revert to prioritizing original topics.
        // For now, we proceed, potentially with an empty clusterSummariesInput.
    }
    
    
    // 2a. Prioritize topics (now clusters) for deep dive research
    console.log('Step 2a: Prioritizing topic clusters for deep dive research');
    const prioritizationStartTime = Date.now();
    // Pass the generated cluster summaries to the updated prioritization function
    const prioritizedTopics = await deepDiveResearch.prioritizeTopicsForDeepDive(
      clusterSummariesInput, // Pass the generated cluster summaries
      episodeAnalysis,
      targetWordCount
    );
    const prioritizationEndTime = Date.now();
    const prioritizationProcessingTime = prioritizationEndTime - prioritizationStartTime;
    console.log(`Topic cluster prioritization complete: Selected ${prioritizedTopics.length} clusters for deep research`);
    
    // Update log with prioritization results
    generationLog.stages.prioritization = {
      prioritizedTopics: prioritizedTopics.map(topic => ({
        topic: topic.topic,
        importance: topic.importance,
        newsworthiness: topic.newsworthiness,
        depthPotential: topic.depthPotential,
        rationale: topic.rationale,
        keyQuestions: topic.keyQuestions
      })),
      discardedTopics: clusterSummariesInput
        .map(c => c.summary)
        .filter(summary => !prioritizedTopics.some(pt => pt.topic === summary)),
      selectionReasoning: `Selected ${prioritizedTopics.length} topics based on newsworthiness, depth potential, and differentiation from previous episodes.`,
      processingTimeMs: prioritizationProcessingTime
    };
    generationLog.duration.stageBreakdown.prioritization = prioritizationProcessingTime;
    generationLog.duration.totalMs += prioritizationProcessingTime;
    
    // Add decision to log for prioritization
    generationLog.decisions.push({
      stage: 'prioritization',
      decision: `Selected ${prioritizedTopics.length} topics for deep research: ${prioritizedTopics.map(t => t.topic).join(', ')}`,
      reasoning: 'Topics were selected based on newsworthiness, depth potential, and differentiation from previous episodes',
      alternatives: generationLog.stages.prioritization?.discardedTopics || [],
      timestamp: new Date().toISOString()
    });
    await logService.saveEpisodeGenerationLog(generationLog);
    
    // 2b. NEW: Conduct deep dive research on prioritized topics
    console.log('Step 2b: Conducting deep dive research');
    const deepResearchStartTime = Date.now();
    const deepResearchResults = await deepDiveResearch.conductDeepDiveResearch(
      prioritizedTopics,
      targetWordCount
    );
    const deepResearchEndTime = Date.now();
    const deepResearchProcessingTime = deepResearchEndTime - deepResearchStartTime;
    console.log(`Deep research complete: Researched ${deepResearchResults.researchedTopics.length} topics in depth`);
    
    // Update log with deep research results
    generationLog.stages.deepResearch = {
      researchedTopics: deepResearchResults.researchedTopics.map(topic => ({
        topic: topic.topic,
        researchQueries: [], // Would need to capture this in the deep research function
        sourcesConsulted: [...new Set(topic.layers.flatMap(layer => layer.sources))],
        keyInsights: [...new Set(topic.layers.flatMap(layer => layer.keyInsights))],
        layerCount: topic.layers.length
      })),
      processingTimeMs: deepResearchProcessingTime
    };
    generationLog.duration.stageBreakdown.deepResearch = deepResearchProcessingTime;
    generationLog.duration.totalMs += deepResearchProcessingTime;
    
    // Add decision to log for deep research
    generationLog.decisions.push({
      stage: 'deep_research',
      decision: `Completed in-depth research on ${deepResearchResults.researchedTopics.length} topics`,
      reasoning: 'Deep research provides layered insights from surface to detailed levels',
      alternatives: [],
      timestamp: new Date().toISOString()
    });
    await logService.saveEpisodeGenerationLog(generationLog);
    
    let generatedContent;
    let researchResults;
    let narrativeStructure;
    
    // Determine whether to use deep dive or standard flow based on research results
    if (deepResearchResults.researchedTopics.length > 0) {
      // Use deep dive research results directly
      console.log('Using deep dive research results for content generation');
      
      // Generate a title without time-specific references
      const topicsList = deepResearchResults.researchedTopics.map(r => r.topic).join(' and ');
      
      // Start content generation timing
      const contentGenStartTime = Date.now();
      
      generatedContent = {
        title: `${podcast.title}: Deep Dive into ${topicsList}`,
        description: `An in-depth exploration of ${topicsList}.`,
        content: deepResearchResults.overallContent
      };

      // Update log with content generation
      generationLog.stages.contentGeneration = {
        generatedTitle: generatedContent.title,
        generatedDescription: generatedContent.description,
        topicDistribution: deepResearchResults.topicDistribution,
        estimatedWordCount: generatedContent.content.split(/\s+/).length,
        estimatedDuration: generatedContent.content.split(/\s+/).length / wordsPerMinute,
        processingTimeMs: Date.now() - contentGenStartTime
      };
      generationLog.duration.stageBreakdown.contentGeneration = Date.now() - contentGenStartTime;
      generationLog.duration.totalMs += Date.now() - contentGenStartTime;
      
      // Add decision to log for content generation
      generationLog.decisions.push({
        stage: 'content_generation',
        decision: `Generated episode with title: ${generatedContent.title}`,
        reasoning: 'Using deep dive research to create comprehensive content',
        alternatives: [],
        timestamp: new Date().toISOString()
      });
      await logService.saveEpisodeGenerationLog(generationLog);
      
      // Create a compatible structure for content differentiator
      researchResults = {
        topicResearch: deepResearchResults.researchedTopics.map(topic => ({
          topic: topic.topic,
          mainResearch: {
            content: topic.layers.map(layer => layer.content).join('\n\n'),
            sources: [...new Set(topic.layers.flatMap(layer => layer.sources))]
          },
          contrastingViewpoints: {
            content: '', // Not directly available from deep research
            sources: []
          },
          synthesizedContent: topic.synthesizedContent
        })),
        overallSynthesis: deepResearchResults.overallContent,
        allSources: deepResearchResults.allSources
      };
    } else {
      // Fall back to the standard flow if deep research didn't yield results
      console.log('[Generator] Falling back to standard episode planning flow');
      
      // 3. Have Gemini decide on topics and depth (standard flow)
      console.log('[Generator] Step 3: Planning episode content (searchOrchestrator.planEpisodeContent)');
      let episodePlan;
      try {
          episodePlan = await searchOrchestrator.planEpisodeContent(
            podcast, 
            episodeAnalysis, 
            initialSearchResults
          );
          console.log(`[Generator] Episode plan created: "${episodePlan.episodeTitle}" with ${episodePlan.selectedTopics.length} topics`);
      } catch (planError) {
          console.error('[Generator] Error during episode planning:', planError);
          throw new Error('Episode planning failed.'); // Rethrow to be caught by main handler
      }
      
      // 3a. Create enhanced narrative structure with word allocation
      console.log('[Generator] Step 3a: Creating detailed narrative structure (narrativePlanner.createNarrativeStructure)');
      
      // Convert episodePlan to DetailedResearchResults for narrativePlanner
      const preliminaryResearchResults: narrativePlanner.DetailedResearchResults = {
        episodeTitle: episodePlan.episodeTitle,
        overallSynthesis: episodePlan.selectedTopics.map(t => t.topic).join(', '),
        topicResearch: episodePlan.selectedTopics.map(topic => ({
          topic: topic.topic,
          synthesizedContent: topic.hasOwnProperty('initialContent') ? 
            (topic as any).initialContent : 
            `Research on ${topic.topic} - ${topic.rationale}`
        }))
      };
      
      try {
          narrativeStructure = await narrativePlanner.createNarrativeStructure(
            preliminaryResearchResults,
            'medium' // Use medium length as default
          );
          console.log(`[Generator] Narrative structure created with ${narrativeStructure.bodySections.length} sections`);
      } catch (narrativeError) {
          console.error('[Generator] Error creating narrative structure:', narrativeError);
          throw new Error('Narrative structure creation failed.');
      }
      
      // 4. Perform deep research with contrasting viewpoints
      console.log('[Generator] Step 4: Performing deep research on selected topics (searchOrchestrator.performDeepResearch)');
      try {
          researchResults = await searchOrchestrator.performDeepResearch(episodePlan);
          console.log(`[Generator] Research complete: ${researchResults.topicResearch.length} topics researched, ${researchResults.allSources.length} sources`);
      } catch (researchError) {
          console.error('[Generator] Error during deep research:', researchError);
          throw new Error('Deep research failed.');
      }
      
      // 5. Generate structured content following the narrative plan
      console.log('[Generator] Step 5: Generating structured content (contentFormatter.generateStructuredContent)');
      let structuredContent;
      try {
          structuredContent = await contentFormatter.generateStructuredContent(
            researchResults,
            narrativeStructure
          );
          console.log(`[Generator] Structured content generated (${structuredContent.split(/\s+/).length} words)`);
      } catch (contentGenError) {
          console.error('[Generator] Error generating structured content:', contentGenError);
          throw new Error('Structured content generation failed.'); // This is likely the synthesis failure point
      }
      
      // Generate episode title and description
      generatedContent = {
        title: episodePlan.episodeTitle,
        description: `An exploration of ${episodePlan.selectedTopics.map(t => t.topic).join(', ')}.`,
        content: structuredContent
      };
    }
    
    // 6. Ensure content differentiation
    console.log('[Generator] Step 6: Validating content differentiation (contentDifferentiator.validateContentDifferentiation)');
    let validationResult;
    try {
        validationResult = await contentDifferentiator.validateContentDifferentiation(
          generatedContent.content,
          episodeAnalysis
        );
        console.log(`[Generator] Validation complete: Similarity score ${validationResult.similarityScore}, passing: ${validationResult.isPassing}`);
    } catch (validationError) {
        console.error('[Generator] Error during content differentiation validation:', validationError);
        // Non-critical, proceed with original content if validation fails
        validationResult = { isPassing: true, similarityScore: -1, improvedContent: null }; 
    }
    
    // Use the final content (either original or improved version if needed)
    const finalContent = validationResult.improvedContent || generatedContent.content;
    
    // Create adherence feedback for storage
    let adherenceFeedback = '';
    let narrativeForStorage = null;
    
    // Only evaluate narrative adherence if using standard flow with narrative structure
    if (narrativeStructure) {
      // 7. Evaluate adherence to narrative structure
      console.log('Step 7: Evaluating adherence to narrative structure');
      const updatedNarrativeStructure = await narrativePlanner.evaluateContentAdherence(
        finalContent,
        narrativeStructure
      );
      
      // Safely access adherenceMetrics
      if (updatedNarrativeStructure.adherenceMetrics) {
           console.log(`Adherence evaluation complete: overall score ${updatedNarrativeStructure.adherenceMetrics.overallAdherence}`);
           // Create adherence feedback for storage
           adherenceFeedback = contentFormatter.createAdherenceFeedback(updatedNarrativeStructure);
           console.log(adherenceFeedback);
      
           // Format narrative structure for storage
           narrativeForStorage = {
             introduction: {
               wordCount: updatedNarrativeStructure.introduction.wordCount,
               approach: updatedNarrativeStructure.introduction.approach
             },
             bodySections: updatedNarrativeStructure.bodySections.map(section => ({
               sectionTitle: section.sectionTitle,
               wordCount: section.wordCount
             })),
             conclusion: {
               wordCount: updatedNarrativeStructure.conclusion.wordCount
             },
             adherenceMetrics: updatedNarrativeStructure.adherenceMetrics
           };
      } else {
          console.warn('Adherence metrics were not generated by evaluateContentAdherence.');
          narrativeForStorage = null; // Ensure narrativeForStorage is null if metrics are missing
          adherenceFeedback = 'Adherence evaluation did not produce metrics.';
      }
    }
    
    // Count words
    const wordCount = finalContent.split(/\s+/).length;
    console.log(`Generated content word count: ${wordCount} words`);
    
    // Compare with target word count and log the difference
    const actualMinutes = wordCount / wordsPerMinute;
    console.log(`Target: ${targetWordCount} words (${targetMinutes.toFixed(1)} minutes)`);
    console.log(`Actual: ${wordCount} words (${actualMinutes.toFixed(1)} minutes)`);
    console.log(`Difference: ${wordCount - targetWordCount} words (${(actualMinutes - targetMinutes).toFixed(1)} minutes)`);
    console.log(`Adherence: ${(wordCount / targetWordCount * 100).toFixed(1)}% of target length`);
    
    // Create the episode
    const episodeData: any = {
      podcastId: podcastId,
      title: generatedContent.title.slice(0, 100),
      description: generatedContent.description.slice(0, 150),
      content: finalContent,
      sources: researchResults.allSources,
      created_at: new Date().toISOString()
    };
    
    // Generate bullet points for the episode
    try {
      console.log('Generating bullet points for the episode...');
      const bulletPoints = await contentFormatter.generateEpisodeBulletPoints(
        episodeData.title,
        finalContent
      );
      episodeData.bulletPoints = bulletPoints;
      console.log(`Generated ${bulletPoints.length} bullet points for the episode`);
    } catch (bulletPointError) {
      console.error('Error generating bullet points:', bulletPointError);
      // Continue without bullet points if there's an error - non-critical
    }
    
    // Only add narrative structure if it exists
    if (narrativeForStorage) {
      episodeData.narrativeStructure = narrativeForStorage;
    }
    
    const episode = await createEpisode(episodeData);
    
    // Update the podcast's last_updated field
    await updatePodcast(podcastId, {
      last_updated: new Date().toISOString()
    });
    
    // Update the generation log with episode ID
    const updatedLog = logService.setEpisodeId(generationLog, episode.id);
    console.log(`Setting episode ID ${episode.id} in generation log ${updatedLog.id}`);
    await logService.saveEpisodeGenerationLog(updatedLog);
    
    // Generate audio for the episode
    const audioStartTime = Date.now();
    console.log('Generating audio for the episode...');
    const audioUrl = await generateAndStoreAudio(
      episode.content!, 
      podcast.id!, 
      episode.id!
    );
    
    // Update the episode with the audio URL
    await updateEpisodeAudio(episode.id!, audioUrl);
    
    // Update log with audio generation
    updatedLog.stages.audioGeneration = {
      audioFileSize: 0, // Would need to get this information
      audioDuration: updatedLog.stages.contentGeneration?.estimatedDuration || 0,
      processingTimeMs: Date.now() - audioStartTime
    };
    updatedLog.duration.stageBreakdown.audioGeneration = Date.now() - audioStartTime;
    updatedLog.duration.totalMs += Date.now() - audioStartTime;
    
    // Mark log as completed
    updatedLog.status = 'completed';
    await logService.saveEpisodeGenerationLog(updatedLog);
    
    // Respond with the saved episode including audio URL
    episode.audioUrl = audioUrl;
    
    res.status(201).json({
      episode: episode,
      generationLogId: updatedLog.id
    });
  } catch (error) {
    console.error('Error generating episode:', error);
    res.status(500).json({ error: 'Failed to generate episode' });
  }
});

// Helper function to update episode audio URL (Internal use, not a route)
async function updateEpisodeAudio(episodeId: string, audioUrl: string): Promise<void> {
  if (!episodeId) {
    console.error('Cannot update episode audio: Episode ID is undefined');
    throw new Error('Episode ID is required to update audio URL');
  }
  
  if (!audioUrl) {
    console.error('Cannot update episode audio: Audio URL is undefined');
    throw new Error('Audio URL is required to update episode');
  }
  
  try {
    await getDb().collection('episodes').doc(episodeId).update({ audioUrl });
    console.log(`Updated episode ${episodeId} with audio URL: ${audioUrl}`);
  } catch (error) {
    console.error(`Error updating episode ${episodeId} with audio URL:`, error);
    throw error;
  }
}

// Regenerate audio for an existing episode (Protected)
router.post('/:podcastId/episodes/:episodeId/regenerate-audio', authenticateToken, async (req, res) => {
  try {
    const { podcastId, episodeId } = req.params;
    console.log(`POST /api/podcasts/${podcastId}/episodes/${episodeId}/regenerate-audio`);
    
    // Add userId check
    if (!req.userId) {
      console.error('Error regenerating audio: No userId found on request.');
      return res.status(403).json({ error: 'Forbidden: User ID not found after authentication.' });
    }
    console.log(`Attempting regenerate by user ${req.userId}`);

    // Authorization Check: Verify user owns the parent podcast
    const podcast = await getPodcast(podcastId);
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    if (podcast.userId !== req.userId) {
      console.warn(`Forbidden: User ${req.userId} attempted to regenerate audio for episode ${episodeId} from podcast ${podcastId} owned by ${podcast.userId}`);
      return res.status(403).json({ error: 'Forbidden: You do not own the parent podcast' });
    }
    
    // Get the episode
    const episode = await getEpisode(episodeId);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    // Check if the episode has content
    if (!episode.content) {
      return res.status(400).json({ error: 'Episode has no content to generate audio for' });
    }
    
    // If episode already has audio, delete it first
    if (episode.audioUrl) {
      try {
        console.log(`Deleting existing audio for episode ${episodeId}`);
        await deleteAudio(podcastId, episodeId);
      } catch (deleteError) {
        console.error('Error deleting existing audio:', deleteError);
        // Continue anyway - non-critical error
      }
    }
    
    console.log(`Regenerating audio for episode ${episodeId}`);
    try {
      // Generate audio for the episode
      const audioUrl = await generateAndStoreAudio(
        episode.content, 
        podcastId, 
        episodeId
      );
      
      // Update the episode with the audio URL
      await updateEpisodeAudio(episodeId, audioUrl);
      
      // Return the updated episode
      res.json({
        ...episode,
        audioUrl
      });
    } catch (audioError) {
      console.error('Error regenerating audio:', audioError);
      const errorMessage = audioError.message || 'Unknown error occurred';
      res.status(500).json({ 
        error: 'Failed to regenerate audio',
        message: errorMessage,
        details: String(audioError)
      });
    }
  } catch (error) {
    console.error('Error regenerating audio for episode:', error);
    res.status(500).json({ 
      error: 'Failed to process request',
      message: error.message || 'Unknown error occurred'
    });
  }
});

// Update podcast details (Protected)
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id: podcastId } = req.params; // Use common variable name
    console.log(`PATCH /api/podcasts/${podcastId}`, req.body);

    // Add userId check
    if (!req.userId) {
      console.error('Error updating podcast: No userId found on request.');
      return res.status(403).json({ error: 'Forbidden: User ID not found after authentication.' });
    }
    console.log(`Attempting update by user ${req.userId}`);
    
    // Authorization Check: Verify user owns the podcast OR podcast is public
    // MUST pass req.userId here for getPodcast to perform visibility/ownership check
    const podcast = await getPodcast(podcastId, req.userId); 
    if (!podcast) {
      // This now correctly handles both "Not Found" and "Access Denied" from getPodcast
      return res.status(404).json({ error: 'Podcast not found or access denied' });
    }
    // Explicit check: ONLY the owner can PATCH, even if public
    if (podcast.ownerEmail !== req.userId) { 
      console.warn(`Forbidden: User ${req.userId} attempted to update podcast ${podcastId} owned by ${podcast.ownerEmail}`);
      return res.status(403).json({ error: 'Forbidden: You do not own this podcast' });
    }

    // Only allow updating certain fields (add visibility)
    const allowedFields = ['title', 'description', 'prompt', 'podcastType', 'visibility'];
    const updates: Partial<Podcast> = {};
    for (const key in req.body) {
      if (allowedFields.includes(key)) {
        // Basic validation for visibility
        if (key === 'visibility' && req.body[key] !== 'public' && req.body[key] !== 'private') {
          console.warn(`Invalid visibility value received: ${req.body[key]}`);
          continue; // Skip invalid visibility value
        }
        updates[key] = req.body[key];
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    await updatePodcast(podcastId, updates);
    
    // Get the updated podcast
    const updatedPodcast = await getPodcast(podcastId);
    res.json(updatedPodcast);
  } catch (error) {
    console.error('Error updating podcast:', error);
    res.status(500).json({ error: 'Failed to update podcast' });
  }
});

// Generate bullet points for all episodes in a podcast (Protected)
router.post('/:podcastId/generate-bullet-points', authenticateToken, async (req, res) => {
  try {
    const { podcastId } = req.params;
    console.log(`POST /api/podcasts/${podcastId}/generate-bullet-points`);

    // Add userId check
    if (!req.userId) {
      console.error('Error generating bullet points: No userId found on request.');
      return res.status(403).json({ error: 'Forbidden: User ID not found after authentication.' });
    }
    console.log(`Attempting generate by user ${req.userId}`);

    // Authorization Check: Verify user owns the podcast
    const podcast = await getPodcast(podcastId);
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    if (podcast.userId !== req.userId) {
      console.warn(`Forbidden: User ${req.userId} attempted to generate bullet points for podcast ${podcastId} owned by ${podcast.userId}`);
      return res.status(403).json({ error: 'Forbidden: You do not own this podcast' });
    }
    
    // Get all episodes for this podcast
    const episodes = await getEpisodesByPodcastId(podcastId);
    
    if (episodes.length === 0) {
      return res.status(404).json({ message: 'No episodes found for this podcast' });
    }
    
    console.log(`Found ${episodes.length} episodes. Generating bullet points...`);
    
    // Process episodes in batches to avoid overwhelming the Gemini API
    const batchSize = 5;
    const results = {
      total: episodes.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      details: []
    };
    
    // Process in batches
    for (let i = 0; i < episodes.length; i += batchSize) {
      const batch = episodes.slice(i, i + batchSize);
      console.log(`Processing batch ${i/batchSize + 1} (${batch.length} episodes)...`);
      
      // Process each episode in the batch concurrently
      await Promise.all(batch.map(async (episode) => {
        try {
          results.processed++;
          
          // Skip episodes that already have bullet points
          if (episode.bulletPoints && Array.isArray(episode.bulletPoints) && episode.bulletPoints.length > 0) {
            console.log(`Episode ${episode.id} already has bullet points, skipping`);
            results.succeeded++;
            results.details.push({
              episodeId: episode.id,
              title: episode.title,
              status: 'skipped',
              message: 'Already has bullet points'
            });
            return;
          }
          
          // Skip episodes without content
          if (!episode.content) {
            console.log(`Episode ${episode.id} has no content, skipping`);
            results.failed++;
            results.details.push({
              episodeId: episode.id,
              title: episode.title,
              status: 'failed',
              message: 'No content available'
            });
            return;
          }
          
          // Generate bullet points
          console.log(`Generating bullet points for episode ${episode.id}: ${episode.title}`);
          const bulletPoints = await contentFormatter.generateEpisodeBulletPoints(
            episode.title,
            episode.content
          );
          
          // Update the episode with bullet points
          await getDb().collection('episodes').doc(episode.id).update({
            bulletPoints: bulletPoints
          });
          
          console.log(`Updated episode ${episode.id} with ${bulletPoints.length} bullet points`);
          results.succeeded++;
          results.details.push({
            episodeId: episode.id,
            title: episode.title,
            status: 'success',
            bulletPointCount: bulletPoints.length
          });
        } catch (error) {
          console.error(`Error processing episode ${episode.id}:`, error);
          results.failed++;
          results.details.push({
            episodeId: episode.id,
            title: episode.title,
            status: 'failed',
            message: error.message || 'Unknown error'
          });
        }
      }));
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < episodes.length) {
        console.log('Waiting 2 seconds before processing next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`Bullet point generation complete: ${results.succeeded} succeeded, ${results.failed} failed`);
    res.json(results);
  } catch (error) {
    console.error('Error generating bullet points:', error);
    res.status(500).json({ error: 'Failed to generate bullet points' });
  }
});

// Update podcast visibility (Protected)
router.patch('/:id/visibility', authenticateToken, async (req, res) => {
  try {
    const { id: podcastId } = req.params;
    const { visibility } = req.body;
    
    // Validate input
    if (!visibility || !['public', 'private'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility value. Must be either "public" or "private".' });
    }
    
    // Get the podcast to check ownership
    const podcast = await getPodcast(podcastId, req.userId);
    
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    // Only the owner can change visibility
    if (podcast.ownerEmail !== req.userId) {
      return res.status(403).json({ error: 'You do not have permission to change this podcast\'s visibility' });
    }
    
    // Update the visibility
    await updatePodcast(podcastId, { visibility });
    
    res.status(200).json({ message: 'Podcast visibility updated successfully', visibility });
  } catch (error) {
    console.error('Error updating podcast visibility:', error);
    res.status(500).json({ error: 'Failed to update podcast visibility' });
  }
});

export default router; 
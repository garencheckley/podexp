import * as express from 'express';
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
import * as audio from '../services/audio';
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
import * as logService from '../services/logService';
import { addDecision, updateStage, setEpisodeId, completeLog, failLog } from '../services/logService';
import { generateRssFeed } from '../services/rssGenerator';

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
      await audio.deleteAudio(podcastId, episodeId);
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
      .map(episode => audio.deleteAudio(podcastId, episode.id));
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
    const audioUrl = await audio.generateAndStoreAudio(
      episode.content!, 
      podcast.id!, 
      episode.id!
    );
    
    // Update the episode with the audio URL
    await updateEpisodeAudio(episode.id!, audioUrl);
    
    // Update log with audio generation
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
  const { id: podcastId } = req.params;
  let generationLog; // Define log here to be accessible in catch blocks
  const logService = require('../services/logService'); // Require log service early

  try {
    console.log(`--- START Generate Episode for Podcast ID: ${podcastId} ---`);
    
    // Add userId check (early)
    if (!req.userId) {
      console.error('Generate episode error: No userId found on request.');
      return res.status(403).json({ error: 'Forbidden: User ID not found after authentication.' });
    }
    console.log(`Attempting generate by user ${req.userId}`);
    
    // Create a new episode generation log
    generationLog = logService.createEpisodeGenerationLog(podcastId);
    console.log(`Created episode generation log: ${generationLog.id}`);
    
    // --- Authorization --- 
    let podcast: Podcast | null;
    try {
      console.log('[Generate Step] Fetching & Authorizing Podcast...');
      podcast = await getPodcast(podcastId, req.userId);
      if (!podcast) {
        throw new Error('Podcast not found or access denied');
      }
      if (podcast.ownerEmail !== req.userId) { 
        throw new Error('Forbidden: You do not own this podcast');
      }
      console.log(`[Generate Step] Podcast authorized: ${podcast.title}`);
    } catch(authError: any) {
      console.error(`[Generate Step] Authorization Failed: ${authError.message}`);
      await logService.saveEpisodeGenerationLog(
        logService.failLog(generationLog, `Authorization Failed: ${authError.message}`)
      );
      return res.status(authError.message.includes('Forbidden') ? 403 : 404).json({ error: authError.message });
    }
    // --- End Authorization ---

    // --- Target Length Calculation --- 
    let targetWordCount = 300; // Default
    try {
      console.log('[Generate Step] Calculating Target Length...');
      const wordsPerMinute = 130;
      if (req.body.targetMinutes) {
        const minutes = parseFloat(req.body.targetMinutes);
        if (!isNaN(minutes) && minutes > 0) {
          targetWordCount = Math.round((minutes * wordsPerMinute) / 10) * 10;
        }
      } else if (req.body.targetWordCount) {
        const wordCount = parseInt(req.body.targetWordCount);
        if (!isNaN(wordCount) && wordCount > 0) {
          targetWordCount = wordCount;
        }
      }
      const minWordCount = 200; const maxWordCount = 2600;
      targetWordCount = Math.max(minWordCount, Math.min(targetWordCount, maxWordCount));
      const targetMinutes = targetWordCount / wordsPerMinute;
      console.log(`[Generate Step] Target length set: ${targetWordCount} words (~${targetMinutes.toFixed(1)} mins)`);
      generationLog = addDecision(generationLog, 'initialization', `Set target length to ${targetWordCount} words`, 'Based on request or defaults');
      await logService.saveEpisodeGenerationLog(generationLog);
    } catch (lengthError: any) { // Catch specific errors if possible
        console.error(`[Generate Step] Error calculating target length: ${lengthError.message}`);
        // Decide if this is fatal or can proceed with default
        await logService.saveEpisodeGenerationLog(failLog(generationLog, `Error calculating target length: ${lengthError.message}`));
        return res.status(500).json({ error: 'Failed during target length calculation', details: lengthError.message });
    }
    // --- End Target Length --- 

    // --- Source Refresh --- 
    try {
        console.log('[Generate Step] Refreshing Sources...');
        const analysisStartTime = Date.now(); // Reusing var name for timing
        const updatedSources = await sourceManager.refreshSourcesIfNeeded(podcast);
        if (updatedSources && JSON.stringify(updatedSources) !== JSON.stringify(podcast.sources)) {
            await updatePodcast(podcastId, { sources: updatedSources });
            podcast.sources = updatedSources;
            console.log(`[Generate Step] Sources refreshed: ${updatedSources.length} sources`);
            generationLog = addDecision(generationLog, 'source_refresh', 'Updated podcast sources', 'Sources required refreshing');
        } else {
             console.log('[Generate Step] Sources did not require refresh.');
        }
         generationLog.duration.stageBreakdown.sourceRefresh = Date.now() - analysisStartTime; // Log time for this step
         generationLog.duration.totalMs += generationLog.duration.stageBreakdown.sourceRefresh;
         await logService.saveEpisodeGenerationLog(generationLog);
    } catch (sourceRefreshError: any) {
        console.error(`[Generate Step] Non-fatal error refreshing sources: ${sourceRefreshError.message}. Proceeding with existing sources.`);
        generationLog = addDecision(generationLog, 'source_refresh', 'Proceeded without refreshed sources', `Non-fatal error during refresh: ${sourceRefreshError.message}`);
        await logService.saveEpisodeGenerationLog(generationLog);
    }
    // --- End Source Refresh --- 

    // --- Episode Analysis --- 
    let episodeAnalysis;
    try {
      console.log('[Generate Step] Analyzing Existing Episodes...');
      const analysisStartTime = Date.now();
      episodeAnalysis = await episodeAnalyzer.analyzeExistingEpisodes(podcastId);
      generationLog = updateStage(generationLog, 'episodeAnalysis', { ...episodeAnalysis, processingTimeMs: Date.now() - analysisStartTime }, Date.now() - analysisStartTime);
      generationLog = addDecision(generationLog, 'episode_analysis', `Analyzed ${episodeAnalysis.episodeCount} previous episodes`, 'Required for content differentiation');
      await logService.saveEpisodeGenerationLog(generationLog);
      console.log(`[Generate Step] Episode analysis complete.`);
    } catch (analysisError: any) {
      console.error(`[Generate Step] Error during episode analysis: ${analysisError.message}`);
      await logService.saveEpisodeGenerationLog(failLog(generationLog, `Episode analysis failed: ${analysisError.message}`));
      return res.status(500).json({ error: 'Failed during episode analysis', details: analysisError.message });
    }
    // --- End Episode Analysis ---

    // --- Initial Search --- 
    let initialSearchResults;
    try {
      console.log('[Generate Step] Performing Initial Search...');
      const searchStartTime = Date.now();
      initialSearchResults = await searchOrchestrator.performInitialSearch(podcast, episodeAnalysis);
      generationLog = updateStage(generationLog, 'initialSearch', {
        potentialTopics: initialSearchResults.potentialTopics,
        relevantSources: initialSearchResults.relevantSources || [],
        processingTimeMs: Date.now() - searchStartTime,
        geminiPrompt: initialSearchResults.geminiPrompt
      }, Date.now() - searchStartTime);
      generationLog = addDecision(generationLog, 'initial_search', `Found ${initialSearchResults.potentialTopics.length} potential topics`, 'Discovering current/relevant topics');
      await logService.saveEpisodeGenerationLog(generationLog);
      console.log(`[Generate Step] Initial search complete.`);
    } catch (searchError: any) {
      console.error(`[Generate Step] Error during initial search: ${searchError.message}`);
      await logService.saveEpisodeGenerationLog(failLog(generationLog, `Initial search failed: ${searchError.message}`));
      return res.status(500).json({ error: 'Failed during initial search', details: searchError.message });
    }
    // --- End Initial Search --- 

    // --- Source-Guided Search --- 
    let combinedResearchContent = initialSearchResults.combinedResearch;
    let combinedSources = initialSearchResults.allSources;
    try {
        console.log('[Generate Step] Performing Source-Guided Search...');
        const searchStartTime = Date.now(); // Reusing var name for timing
        const topicNames = initialSearchResults.potentialTopics.map(topic => topic.topic);
        const sourceGuidedResults = await sourceManager.performSourceGuidedSearch(podcast, topicNames);
        if (sourceGuidedResults.content) {
            combinedResearchContent += '\n\n--- Source Guided Search Results ---\n' + sourceGuidedResults.content;
            combinedSources = [...new Set([...combinedSources, ...sourceGuidedResults.sources])];
        }
        generationLog.duration.stageBreakdown.sourceGuidedSearch = Date.now() - searchStartTime; // Log time
        generationLog.duration.totalMs += generationLog.duration.stageBreakdown.sourceGuidedSearch;
        generationLog = addDecision(generationLog, 'source_guided_search', `Completed with ${sourceGuidedResults.sources.length} sources`, 'Supplementing web search');
        await logService.saveEpisodeGenerationLog(generationLog);
        console.log(`[Generate Step] Source-guided search complete.`);
    } catch (sourceSearchError: any) {
        console.error(`[Generate Step] Non-fatal error during source-guided search: ${sourceSearchError.message}. Proceeding without these results.`);
        generationLog = addDecision(generationLog, 'source_guided_search', 'Proceeded without source-guided results', `Non-fatal error: ${sourceSearchError.message}`);
        await logService.saveEpisodeGenerationLog(generationLog);
    }
    // --- End Source-Guided Search --- 

    // --- Clustering --- 
    let clusterResult: clusteringService.ClusterResult = { clusters: {}, noise: [], clusterAssignments: [] };
    let clusterSummariesInput: clusteringService.ClusterSummaryInput[] = [];
    try {
        console.log('[Generate Step] Clustering Topics...');
        const clusterStartTime = Date.now();
        const articlesToCluster: clusteringService.ArticleData[] = initialSearchResults.potentialTopics.map((topic, index) => ({ id: topic.topic || `topic_${index}`, content: topic.topic || '' }));
        if (articlesToCluster.length > 0) {
            clusterResult = await clusteringService.clusterArticles(articlesToCluster);
            generationLog = updateStage(generationLog, 'clustering', { inputTopics: articlesToCluster.map(a => a.id), clusters: clusterResult.clusters, clusterSummaries: [], processingTimeMs: Date.now() - clusterStartTime }, Date.now() - clusterStartTime);
            generationLog = addDecision(generationLog, 'clustering', `Grouped topics into ${Object.keys(clusterResult.clusters).length} clusters`, 'Improving thematic focus');
            console.log(`[Generate Step] Clustering complete: ${Object.keys(clusterResult.clusters).length} clusters found.`);

            // --- Cluster Summarization --- 
            console.log('[Generate Step] Summarizing Clusters...');
            if (clusterResult.clusters && Object.keys(clusterResult.clusters).length > 0) {
                const clusterIds = Object.keys(clusterResult.clusters).map(Number);
                for (const clusterId of clusterIds) {
                    const topicIds = clusterResult.clusters[clusterId];
                    if (topicIds && topicIds.length > 0) {
                        try {
                            const summary = await clusteringService.summarizeCluster(clusterId, topicIds, initialSearchResults);
                            clusterSummariesInput.push({ clusterId, summary, originalTopicIds: topicIds });
                            if (generationLog.stages.clustering) {
                                generationLog.stages.clustering.clusterSummaries.push({ clusterId, summary, originalTopicIds: topicIds });
                            }
                        } catch (summaryError: any) {
                            console.error(`[Generate Step] Non-fatal error summarizing cluster ${clusterId}: ${summaryError.message}`);
                        }
                    }
                }
            }
            console.log(`[Generate Step] Cluster summarization complete: ${clusterSummariesInput.length} summaries generated.`);
        } else {
            console.log('[Generate Step] Skipping clustering and summarization: No topics found.');
            generationLog = addDecision(generationLog, 'clustering', 'Skipped clustering', 'No topics from initial search');
        }
        await logService.saveEpisodeGenerationLog(generationLog);
    } catch (clusterError: any) {
        console.error(`[Generate Step] Non-fatal error during clustering/summarization: ${clusterError.message}. Proceeding without clusters.`);
        generationLog = addDecision(generationLog, 'clustering', 'Proceeded without clustering due to error', `Non-fatal error: ${clusterError.message}`);
        await logService.saveEpisodeGenerationLog(generationLog);
        // Reset cluster results if failed
        clusterSummariesInput = []; 
    }
    // --- End Clustering & Summarization ---

    // --- Prioritization --- 
    let prioritizedTopics;
    try {
      console.log('[Generate Step] Prioritizing Topics/Clusters...');
      const prioritizationStartTime = Date.now();
      // Prioritize cluster summaries if available, otherwise fall back to initial potential topics
      const topicsToPrioritize = clusterSummariesInput.length > 0 ? clusterSummariesInput : initialSearchResults.potentialTopics;
      prioritizedTopics = await deepDiveResearch.prioritizeTopicsForDeepDive(topicsToPrioritize, episodeAnalysis, targetWordCount);
      generationLog = updateStage(generationLog, 'prioritization', { prioritizedTopics, discardedTopics: [], selectionReasoning: 'Using selected topics/clusters', processingTimeMs: Date.now() - prioritizationStartTime }, Date.now() - prioritizationStartTime);
      generationLog = addDecision(generationLog, 'prioritization', `Selected ${prioritizedTopics.length} topics/clusters for deep research`, 'Based on relevance, depth, differentiation');
      await logService.saveEpisodeGenerationLog(generationLog);
      console.log(`[Generate Step] Prioritization complete.`);
    } catch (prioritizationError: any) {
      console.error(`[Generate Step] Error during prioritization: ${prioritizationError.message}`);
      await logService.saveEpisodeGenerationLog(failLog(generationLog, `Prioritization failed: ${prioritizationError.message}`));
      return res.status(500).json({ error: 'Failed during topic prioritization', details: prioritizationError.message });
    }
    // --- End Prioritization --- 

    // --- Deep Research --- 
    let deepResearchResults;
    try {
      console.log('[Generate Step] Conducting Deep Dive Research...');
      const researchStartTime = Date.now();
      deepResearchResults = await deepDiveResearch.conductDeepDiveResearch(prioritizedTopics, targetWordCount);
      
      if (!deepResearchResults || !deepResearchResults.overallContent || deepResearchResults.overallContent.trim().length < 50) {
          console.error('[Generate Step] Deep research resulted in invalid or insufficient overallContent.');
          throw new Error('Deep research phase failed to produce valid content.');
      }
      
      generationLog = updateStage(generationLog, 'deepResearch', { ...deepResearchResults, processingTimeMs: Date.now() - researchStartTime }, Date.now() - researchStartTime);
      generationLog = addDecision(generationLog, 'deep_research', `Completed deep research on ${deepResearchResults.researchedTopics.length} topics`, 'Gathering layered insights');
      await logService.saveEpisodeGenerationLog(generationLog);
      console.log(`[Generate Step] Deep research complete.`);
    } catch (researchError: any) {
      console.error(`[Generate Step] Error during deep research: ${researchError.message}`);
      await logService.saveEpisodeGenerationLog(failLog(generationLog, `Deep research failed: ${researchError.message}`));
      return res.status(500).json({ error: 'Failed during deep research', details: researchError.message });
    }
    // --- End Deep Research --- 

    // --- Content Generation --- 
    let generatedContent;
    let researchResultsForDiff; // Keep separate for differentiator
    try {
        console.log('[Generate Step] Generating Content...');
        const generationStartTime = Date.now();
        const topicsList = deepResearchResults.researchedTopics.map(r => r.topic).join(' and ');
        generatedContent = {
            title: `${podcast.title}: Deep Dive into ${topicsList}`.slice(0,100), // Title based on research
            description: `An in-depth exploration of ${topicsList}.`.slice(0,150),
            content: deepResearchResults.overallContent // Use the synthesized content
        };
        researchResultsForDiff = { // Structure needed for differentiation check
            topicResearch: deepResearchResults.researchedTopics.map(topic => ({ /* ... structure as needed ... */ topic: topic.topic, synthesizedContent: topic.synthesizedContent })),
            overallSynthesis: deepResearchResults.overallContent,
            allSources: deepResearchResults.allSources
        };
        const wordCount = generatedContent.content.split(/\s+/).length;
        const actualMinutes = wordCount / 130;
        generationLog = updateStage(generationLog, 'contentGeneration', { 
            generatedTitle: generatedContent.title,
            estimatedWordCount: wordCount,
            estimatedDuration: actualMinutes,
            processingTimeMs: Date.now() - generationStartTime 
        }, Date.now() - generationStartTime);
        generationLog = addDecision(generationLog, 'content_generation', `Generated content: ${generatedContent.title}`, 'Using deep research results');
        await logService.saveEpisodeGenerationLog(generationLog);
        console.log(`[Generate Step] Content generation complete (${wordCount} words).`);
    } catch (contentGenError: any) {
        console.error(`[Generate Step] Error during content generation: ${contentGenError.message}`);
        await logService.saveEpisodeGenerationLog(failLog(generationLog, `Content generation failed: ${contentGenError.message}`));
        return res.status(500).json({ error: 'Failed during content generation', details: contentGenError.message });
    }
    // --- End Content Generation --- 

    // --- Content Differentiation --- 
    let finalContent = generatedContent.content;
    try {
      console.log('[Generate Step] Validating Content Differentiation...');
      const validationStartTime = Date.now();
      const validationResult = await contentDifferentiator.validateContentDifferentiation(
        generatedContent.content, 
        episodeAnalysis
      );
      finalContent = validationResult.improvedContent || generatedContent.content;
      generationLog.duration.stageBreakdown.differentiation = Date.now() - validationStartTime;
      generationLog.duration.totalMs += generationLog.duration.stageBreakdown.differentiation;
      generationLog = addDecision(generationLog, 'differentiation', `Validation passing: ${validationResult.isPassing}`, `Similarity score: ${validationResult.similarityScore.toFixed(3)}`);
      await logService.saveEpisodeGenerationLog(generationLog);
      console.log(`[Generate Step] Differentiation validation complete. Passing: ${validationResult.isPassing}`);
    } catch (diffError: any) {
      console.error(`[Generate Step] Non-fatal error during differentiation validation: ${diffError.message}. Proceeding with generated content.`);
      generationLog = addDecision(generationLog, 'differentiation', 'Proceeded without differentiation check', `Non-fatal error: ${diffError.message}`);
      await logService.saveEpisodeGenerationLog(generationLog);
    }
    // --- End Content Differentiation --- 

    // --- Bullet Point Generation --- 
    let bulletPoints: string[] = [];
    try {
        console.log('[Generate Step] Generating Bullet Points...');
        const bulletPointStartTime = Date.now();
        bulletPoints = await contentFormatter.generateEpisodeBulletPoints(generatedContent.title, finalContent);
        generationLog.duration.stageBreakdown.bulletPoints = Date.now() - bulletPointStartTime;
        generationLog.duration.totalMs += generationLog.duration.stageBreakdown.bulletPoints;
        generationLog = addDecision(generationLog, 'bullet_points', `Generated ${bulletPoints.length} bullet points`, '');
        await logService.saveEpisodeGenerationLog(generationLog);
        console.log(`[Generate Step] Bullet point generation complete.`);
    } catch (bulletPointError: any) {
        console.error(`[Generate Step] Non-fatal error generating bullet points: ${bulletPointError.message}. Proceeding without them.`);
        generationLog = addDecision(generationLog, 'bullet_points', 'Proceeded without bullet points', `Non-fatal error: ${bulletPointError.message}`);
        await logService.saveEpisodeGenerationLog(generationLog);
    }
    // --- End Bullet Point Generation --- 

    // --- Database Episode Creation --- 
    let episode: Episode;
    try {
      console.log('[Generate Step] Creating Episode in Database...');
      const episodeData: any = {
        podcastId: podcastId,
        title: generatedContent.title,
        description: generatedContent.description,
        content: finalContent,
        sources: researchResultsForDiff.allSources, // Use sources from the research step
        created_at: new Date().toISOString(),
        bulletPoints: bulletPoints, // Add generated bullet points
      };
      episode = await createEpisode(episodeData);
      await updatePodcast(podcastId, { last_updated: new Date().toISOString() });
      generationLog = setEpisodeId(generationLog, episode.id); // Update log with Episode ID
      await logService.saveEpisodeGenerationLog(generationLog);
      console.log(`[Generate Step] Episode created in DB: ${episode.id}`);
    } catch (dbError: any) {
      console.error(`[Generate Step] Error saving episode to database: ${dbError.message}`);
      await logService.saveEpisodeGenerationLog(failLog(generationLog, `Database episode creation failed: ${dbError.message}`));
      return res.status(500).json({ error: 'Failed to save episode to database', details: dbError.message });
    }
    // --- End Database Episode Creation --- 

    // --- Audio Generation --- 
    let audioUrl = '';
    try {
      console.log('[Generate Step] Generating Audio...');
      const audioStartTime = Date.now();
      audioUrl = await audio.generateAndStoreAudio(finalContent, podcast.id!, episode.id!);
      await updateEpisodeAudio(episode.id!, audioUrl);
      generationLog = updateStage(generationLog, 'audioGeneration', { audioUrl, audioDuration: 0, audioFileSize: 0, processingTimeMs: Date.now() - audioStartTime }, Date.now() - audioStartTime);
      generationLog = addDecision(generationLog, 'audio_generation', 'Audio generated and stored', '');
      await logService.saveEpisodeGenerationLog(generationLog);
      console.log(`[Generate Step] Audio generation complete: ${audioUrl}`);
    } catch (audioError: any) {
      console.error(`[Generate Step] Error during audio generation: ${audioError.message}`);
      // Log failure but maybe don't fail the whole request?
      // Or maybe we should? Decided to fail for now.
      await logService.saveEpisodeGenerationLog(failLog(generationLog, `Audio generation failed: ${audioError.message}`));
      return res.status(500).json({ error: 'Failed during audio generation', details: audioError.message });
    }
    // --- End Audio Generation --- 

    // --- Finalize --- 
    console.log('[Generate Step] Finalizing...');
    generationLog.status = 'completed';
    await logService.saveEpisodeGenerationLog(generationLog);
    
    // Respond with the saved episode including audio URL
    episode.audioUrl = audioUrl;
    
    console.log(`--- END Generate Episode Successfully for Podcast ID: ${podcastId} ---`);
    res.status(201).json({
      episode: episode,
      generationLogId: generationLog.id
    });

  } catch (error: any) {
    console.error(`--- Error Generating Episode for Podcast ID: ${podcastId} ---`);
    console.error(`Error Name: ${error.name}`);
    console.error(`Error Message: ${error.message}`);
    console.error(`Error Stack: ${error.stack}`);
    // Ensure log is defined before trying to fail it
    if (generationLog) {
       await logService.saveEpisodeGenerationLog(
         failLog(generationLog, `Unhandled generation error: ${error.message}`)
       );
    } else {
        console.error('Generation log was not initialized before the error occurred.');
    }
    res.status(500).json({ error: 'Failed to generate episode', details: error.message });
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
        await audio.deleteAudio(podcastId, episodeId);
      } catch (deleteError) {
        console.error('Error deleting existing audio:', deleteError);
        // Continue anyway - non-critical error
      }
    }
    
    console.log(`Regenerating audio for episode ${episodeId}`);
    try {
      // Generate audio for the episode
      const audioUrl = await audio.generateAndStoreAudio(
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

// Get RSS feed for podcast (Public endpoint with visibility check)
router.get('/:id/rss', authenticateTokenOptional, async (req, res) => {
  try {
    const { id: podcastId } = req.params;
    console.log(`GET /api/podcasts/${podcastId}/rss`);

    // Get the podcast
    const podcast = await getPodcast(podcastId, req.userId);
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found or access denied' });
    }

    // Get all episodes for the podcast
    const episodes = await getEpisodesByPodcastId(podcastId);

    // Generate RSS feed
    const rssFeed = generateRssFeed(podcast, episodes);

    // Set content type to XML
    res.setHeader('Content-Type', 'application/xml');
    res.send(rssFeed);
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    res.status(500).json({ error: 'Failed to generate RSS feed' });
  }
});

export default router; 
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
import { llmLogger } from '../services/llmLogger';

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
      
      // Enhanced logging to debug Gemini API call
      if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set. Proceeding to fallback.');
      } else {
        console.log('GEMINI_API_KEY is set. Proceeding to generate title.');
      }

      console.log('Sending title prompt to Gemini:', titlePrompt);
      
      try {
        const result = await model.generateContent(titlePrompt);
        const generatedTitle = result.response.text().trim();
        console.log('Generated title:', generatedTitle);
        
        // Add the generated title to the request body
        req.body.title = generatedTitle;
      } catch (titleError: any) {
        // Log the specific error from the Gemini API call
        console.error('Error generating title from Gemini:', titleError.message);
        console.error('Full Gemini Error:', JSON.stringify(titleError, null, 2));

        // If title generation fails, create a descriptive title from the prompt
        const words = prompt.split(/\s+/);
        let descriptiveTitle = '';
        
        // NEW FALLBACK LOGIC: Use the start of the prompt for the title.
        // This avoids the old logic of trying to find "character names".
        
        // Take the first 6 words, but not more than 60 characters.
        descriptiveTitle = words.slice(0, 6).join(' ');
        if (descriptiveTitle.length > 60) {
          descriptiveTitle = words.slice(0, 4).join(' ');
        }
        
        // Ensure the title is unique by adding a number if needed
        let counter = 1;
        let finalTitle = descriptiveTitle;
        while (existingTitles.includes(finalTitle)) {
          counter++;
          finalTitle = `${descriptiveTitle} ${counter}`;
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

// Get episodes by podcast ID (Apply OPTIONAL auth)
router.get('/:podcastId/episodes', authenticateTokenOptional, async (req, res) => {
  try {
    const { podcastId } = req.params;
    // req.userId may be undefined if not logged in
    console.log(`GET /api/podcasts/${podcastId}/episodes for user ${req.userId || 'anonymous'}`);

    // Fetch the podcast with or without userId
    const podcast = await getPodcast(podcastId, req.userId);
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found or access denied' });
    }
    // If the podcast is private and the user is not the owner, deny access
    if (podcast.visibility === 'private' && podcast.ownerEmail !== req.userId) {
      return res.status(403).json({ error: 'Forbidden: This podcast is private.' });
    }
    // Fetch episodes
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

// Interface for topic options response
interface TopicOption {
  id: string;
  topic: string;
  description: string;
  relevance: number;
  recency: string;
  query: string;
  reasoning: string;
}

// New endpoint to get topic options before generation
router.post('/:id/get-topic-options', authenticateToken, async (req, res) => {
  const { id: podcastId } = req.params;

  try {
    console.log(`--- START Get Topic Options for Podcast ID: ${podcastId} ---`);

    // Add userId check (early)
    if (!req.userId) {
      console.error('Get topic options error: No userId found on request.');
      return res.status(403).json({ error: 'Forbidden: User ID not found after authentication.' });
    }
    console.log(`Getting topic options for user ${req.userId}`);

    // --- Get Podcast --- 
    const podcast = await getPodcast(podcastId, req.userId);
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found or access denied' });
    }

    // Check ownership
    if (podcast.ownerEmail !== req.userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this podcast' });
    }

    // --- Source Refresh --- 
    try {
      console.log('[Topic Options] Refreshing Sources...');
      const updatedSources = await sourceManager.refreshSourcesIfNeeded(podcast);
      if (updatedSources && JSON.stringify(updatedSources) !== JSON.stringify(podcast.sources)) {
        await updatePodcast(podcastId, { sources: updatedSources });
        podcast.sources = updatedSources;
        console.log(`[Topic Options] Sources refreshed: ${updatedSources.length} sources`);
      } else {
        console.log('[Topic Options] Sources did not require refresh.');
      }
    } catch (sourceRefreshError: any) {
      console.error(`[Topic Options] Non-fatal error refreshing sources: ${sourceRefreshError.message}. Proceeding with existing sources.`);
    }

    // --- Episode Analysis --- 
    console.log('[Topic Options] Analyzing Existing Episodes...');
    const episodeAnalysis = await episodeAnalyzer.analyzeExistingEpisodes(podcastId);
    console.log(`[Topic Options] Episode analysis complete.`);

    // --- Initial Search --- 
    console.log('[Topic Options] Performing Initial Search...');
    const initialSearchResults = await searchOrchestrator.performInitialSearch(podcast, episodeAnalysis);
    console.log(`[Topic Options] Initial search complete.`);

    // --- Source-Guided Search --- 
    let combinedResearchContent = initialSearchResults.combinedResearch;
    let combinedSources = initialSearchResults.allSources;
    try {
      console.log('[Topic Options] Performing Source-Guided Search...');
      const topicNames = initialSearchResults.potentialTopics.map(topic => topic.topic);
      const sourceGuidedResults = await sourceManager.performSourceGuidedSearch(podcast, topicNames);
      if (sourceGuidedResults.content) {
        combinedResearchContent += '\n\n--- Source Guided Search Results ---\n' + sourceGuidedResults.content;
        combinedSources = [...new Set([...combinedSources, ...sourceGuidedResults.sources])];
      }
      console.log(`[Topic Options] Source-guided search complete.`);
    } catch (sourceSearchError: any) {
      console.error(`[Topic Options] Non-fatal error during source-guided search: ${sourceSearchError.message}. Proceeding without these results.`);
    }

    // --- Filter and Format Topic Options ---
    console.log('[Topic Options] Processing topic options...');
    // REMOVE ALL FILTERING: Always return all topics from initialSearchResults.potentialTopics, up to 7
    let topicOptions: TopicOption[] = initialSearchResults.potentialTopics
      .slice(0, 7) // Limit to 7 options max
      .map((topic, index) => ({
        id: `topic-${index}`,
        topic: topic.topic,
        description: `Explore ${topic.topic} - ${topic.recency || 'Recent developments'}`,
        relevance: topic.relevance,
        recency: topic.recency || 'Recent',
        query: topic.query,
        reasoning: `Selected by AI topic generation` // No more filtering logic
      }));

    // Require a minimum of 5 topics if available
    if (topicOptions.length < 5 && initialSearchResults.potentialTopics.length >= 5) {
      topicOptions = initialSearchResults.potentialTopics.slice(0, 5).map((topic, index) => ({
        id: `topic-${index}`,
        topic: topic.topic,
        description: `Explore ${topic.topic} - ${topic.recency || 'Recent developments'}`,
        relevance: topic.relevance,
        recency: topic.recency || 'Recent',
        query: topic.query,
        reasoning: `Selected by AI topic generation`
      }));
    }

    console.log(`[Topic Options] Found ${topicOptions.length} topic options`);
    console.log(`--- END Get Topic Options for Podcast ID: ${podcastId} ---`);

    res.json({
      topicOptions,
      episodeAnalysis: {
        episodeCount: episodeAnalysis.episodeCount,
        recentTopics: episodeAnalysis.recentTopics?.slice(0, 5) // Just show a few recent topics
      }
    });

  } catch (error: any) {
    console.error(`[Topic Options] Error: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to get topic options', 
      details: error.message 
    });
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
    const allowedFields = ['title', 'description', 'prompt', 'podcastType', 'visibility', 'autoGenerate'];
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

router.post('/:podcastId/generate-episode', authenticateToken, async (req, res) => {
  const { podcastId } = req.params;
  const { selectedTopic } = req.body;

  if (!req.userId) {
    return res.status(403).json({ error: 'Forbidden: User ID not found.' });
  }

  let generationLog = logService.createEpisodeGenerationLog(podcastId);
  await logService.saveEpisodeGenerationLog(generationLog);

  try {
    const podcast = await getPodcast(podcastId, req.userId);
    if (!podcast) {
      throw new Error('Podcast not found or access denied.');
    }
    if (podcast.ownerEmail !== req.userId) {
      throw new Error('Forbidden: You do not own this podcast.');
    }

    // Don't wait for this to finish
    generateAndFinalizeEpisode(podcast, selectedTopic, generationLog.id);

    res.status(202).json({
      message: 'Episode generation started in the background.',
      generationLogId: generationLog.id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error(`[generate-episode] Initial request error for log ${generationLog.id}:`, error);
    generationLog = await logService.failLog(generationLog, errorMessage);
    await logService.saveEpisodeGenerationLog(generationLog);
    res.status(500).json({ error: errorMessage, generationLogId: generationLog.id });
  }
});

// This function runs in the background - SIMPLIFIED PLACEHOLDER
async function generateAndFinalizeEpisode(podcast: Podcast, selectedTopic: any, logId: string) {
  let log = await logService.getEpisodeGenerationLog(logId);
  if (!log) {
    console.error(`[generateAndFinalizeEpisode] FATAL: Could not retrieve log with ID ${logId}. Aborting.`);
    return;
  }

  try {
    console.log(`[generateAndFinalizeEpisode] Starting simplified generation for topic: ${selectedTopic.topic}`);
    
    // Create placeholder content
    const content = `This is a generated episode for the topic: ${selectedTopic.topic}. The full content generation logic is being restored.`;
    
    const episodeData: Omit<Episode, 'id'> = {
      podcastId: podcast.id!,
      title: selectedTopic.topic,
      description: `A placeholder episode about ${selectedTopic.topic}.`,
      content: content,
      sources: [],
      bulletPoints: ["Placeholder content."],
    };

    const newEpisode = await createEpisode(episodeData);
    log = logService.setEpisodeId(log, newEpisode.id!);
    await logService.saveEpisodeGenerationLog(log);
    
    // Generate audio for the placeholder content
    const audioStartTime = Date.now();
    const audioUrl = await audio.generateAndStoreAudio(content, podcast.id!, newEpisode.id!);
    await updateEpisodeAudio(newEpisode.id!, audioUrl);
    log = logService.updateStage(log, 'audioGeneration', { audioUrl }, Date.now() - audioStartTime);
    
    log = logService.completeLog(log);
    await logService.saveEpisodeGenerationLog(log);
    
    console.log(`[generateAndFinalizeEpisode] Successfully created placeholder episode ${newEpisode.id}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during background generation.';
    console.error(`[generateAndFinalizeEpisode] Background error for log ${logId}:`, error);
    if(log) {
      log = logService.failLog(log, errorMessage);
      await logService.saveEpisodeGenerationLog(log);
    }
  }
}

export default router; 
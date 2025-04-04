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

const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-exp-03-25' });

// Get all podcasts
router.get('/', async (req, res) => {
  try {
    console.log('GET /api/podcasts');
    const podcasts = await getAllPodcasts();
    res.json(podcasts);
  } catch (error) {
    console.error('Error getting podcasts:', error);
    res.status(500).json({ error: 'Failed to get podcasts' });
  }
});

// Get podcast by ID
router.get('/:id', async (req, res) => {
  try {
    console.log(`GET /api/podcasts/${req.params.id}`);
    const podcast = await getPodcast(req.params.id);
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    res.json(podcast);
  } catch (error) {
    console.error('Error getting podcast:', error);
    res.status(500).json({ error: 'Failed to get podcast' });
  }
});

// Create podcast
router.post('/', async (req, res) => {
  try {
    console.log('POST /api/podcasts', req.body);
    
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
    
    console.log('Creating podcast with title:', req.body.title);
    const podcast = await createPodcast(req.body);
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

// Get episodes by podcast ID
router.get('/:podcastId/episodes', async (req, res) => {
  try {
    console.log(`GET /api/podcasts/${req.params.podcastId}/episodes`);
    const episodes = await getEpisodesByPodcastId(req.params.podcastId);
    res.json(episodes);
  } catch (error) {
    console.error('Error getting episodes:', error);
    res.status(500).json({ error: 'Failed to get episodes' });
  }
});

// Delete episode
router.delete('/:podcastId/episodes/:episodeId', async (req, res) => {
  try {
    console.log(`DELETE /api/podcasts/${req.params.podcastId}/episodes/${req.params.episodeId}`);
    
    const { podcastId, episodeId } = req.params;
    
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

// Delete podcast
router.delete('/:podcastId', async (req, res) => {
  try {
    console.log(`DELETE /api/podcasts/${req.params.podcastId}`);
    
    const { podcastId } = req.params;
    
    // Get the podcast to check if it exists
    const podcast = await getPodcast(podcastId);
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
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

// Create episode
router.post('/:podcastId/episodes', async (req, res) => {
  try {
    console.log(`POST /api/podcasts/${req.params.podcastId}/episodes`, req.body);
    
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
    try {
      // TypeScript non-null assertions for properties we know exist at this point
      const audioUrl = await generateAndStoreAudio(
        episode.content!, 
        episode.podcastId!, 
        episode.id!
      );
      
      // Update the episode with the audio URL
      await updateEpisodeAudio(episode.id!, audioUrl);
      
      // Return the episode with the audio URL
      res.status(201).json({
        ...episode,
        audioUrl
      });
    } catch (audioError) {
      console.error('Error generating audio:', audioError);
      // Still return the episode even if audio generation fails
      res.status(201).json(episode);
    }
  } catch (error) {
    console.error('Error creating episode:', error);
    res.status(500).json({ error: 'Failed to create episode' });
  }
});

// Generate a new episode for a podcast
router.post('/:id/generate-episode', async (req, res) => {
  try {
    const { id: podcastId } = req.params;
    console.log(`POST /api/podcasts/${podcastId}/generate-episode`);
    
    // Get the podcast
    const podcast = await getPodcast(podcastId);
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    
    console.log(`Generating episode for podcast: ${podcast.title}`);
    
    // Get episode length specification from request or default
    const targetWordCount = req.body.targetWordCount || 300;
    const lengthSpecification = `approximately ${targetWordCount} words (about ${Math.round(targetWordCount / 125)} minutes when spoken)`;
    console.log(`Target length: ${lengthSpecification}`);
    
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
      } else {
        console.log('No changes to podcast sources');
      }
    } catch (sourceError) {
      console.error('Error refreshing sources:', sourceError);
      // Continue without refreshed sources - non-critical error
    }
    
    // 1. Review existing episodes
    console.log('Step 1: Analyzing existing episodes');
    const episodeAnalysis = await episodeAnalyzer.analyzeExistingEpisodes(podcastId);
    console.log(`Analysis complete: Found ${episodeAnalysis.episodeCount} episodes, ${episodeAnalysis.recentTopics.length} topics`);
    
    // 2. Perform initial search for new content
    console.log('Step 2: Performing initial search for new content');
    const initialSearchResults = await searchOrchestrator.performInitialSearch(podcast, episodeAnalysis);
    console.log(`Initial search complete: Found ${initialSearchResults.potentialTopics.length} potential topics`);
    
    // 2.1. NEW: Perform source-guided search using podcast sources
    console.log('Step 2.1: Performing source-guided search');
    const topicNames = initialSearchResults.potentialTopics.map(topic => topic.topic);
    const sourceGuidedResults = await sourceManager.performSourceGuidedSearch(podcast, topicNames);
    console.log(`Source-guided search complete: ${sourceGuidedResults.content.length} characters, ${sourceGuidedResults.sources.length} sources`);
    
    // Combine initial and source-guided search results
    if (sourceGuidedResults.content) {
      initialSearchResults.combinedResearch += '\n\n' + sourceGuidedResults.content;
      initialSearchResults.allSources = [...initialSearchResults.allSources, ...sourceGuidedResults.sources];
    }
    
    // 2a. Prioritize topics for deep dive research
    console.log('Step 2a: Prioritizing topics for deep dive research');
    const prioritizedTopics = await deepDiveResearch.prioritizeTopicsForDeepDive(
      initialSearchResults,
      episodeAnalysis,
      targetWordCount
    );
    console.log(`Topic prioritization complete: Selected ${prioritizedTopics.length} topics for deep research`);
    
    // 2b. NEW: Conduct deep dive research on prioritized topics
    console.log('Step 2b: Conducting deep dive research');
    const deepResearchResults = await deepDiveResearch.conductDeepDiveResearch(
      prioritizedTopics,
      targetWordCount
    );
    console.log(`Deep research complete: Researched ${deepResearchResults.researchedTopics.length} topics in depth`);
    
    let generatedContent;
    let researchResults;
    let narrativeStructure;
    
    // Determine whether to use deep dive or standard flow based on research results
    if (deepResearchResults.researchedTopics.length > 0) {
      // Use deep dive research results directly
      console.log('Using deep dive research results for content generation');
      
      // Generate a title without time-specific references
      const topicsList = deepResearchResults.researchedTopics.map(r => r.topic).join(' and ');
      
      generatedContent = {
        title: `${podcast.title}: Deep Dive into ${topicsList}`,
        description: `An in-depth exploration of ${topicsList}.`,
        content: deepResearchResults.overallContent
      };
      
      // Create a compatible structure for content differentiator
      researchResults = {
        topicResearch: deepResearchResults.researchedTopics.map(topic => ({
          topic: topic.topic,
          mainResearch: {
            content: topic.layers.map(layer => layer.content).join('\n\n'),
            sources: [...new Set(topic.layers.flatMap(layer => layer.sources))]
          },
          contrastingViewpoints: {
            content: '',
            sources: []
          },
          synthesizedContent: topic.synthesizedContent
        })),
        overallSynthesis: deepResearchResults.overallContent,
        allSources: deepResearchResults.allSources
      };
    } else {
      // Fall back to the standard flow if deep research didn't yield results
      console.log('Falling back to standard episode planning flow');
      
      // 3. Have Gemini decide on topics and depth (standard flow)
      console.log('Step 3: Planning episode content');
      const episodePlan = await searchOrchestrator.planEpisodeContent(
        podcast, 
        episodeAnalysis, 
        initialSearchResults
      );
      console.log(`Episode plan created: "${episodePlan.episodeTitle}" with ${episodePlan.selectedTopics.length} topics`);
      
      // 3a. Create enhanced narrative structure with word allocation
      console.log('Step 3a: Creating detailed narrative structure');
      narrativeStructure = await narrativePlanner.createNarrativeStructure(
        episodePlan,
        targetWordCount
      );
      console.log(`Narrative structure created with ${narrativeStructure.bodySections.length} sections`);
      
      // 4. Perform deep research with contrasting viewpoints
      console.log('Step 4: Performing deep research on selected topics');
      researchResults = await searchOrchestrator.performDeepResearch(episodePlan);
      console.log(`Research complete: ${researchResults.topicResearch.length} topics researched, ${researchResults.allSources.length} sources`);
      
      // 5. Generate structured content following the narrative plan
      console.log('Step 5: Generating structured content following narrative plan');
      const structuredContent = await contentFormatter.generateStructuredContent(
        researchResults,
        narrativeStructure
      );
      console.log(`Structured content generated (${structuredContent.split(/\s+/).length} words)`);
      
      // Generate episode title and description
      generatedContent = {
        title: episodePlan.episodeTitle,
        description: `An exploration of ${episodePlan.selectedTopics.map(t => t.topic).join(', ')}.`,
        content: structuredContent
      };
    }
    
    // 6. Ensure content differentiation
    console.log('Step 6: Validating content differentiation');
    const validationResult = await contentDifferentiator.validateContentDifferentiation(
      generatedContent.content,
      episodeAnalysis
    );
    console.log(`Validation complete: Similarity score ${validationResult.similarityScore}, passing: ${validationResult.isPassing}`);
    
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
    }
    
    // Count words
    const wordCount = finalContent.split(/\s+/).length;
    console.log(`Generated content word count: ${wordCount} words`);
    
    // Compare with target word count and log the difference
    const targetMinutes = targetWordCount / 125;
    const estimatedMinutes = wordCount / 125;
    console.log(`Target: ${targetWordCount} words (${targetMinutes.toFixed(1)} minutes)`);
    console.log(`Actual: ${wordCount} words (${estimatedMinutes.toFixed(1)} minutes)`);
    console.log(`Difference: ${wordCount - targetWordCount} words (${(estimatedMinutes - targetMinutes).toFixed(1)} minutes)`);
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
    
    // Only add narrative structure if it exists
    if (narrativeForStorage) {
      episodeData.narrativeStructure = narrativeForStorage;
    }
    
    const episode = await createEpisode(episodeData);
    
    // Update the podcast's last_updated field
    await updatePodcast(podcastId, {
      last_updated: new Date().toISOString()
    });
    
    // Generate audio for the episode
    try {
      const audioUrl = await generateAndStoreAudio(
        episode.content!, 
        podcast.id!, 
        episode.id!
      );
      
      // Update the episode with the audio URL
      await updateEpisodeAudio(episode.id!, audioUrl);
      
      // Return the episode with the audio URL
      res.json({
        ...episode,
        audioUrl
      });
    } catch (audioError) {
      console.error('Error generating audio:', audioError);
      // Still return the episode even if audio generation fails
      res.json(episode);
    }
  } catch (error) {
    console.error('Error generating episode:', error);
    res.status(500).json({ error: 'Failed to generate episode' });
  }
});

// Helper function to update episode audio URL
async function updateEpisodeAudio(episodeId: string, audioUrl: string): Promise<void> {
  try {
    await getDb().collection('episodes').doc(episodeId).update({ audioUrl });
    console.log(`Updated episode ${episodeId} with audio URL: ${audioUrl}`);
  } catch (error) {
    console.error(`Error updating episode ${episodeId} with audio URL:`, error);
    throw error;
  }
}

// Regenerate audio for an existing episode
router.post('/:podcastId/episodes/:episodeId/regenerate-audio', async (req, res) => {
  try {
    const { podcastId, episodeId } = req.params;
    console.log(`POST /api/podcasts/${podcastId}/episodes/${episodeId}/regenerate-audio`);
    
    // Get the episode
    const episode = await getEpisode(episodeId);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    // Check if the episode has content
    if (!episode.content) {
      return res.status(400).json({ error: 'Episode has no content to generate audio for' });
    }
    
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
      res.status(500).json({ error: 'Failed to regenerate audio' });
    }
  } catch (error) {
    console.error('Error regenerating audio for episode:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Update podcast details
router.patch('/:id', async (req, res) => {
  try {
    console.log(`PATCH /api/podcasts/${req.params.id}`, req.body);
    
    const podcast = await getPodcast(req.params.id);
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }

    // Only allow updating certain fields
    const allowedFields = ['title', 'description', 'prompt', 'podcastType'];
    const updates: Record<string, any> = {};
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    await updatePodcast(req.params.id, updates);
    
    // Get the updated podcast
    const updatedPodcast = await getPodcast(req.params.id);
    res.json(updatedPodcast);
  } catch (error) {
    console.error('Error updating podcast:', error);
    res.status(500).json({ error: 'Failed to update podcast' });
  }
});

export default router; 
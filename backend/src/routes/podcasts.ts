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
  getEpisode
} from '../services/database';
import { generateAndStoreAudio, deleteAudio } from '../services/audio';

const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
    const podcast = await createPodcast(req.body);
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
    
    // Generate audio for the episode
    try {
      const audioUrl = await generateAndStoreAudio(
        episode.content,
        episode.podcastId,
        episode.id
      );
      
      // Update the episode with the audio URL
      await updateEpisodeAudio(episode.id, audioUrl);
      
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

// Generate new episode
router.post('/:id/generate-episode', async (req, res) => {
  try {
    console.log(`POST /api/podcasts/${req.params.id}/generate-episode`);
    
    const podcast = await getPodcast(req.params.id);
    if (!podcast) {
      return res.status(404).json({ error: 'Podcast not found' });
    }

    // Get previous episodes for context
    const previousEpisodes = await getEpisodesByPodcastId(req.params.id);
    const episodeContext = previousEpisodes
      .map(ep => `Episode: "${ep.title}"\nDescription: ${ep.description}\nKey Points: ${ep.content.slice(0, 200)}...\n`)
      .join('\n\n');

    // Use the podcast prompt if available, otherwise use the description
    const podcastPrompt = podcast.prompt || podcast.description;

    const prompt = `You are a story generator for a narrated podcast series titled "${podcast.title}". The series description is: "${podcastPrompt}".

Previous episodes for context:
${episodeContext}

Based on the series theme and previous episodes, create a new engaging story episode that maintains continuity with the existing content.

IMPORTANT: Your response must be a valid JSON object with exactly these fields:
{
  "title": "The episode title (max 100 characters)",
  "description": "A brief description of the episode (max 150 characters)",
  "content": "The story content - YOU MUST COUNT CHARACTERS AND ENSURE IT IS BETWEEN 100-200 CHARACTERS. Spaces and punctuation count as characters."
}

CRITICAL REQUIREMENTS:
1. The content field MUST be BETWEEN 100-200 characters. Count every character including spaces and punctuation.
2. Before returning your response, count the characters in your content field to verify it is between 100-200.
3. If the content is not within this range, adjust it until it is.
4. Do not include any other text or formatting in your response.
5. Only return the JSON object.
6. Ensure the story maintains continuity with previous episodes.
7. Focus on creating content that will sound natural when read aloud by a text-to-speech system.
8. Use natural pacing with short sentences and appropriate pauses (using punctuation).
9. Include some variation in tone through exclamations or questions where appropriate.
10. Avoid complex words or phrases that might be difficult to pronounce.
11. Write in a conversational style that flows naturally when spoken.

Remember: This content will be converted to audio, so optimize for listening rather than reading. Count every single character in the content field, including spaces and punctuation, and ensure it is between 100-200 characters before returning.`;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log('Generated content:', responseText);
    
    try {
      // Remove markdown code block formatting if present
      const cleanedText = responseText.replace(/^```json\s*|\s*```$/g, '');
      console.log('Cleaned content:', cleanedText);
      
      const generatedContent = JSON.parse(cleanedText);
      
      // Validate content length
      if (generatedContent.content.length < 100 || generatedContent.content.length > 200) {
        throw new Error(`Content must be between 100-200 characters. Got ${generatedContent.content.length} characters.`);
      }
      
      // Create the episode
      const episode = await createEpisode({
        podcastId: req.params.id,
        title: generatedContent.title.slice(0, 100),
        description: generatedContent.description.slice(0, 150),
        content: generatedContent.content,
        created_at: new Date().toISOString()
      });
      
      // Generate audio for the episode
      try {
        const audioUrl = await generateAndStoreAudio(
          episode.content,
          episode.podcastId,
          episode.id
        );
        
        // Update the episode with the audio URL
        await updateEpisodeAudio(episode.id, audioUrl);
        
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
    } catch (parseError) {
      console.error('Error parsing generated content:', parseError);
      console.error('Raw content:', responseText);
      res.status(500).json({ error: 'Failed to parse generated content' });
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

export default router; 
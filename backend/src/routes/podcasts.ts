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
      .map(ep => `Title: "${ep.title}"\nDescription: ${ep.description}\nContent: ${ep.content}\n`)
      .join('\n\n');

    // Use the podcast prompt if available, otherwise use the description
    const podcastPrompt = podcast.prompt || podcast.description;

    // Parse the prompt to check for length specification
    // Look for patterns like "episode length: X minutes" or "episode duration: X words"
    let targetWordCount = 300; // Default to 2 minutes (approximately 300 words)
    let lengthSpecification = "approximately 2 minutes of spoken content (about 300 words)";
    
    const lengthRegex = /episode\s+(?:length|duration):\s*(\d+)\s*(minute|minutes|min|words|word)/i;
    const match = podcastPrompt.match(lengthRegex);
    
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      if (unit.includes('minute') || unit === 'min') {
        // Approximate 150 words per minute for spoken content
        targetWordCount = value * 150;
        lengthSpecification = `approximately ${value} minute${value !== 1 ? 's' : ''} of spoken content (about ${targetWordCount} words)`;
      } else if (unit.includes('word')) {
        targetWordCount = value;
        lengthSpecification = `approximately ${value} words`;
      }
    }

    const prompt = `You are a story generator for a series titled "${podcast.title}". The series description is: "${podcastPrompt}".

Previous content for context:
${episodeContext}

Based on the series theme and previous content, create a new engaging story that maintains continuity with the existing content.

IMPORTANT: Your response must be a valid JSON object with exactly these fields:
{
  "title": "A title for this part of the story (max 100 characters)",
  "description": "A brief description of this part (max 150 characters)",
  "content": "The story content with ${lengthSpecification}. Focus on word count rather than character count."
}

CRITICAL REQUIREMENTS:
1. The content field should be ${lengthSpecification}.
2. Before returning your response, count the words in your content field to verify it is approximately ${targetWordCount} words.
3. If the content is significantly shorter or longer than requested, adjust it accordingly.
4. Do not include any other text or formatting in your response.
5. Only return the JSON object.
6. Ensure the story maintains continuity with previous content.
7. Focus on creating content that will sound natural when read aloud by a text-to-speech system.
8. Use natural pacing with short sentences and appropriate pauses (using punctuation).
9. Include some variation in tone through exclamations or questions where appropriate.
10. Avoid complex words or phrases that might be difficult to pronounce.
11. Write in a conversational style that flows naturally when spoken.
12. DO NOT use phrases like "in this episode" or refer to the content as "episodes" unless the podcast theme is explicitly about a TV show or similar media.
13. DO NOT mention "finding out in the next episode" or similar phrases that break the fourth wall.
14. Stay true to the theme and style established in the previous content.
15. If the previous content is about a workplace, keep it about a workplace. If it's about fantasy, keep it about fantasy, etc.
16. Make strategic use of punctuation to enhance the dramatic effect of the narration:
   - Use periods (.) for definitive stops that create impact
   - Use ellipses (...) for suspense, trailing thoughts, or to indicate a pause
   - Use commas (,) to control pacing and create natural speech rhythms
   - Use hyphens (-) to indicate interruptions or sudden changes
   - Match punctuation to the content's tone - more dramatic for adventure/suspense stories, more measured for informational content

Remember: This content will be converted to audio, so optimize for listening rather than reading. The ideal length is ${lengthSpecification}.`;

    try {
      // Try to generate content using Gemini API
      console.log('Sending episode generation prompt to Gemini');
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      console.log('Generated content:', responseText);
      
      // Process the generated content
      // Remove any code block markers from the response
      let cleanedText = responseText.replace(/^```json\s*|\s*```$/g, '');
      cleanedText = cleanedText.replace(/^```\s*|\s*```$/g, '');
      console.log('Cleaned content:', cleanedText);
      
      // Attempt to parse the JSON, with error handling
      let generatedContent;
      try {
        generatedContent = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        
        // Try to manually extract title, description, and content
        const titleMatch = cleanedText.match(/"title":\s*"([^"]+)"/);
        const descriptionMatch = cleanedText.match(/"description":\s*"([^"]+)"/);
        const contentMatch = cleanedText.match(/"content":\s*"([\s\S]+?)(?:"\s*}|"\s*,\s*")/);
        
        if (titleMatch && descriptionMatch && contentMatch) {
          console.log('Manually extracting content from unparseable response');
          generatedContent = {
            title: titleMatch[1],
            description: descriptionMatch[1],
            content: contentMatch[1].replace(/\\"/g, '"')
          };
        } else {
          // If we can't even extract manually, throw the original error
          throw parseError;
        }
      }
      
      // Count words instead of characters
      const wordCount = generatedContent.content.split(/\s+/).length;
      console.log(`Generated content word count: ${wordCount} words`);
      
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
    } catch (generationError) {
      console.error('Error generating content with Gemini:', generationError);
      
      // Return an error to the client instead of using fallback generation
      res.status(503).json({ 
        error: 'Failed to generate episode content',
        message: 'The AI content generation service is currently unavailable. Please try again later.'
      });
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
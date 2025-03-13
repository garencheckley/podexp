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
      .map(ep => `Episode: "${ep.title}"\nDescription: ${ep.description}\nKey Points: ${ep.content.slice(0, 200)}...\n`)
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

    const prompt = `You are a story generator for a narrated podcast series titled "${podcast.title}". The series description is: "${podcastPrompt}".

Previous episodes for context:
${episodeContext}

Based on the series theme and previous episodes, create a new engaging story episode that maintains continuity with the existing content.

IMPORTANT: Your response must be a valid JSON object with exactly these fields:
{
  "title": "The episode title (max 100 characters)",
  "description": "A brief description of the episode (max 150 characters)",
  "content": "The story content with ${lengthSpecification}. Focus on word count rather than character count."
}

CRITICAL REQUIREMENTS:
1. The content field should be ${lengthSpecification}.
2. Before returning your response, count the words in your content field to verify it is approximately ${targetWordCount} words.
3. If the content is significantly shorter or longer than requested, adjust it accordingly.
4. Do not include any other text or formatting in your response.
5. Only return the JSON object.
6. Ensure the story maintains continuity with previous episodes.
7. Focus on creating content that will sound natural when read aloud by a text-to-speech system.
8. Use natural pacing with short sentences and appropriate pauses (using punctuation).
9. Include some variation in tone through exclamations or questions where appropriate.
10. Avoid complex words or phrases that might be difficult to pronounce.
11. Write in a conversational style that flows naturally when spoken.

Remember: This content will be converted to audio, so optimize for listening rather than reading. The ideal length is ${lengthSpecification}.`;

    try {
      // Try to generate content using Gemini API
      console.log('Sending episode generation prompt to Gemini');
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      console.log('Generated content:', responseText);
      
      // Process the generated content
      const cleanedText = responseText.replace(/^```json\s*|\s*```$/g, '');
      console.log('Cleaned content:', cleanedText);
      
      const generatedContent = JSON.parse(cleanedText);
      
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
      
      // Fallback: Generate a simple episode without using Gemini
      console.log('Using fallback episode generation');
      
      // Extract character names from the prompt
      const nameMatches = podcastPrompt.match(/\b[A-Z][a-z]+\b/g) || [];
      const uniqueNames = [...new Set(nameMatches)];
      const characters = uniqueNames.length > 0 ? uniqueNames : ['The protagonist'];
      
      // Generate episode number
      const episodeNumber = previousEpisodes.length + 1;
      
      // Generate a simple title
      const episodeTitle = `Episode ${episodeNumber}: ${characters[0]}'s New Adventure`;
      
      // Generate a simple description
      const episodeDescription = `${characters[0]} embarks on a new adventure in this exciting episode.`;
      
      // Generate simple content based on the podcast prompt
      let episodeContent = '';
      
      // Start with an introduction
      episodeContent += `Welcome back to ${podcast.title}! In this episode, we continue the adventure with ${characters.join(' and ')}.\n\n`;
      
      // Add some story elements based on the prompt
      const storyElements = podcastPrompt.toLowerCase();
      
      if (storyElements.includes('spaceship') || storyElements.includes('space')) {
        episodeContent += `${characters[0]} was piloting the spaceship through a field of asteroids. "Hold on tight!" ${characters[0]} called out to the crew. The ship's engines hummed as they navigated through the dangerous space debris.\n\n`;
      }
      
      if (storyElements.includes('princess') || storyElements.includes('prince')) {
        episodeContent += `As royalty, ${characters[0]} had responsibilities beyond just being a pilot. There were diplomatic missions to consider and a kingdom waiting for their return. But for now, the adventure among the stars was the priority.\n\n`;
      }
      
      if (storyElements.includes('adventure')) {
        episodeContent += `This journey was proving to be more exciting than anyone had anticipated. Strange signals were coming from a nearby planet, and curiosity was getting the better of the crew. "Should we investigate?" asked ${characters.length > 1 ? characters[1] : 'the co-pilot'}.\n\n`;
      }
      
      // Add some dialogue
      episodeContent += `"I think we should check it out," said ${characters[0]}. "It could be someone in need of help."\n\n`;
      
      if (characters.length > 1) {
        episodeContent += `${characters[1]} nodded in agreement. "You're right. Let's prepare for landing."\n\n`;
      }
      
      // Add a cliffhanger ending
      episodeContent += `As they approached the source of the signal, they saw something unexpected. It was unlike anything they had encountered before. What would they discover? And would they be able to handle the challenges ahead? Find out in the next exciting episode of ${podcast.title}!`;
      
      // Ensure the content is approximately the target word count
      const currentWordCount = episodeContent.split(/\s+/).length;
      
      if (currentWordCount < targetWordCount) {
        // Add filler content if needed
        const additionalWordsNeeded = targetWordCount - currentWordCount;
        const fillerSentences = [
          `The ship's computer beeped with new information.`,
          `Stars twinkled in the vast expanse of space around them.`,
          `The crew prepared for whatever challenges lay ahead.`,
          `This wasn't the first time they had faced the unknown.`,
          `Their previous adventures had prepared them for moments like this.`,
          `The ship's engines hummed with a reassuring sound.`,
          `Communication systems were working perfectly.`,
          `The navigation system plotted the optimal course.`,
          `Everyone on board felt a mix of excitement and apprehension.`,
          `This was exactly the kind of adventure they had signed up for.`
        ];
        
        let fillerContent = '';
        let fillerIndex = 0;
        while (fillerContent.split(/\s+/).length < additionalWordsNeeded && fillerIndex < fillerSentences.length) {
          fillerContent += ' ' + fillerSentences[fillerIndex];
          fillerIndex = (fillerIndex + 1) % fillerSentences.length;
        }
        
        // Insert the filler content before the cliffhanger
        const parts = episodeContent.split('Find out in the next exciting episode');
        episodeContent = parts[0] + fillerContent + '\n\n' + 'Find out in the next exciting episode' + parts[1];
      }
      
      // Create the episode with the fallback content
      const episode = await createEpisode({
        podcastId: req.params.id,
        title: episodeTitle.slice(0, 100),
        description: episodeDescription.slice(0, 150),
        content: episodeContent,
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
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

// Generate new episode
router.post('/:id/generate-episode', async (req, res) => {
  try {
    console.log(`POST /api/podcasts/${req.params.id}/generate-episode`, req.body);
    
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

    // Get episode length from request or parse it from the prompt
    let targetWordCount = 375; // Default to 3 minutes (approximately 375 words at 125 words/min)
    let lengthSpecification = "approximately 3 minutes of spoken content (about 375 words)";
    
    // If episodeLength is provided in the request, use it
    if (req.body && req.body.episodeLength) {
      const minutes = parseInt(req.body.episodeLength);
      if (!isNaN(minutes) && minutes > 0) {
        // Approximate 125 words per minute for spoken content
        targetWordCount = minutes * 125;
        lengthSpecification = `approximately ${minutes} minute${minutes !== 1 ? 's' : ''} of spoken content (about ${targetWordCount} words)`;
        console.log(`Using episode length from request: ${minutes} minutes (${targetWordCount} words)`);
      }
    } else {
      // Fallback: Try to parse from the prompt
      const lengthRegex = /episode\s+(?:length|duration):\s*(\d+)\s*(minute|minutes|min|words|word)/i;
      const match = podcastPrompt.match(lengthRegex);
      
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        if (unit.includes('minute') || unit === 'min') {
          // Approximate 125 words per minute for spoken content
          targetWordCount = value * 125;
          lengthSpecification = `approximately ${value} minute${value !== 1 ? 's' : ''} of spoken content (about ${targetWordCount} words)`;
        } else if (unit.includes('word')) {
          targetWordCount = value;
          lengthSpecification = `approximately ${value} words`;
        }
        console.log(`Using episode length from prompt: ${lengthSpecification}`);
      } else {
        console.log(`Using default episode length: ${lengthSpecification}`);
      }
    }

    let webSearchContext = '';
    let searchSources: string[] = [];

    // Check if this podcast uses web search
    if (podcast.podcastType === 'news') {
      console.log('This podcast uses web search. Conducting search...');
      try {
        // Conduct the three-stage search process
        const { rawSearchData, searchResults } = await conductThreeStageSearch(
          podcastPrompt,
          previousEpisodes.length,
          targetWordCount  // Pass the target word count to scale research depth
        );
        
        webSearchContext = rawSearchData;
        searchSources = searchResults.sources || [];
        
        console.log('Web search completed successfully');
        console.log(`Found ${searchSources.length} sources`);
      } catch (searchError) {
        console.error('Error conducting web search:', searchError);
        // Continue with generation even if search fails
        webSearchContext = 'Web search failed. Proceeding with generation without search data.';
      }
    }

    // Build the prompt based on whether this podcast uses web search
    let prompt;
    if (podcast.podcastType === 'news') {
      prompt = `You are a professional news broadcaster creating an audio episode for a podcast titled "${podcast.title}". The podcast topic is: "${podcastPrompt}".

I'll provide you with real-time information from web searches related to this topic, as well as context from previous episodes if available. Your job is to craft an engaging, conversational, and well-structured news story that listeners can easily follow and understand.

${previousEpisodes.length > 0 ? `Here are the previous episodes for context:\n\n${episodeContext}\n\n` : ''}

COMPREHENSIVE RESEARCH RESULTS:
The following information is the result of adaptive multi-stage research on your topic. This research process:
1. Began with a broad search on the topic
2. Automatically identified specific aspects that needed deeper investigation
3. Conducted targeted follow-up searches on those aspects
4. Consolidated all findings into a comprehensive research document

The information below represents multiple search queries and sources, providing in-depth context and detailed facts:

${webSearchContext}

REQUIREMENTS FOR AUDIO STORYTELLING:

1. NARRATIVE STRUCTURE: Start with a compelling hook/headline that captures the main story, followed by the key points in a logical flow, and end with a clear conclusion or forward-looking statement.

2. SELECTIVE FOCUS: Do NOT try to include all information from the research. Select only the 3-5 most important and relevant points that create a coherent story about the topic.

3. CONVERSATIONAL TONE: Write in a natural, conversational broadcasting style that a listener can easily follow. Use short, clear sentences and avoid complex structures that would be difficult to understand when heard rather than read.

4. AUDIO PACING: Include natural pauses and transitions between ideas (e.g., "Meanwhile," "In related news," "Turning to," etc.) that help listeners follow along without seeing text.

5. PARAGRAPH STRUCTURE FOR AUDIO:
   - Start a new paragraph for each new thought, topic, or speaker
   - Use short paragraphs (2-3 sentences) to create natural pauses
   - Insert a blank line between paragraphs to create a slightly longer pause
   - For dialogue, start a new paragraph each time the speaker changes
   - Do not use literal "\n" characters in your response
6. CONTEXTUAL FRAMING: Briefly introduce concepts, organizations, or terms that may be unfamiliar to listeners. For example, "The California Public Utilities Commission, the state agency that regulates utility companies, announced..."

7. SOURCE ATTRIBUTION: Clearly attribute information to sources in an audio-friendly way:
   - Mention publication names naturally: "According to The Wall Street Journal..." or "As reported by Reuters yesterday..."
   - For quotes, clearly introduce the speaker and their relevance: "PG&E CEO Patricia Poppe told investors during last month's earnings call..."
   - Use varied attribution phrases for flow: "reports indicate," "according to," "as stated by," etc.
   - Include dates when relevant, especially for time-sensitive information
   - Prioritize recent sources but mention if citing older but still relevant information

8. HUMANIZE THE STORY: Where appropriate, include how the news affects real people or communities to help listeners connect with the information.

9. AUDIO-FRIENDLY NUMBERS: Round complex numbers and put them in context. Instead of saying "1.527 million dollars," say "more than 1.5 million dollars" or "about one and a half million dollars."

10. QUOTE INTEGRATION: Use key quotes from sources, but introduce speakers clearly and integrate quotes naturally into the narrative. For example: "Mark Johnson, a spokesperson for the company, explained the decision, saying quote: 'We believe this approach is in the best interest of our customers.' End quote."

11. AVOID INFORMATION OVERLOAD: Don't cram too many statistics or data points together. Space them out and provide context for what they mean.

12. KEEP IT FACTUAL: While being conversational, remain objective and factual. Do not include personal opinions or commentary.

13. AUDIO LENGTH: The content MUST be ${lengthSpecification}. This is critical for timing in audio formats.

14. DO NOT include any speech instructions like "(pause)" or formatting markers, just write natural text with standard punctuation.

15. Format your response as valid JSON with the following structure:
{
  "title": "Clear, Direct News-Style Title",
  "description": "Brief factual description of the episode (1-2 sentences)",
  "content": "The full podcast script in plain text with only standard punctuation"
}

Consider this a news radio broadcast where you need to capture and maintain listener attention while clearly communicating the most important aspects of the story. Focus on creating a flowing narrative that a listener can easily follow by ear rather than cramming in every fact from the research.`;
    } else {
      // Original prompt for non-web-search podcasts
      prompt = `You are a story generator for a series titled "${podcast.title}". The series description is: "${podcastPrompt}".

${previousEpisodes.length > 0 ? `Here are the previous episodes for context:\n\n${episodeContext}\n\n` : ''}

Create a new episode for this series. IMPORTANT: The content MUST be ${lengthSpecification}. Do not exceed this word count.

Format your response as valid JSON with the following structure:
{
  "title": "Catchy, Specific Episode Title",
  "description": "Brief description of the episode (1-2 sentences)",
  "content": "The full episode content in plain text with only standard punctuation"
}

Your content should:
1. Match the style and voice established by the podcast description
2. Maintain continuity with previous episodes (if they exist)
3. Be original and not repeat storylines from previous episodes
4. Include natural dialogue and narrative appropriate for audio
5. Use proper pacing with standard punctuation only (periods, commas, question marks, etc.)
6. Be engaging and hold the listener's interest
7. Have a clear beginning, middle, and end
8. Be child-friendly and appropriate for all audiences
9. PARAGRAPH STRUCTURE FOR AUDIO:
   - Start a new paragraph for each new thought, topic, or speaker
   - Use short paragraphs (2-3 sentences) to create natural pauses
   - Insert a blank line between paragraphs to create a slightly longer pause
   - For dialogue, start a new paragraph each time the speaker changes
   - Do not use literal "\n" characters in your response
10. STRICTLY ADHERE to the ${lengthSpecification} limit - this is critical for timing
11. DO NOT include any speech instructions like "(pause)", "(slightly faster pace)", "(upbeat intro music)" - these will not work with TTS
12. DO NOT use any formatting like "**Host:**" or markdown - use only plain text with normal punctuation`;
    }

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
        
        // Process content to handle escaped newlines
        generatedContent.content = generatedContent.content
          .replace(/\\n/g, '\n') // Replace escaped newlines with actual newlines
          .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines to just two
          .replace(/\\"/g, '"');      // Replace escaped quotes with actual quotes
        
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        
        // Try to manually extract title, description, and content
        const titleMatch = cleanedText.match(/"title":\s*"([^"]+)"/);
        const descriptionMatch = cleanedText.match(/"description":\s*"([^"]+)"/);
        const contentMatch = cleanedText.match(/"content":\s*"([\s\S]+?)(?:"\s*}|"\s*,\s*")/);
        
        if (titleMatch && descriptionMatch && contentMatch) {
          console.log('Manually extracting content from unparseable response');
          
          // Process content to handle escaped newlines
          const processedContent = contentMatch[1]
            .replace(/\\n/g, '\n') // Replace escaped newlines with actual newlines
            .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines to just two
            .replace(/\\"/g, '"');      // Replace escaped quotes with actual quotes
          
          generatedContent = {
            title: titleMatch[1],
            description: descriptionMatch[1],
            content: processedContent
          };
        } else {
          // If we can't even extract manually, throw the original error
          throw parseError;
        }
      }
      
      // Count words instead of characters
      const wordCount = generatedContent.content.split(/\s+/).length;
      console.log(`Generated content word count: ${wordCount} words`);
      
      // Compare with target word count and log the difference
      const targetMinutes = targetWordCount / 125;
      const estimatedMinutes = wordCount / 125;
      console.log(`Target: ${targetWordCount} words (${targetMinutes.toFixed(1)} minutes)`);
      console.log(`Actual: ${wordCount} words (${estimatedMinutes.toFixed(1)} minutes)`);
      console.log(`Difference: ${wordCount - targetWordCount} words (${(estimatedMinutes - targetMinutes).toFixed(1)} minutes)`);
      console.log(`Adherence: ${(wordCount / targetWordCount * 100).toFixed(1)}% of target length`);

      // Sources are now stored as metadata but not added to the transcript
      
      // Create the episode
      const episode = await createEpisode({
        podcastId: req.params.id,
        title: generatedContent.title.slice(0, 100),
        description: generatedContent.description.slice(0, 150),
        content: generatedContent.content,
        sources: podcast.podcastType === 'news' ? searchSources : undefined,
        created_at: new Date().toISOString()
      });
      
      // Generate audio for the episode
      try {
        // TypeScript non-null assertions for properties we know exist at this point
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
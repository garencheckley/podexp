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
      
      // Extract theme and context from previous episodes
      let themeContext = '';
      let mainCharacters: string[] = [];
      let setting = '';
      let tone = 'casual';
      
      // Analyze previous episodes to extract theme and context
      if (previousEpisodes.length > 0) {
        // Get the most recent episode for context
        const latestEpisode = previousEpisodes[previousEpisodes.length - 1];
        themeContext = latestEpisode.content;
        
        // Extract potential character names (capitalized words)
        const nameMatches = themeContext.match(/\b[A-Z][a-z]+\b/g) || [];
        mainCharacters = [...new Set(nameMatches)].slice(0, 3); // Take up to 3 unique names
        
        // Try to determine the setting
        if (themeContext.toLowerCase().includes('office') || themeContext.toLowerCase().includes('meeting') || 
            themeContext.toLowerCase().includes('work') || themeContext.toLowerCase().includes('job')) {
          setting = 'workplace';
        } else if (themeContext.toLowerCase().includes('space') || themeContext.toLowerCase().includes('ship')) {
          setting = 'space';
        } else if (themeContext.toLowerCase().includes('school') || themeContext.toLowerCase().includes('class')) {
          setting = 'school';
        } else if (themeContext.toLowerCase().includes('home') || themeContext.toLowerCase().includes('house')) {
          setting = 'home';
        } else {
          // Default to a generic setting based on podcast title
          setting = 'general';
        }
        
        // Determine tone
        if (themeContext.includes('!') || themeContext.toLowerCase().includes('excite')) {
          tone = 'excited';
        } else if (themeContext.toLowerCase().includes('sad') || themeContext.toLowerCase().includes('depress')) {
          tone = 'melancholic';
        } else if (themeContext.toLowerCase().includes('fear') || themeContext.toLowerCase().includes('scary')) {
          tone = 'suspenseful';
        }
      }
      
      // If no character names were found, use generic ones or extract from podcast title/prompt
      if (mainCharacters.length === 0) {
        const podcastTitleNames = podcast.title.match(/\b[A-Z][a-z]+\b/g) || [];
        const promptNames = podcastPrompt.match(/\b[A-Z][a-z]+\b/g) || [];
        mainCharacters = [...new Set([...podcastTitleNames, ...promptNames])].slice(0, 2);
        
        // If still no names, use generic ones
        if (mainCharacters.length === 0) {
          mainCharacters = ['The narrator'];
        }
      }
      
      // Generate episode number
      const episodeNumber = previousEpisodes.length + 1;
      
      // Generate a simple title based on the theme
      const episodeTitle = `${mainCharacters[0]}'s ${setting === 'workplace' ? 'Workday' : 'Adventure'} ${episodeNumber}`;
      
      // Generate a simple description
      const episodeDescription = `${mainCharacters[0]} ${setting === 'workplace' ? 'faces challenges at work' : 'continues the journey'} in this new story.`;
      
      // Generate content based on the setting and previous episodes
      let episodeContent = '';
      
      // Start with appropriate content based on setting
      if (setting === 'workplace') {
        episodeContent = generateWorkplaceContent(mainCharacters, tone, themeContext);
      } else if (setting === 'space') {
        episodeContent = generateSpaceContent(mainCharacters, tone, themeContext);
      } else if (setting === 'school') {
        episodeContent = generateSchoolContent(mainCharacters, tone, themeContext);
      } else if (setting === 'home') {
        episodeContent = generateHomeContent(mainCharacters, tone, themeContext);
      } else {
        episodeContent = generateGenericContent(mainCharacters, tone, themeContext, podcast.title);
      }
      
      // Ensure the content is approximately the target word count
      const currentWordCount = episodeContent.split(/\s+/).length;
      
      if (currentWordCount < targetWordCount) {
        // Add filler content if needed
        const additionalWordsNeeded = targetWordCount - currentWordCount;
        
        // Generate filler sentences appropriate to the setting
        const fillerSentences = generateFillerSentences(setting, mainCharacters, tone);
        
        let fillerContent = '';
        let fillerIndex = 0;
        while (fillerContent.split(/\s+/).length < additionalWordsNeeded && fillerIndex < 20) { // Limit to 20 iterations
          fillerContent += ' ' + fillerSentences[fillerIndex % fillerSentences.length];
          fillerIndex++;
        }
        
        // Insert the filler content before the ending
        const parts = episodeContent.split('THE_END_MARKER');
        if (parts.length > 1) {
          episodeContent = parts[0] + fillerContent + parts[1];
        } else {
          episodeContent += fillerContent;
        }
      }
      
      // Create the episode
      const episode = await createEpisode({
        podcastId: req.params.id,
        title: episodeTitle,
        description: episodeDescription,
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

// Helper functions for fallback content generation
function generateWorkplaceContent(characters: string[], tone: string, context: string): string {
  const mainCharacter = characters[0] || 'The employee';
  const secondaryCharacter = characters.length > 1 ? characters[1] : 'the colleague';
  
  let content = '';
  
  // Start with a workplace scenario
  if (tone === 'excited') {
    content += `${mainCharacter} rushed into the office, clutching a coffee and a brilliant new idea. "I've got it!" ${mainCharacter} announced to the team. "This could change everything!"\n\n`;
  } else if (tone === 'melancholic') {
    content += `${mainCharacter} stared at the computer screen, the glow illuminating a tired face. Another deadline loomed. The office felt emptier than usual today.\n\n`;
  } else if (tone === 'suspenseful') {
    content += `${mainCharacter} noticed something strange in the quarterly report. The numbers didn't add up. Who had access to these files? And why would anyone change them?\n\n`;
  } else {
    content += `${mainCharacter} arrived at the office to find an unexpected meeting scheduled. "Not another brainstorming session," ${mainCharacter} muttered, heading to the break room for coffee first.\n\n`;
  }
  
  // Add some dialogue
  content += `"Did you finish the report?" asked ${secondaryCharacter}, leaning against the doorframe.\n\n`;
  content += `${mainCharacter} nodded. "Just sent it. But I'm not sure about the conclusion. Something feels off about the whole project."\n\n`;
  
  // Add a workplace challenge
  content += `The team gathered in the conference room. The presentation wasn't going well. Slides were out of order, and the client was clearly losing interest. ${mainCharacter} would have to think fast to save this deal.\n\n`;
  
  // Add a resolution or cliffhanger
  content += `By the end of the day, ${mainCharacter} had a decision to make. Stay late to fix the proposal, or trust the team to handle it? Sometimes leadership meant knowing when to step back.THE_END_MARKER\n\n`;
  
  return content;
}

function generateSpaceContent(characters: string[], tone: string, context: string): string {
  const mainCharacter = characters[0] || 'The pilot';
  const secondaryCharacter = characters.length > 1 ? characters[1] : 'the co-pilot';
  
  let content = '';
  
  // Start with a space scenario
  if (tone === 'excited') {
    content += `${mainCharacter} gazed through the viewport at the swirling nebula. "It's even more beautiful than the charts suggested," ${mainCharacter} whispered, recording the coordinates.\n\n`;
  } else if (tone === 'melancholic') {
    content += `${mainCharacter} checked the ship's log again. Three weeks since their last communication with Command. The silence of space felt heavier each day.\n\n`;
  } else if (tone === 'suspenseful') {
    content += `The ship's alarm jolted ${mainCharacter} awake. Something had breached the outer hull. The emergency lights cast eerie shadows as ${mainCharacter} grabbed the emergency kit.\n\n`;
  } else {
    content += `${mainCharacter} adjusted the ship's course, compensating for the gravitational pull of the nearby planet. Routine maneuvers were the backbone of space travel, even if they weren't the most exciting part.\n\n`;
  }
  
  // Add some dialogue
  content += `"Navigation shows an anomaly ahead," reported ${secondaryCharacter}. "Should we investigate or maintain course?"\n\n`;
  content += `${mainCharacter} considered the options. "Let's take a closer look. Keep the engines ready for a quick departure if needed."\n\n`;
  
  // Add a space challenge
  content += `The anomaly turned out to be a derelict ship, drifting silently. No distress signal, no signs of life. Protocol said to report and move on, but curiosity pulled at ${mainCharacter}. What happened to the crew?\n\n`;
  
  // Add a resolution or cliffhanger
  content += `The decision weighed heavily as ${mainCharacter} looked from the derelict ship to the concerned face of ${secondaryCharacter}. Sometimes the right choice wasn't in any manual.THE_END_MARKER\n\n`;
  
  return content;
}

function generateSchoolContent(characters: string[], tone: string, context: string): string {
  const mainCharacter = characters[0] || 'The student';
  const secondaryCharacter = characters.length > 1 ? characters[1] : 'the classmate';
  
  let content = '';
  
  // Start with a school scenario
  if (tone === 'excited') {
    content += `${mainCharacter} burst through the classroom door. "Did you hear? We're getting a new exchange student!" The news spread quickly as students gathered around.\n\n`;
  } else if (tone === 'melancholic') {
    content += `${mainCharacter} stared at the empty desk by the window. It had been two weeks since ${secondaryCharacter} had moved away. The classroom felt different now.\n\n`;
  } else if (tone === 'suspenseful') {
    content += `${mainCharacter} found the note tucked inside a textbook. "Meet at the old gymnasium after school. Come alone." The handwriting wasn't familiar.\n\n`;
  } else {
    content += `${mainCharacter} hurried down the hallway, narrowly avoiding being late again. The science project was due today, and there was still one more experiment to document.\n\n`;
  }
  
  // Add some dialogue
  content += `"Did you study for the test?" whispered ${secondaryCharacter} as they took their seats.\n\n`;
  content += `${mainCharacter} nodded. "All night. But I'm still not sure about chapter five. The formulas all look the same to me."\n\n`;
  
  // Add a school challenge
  content += `The principal's announcement caught everyone by surprise. The annual competition was moving up two weeks. Teams would have to scramble to finish their projects in time. ${mainCharacter} looked at their half-completed work with concern.\n\n`;
  
  // Add a resolution or cliffhanger
  content += `As the bell rang, ${mainCharacter} made a decision. This would require extra hours and maybe some help from unexpected places. But giving up wasn't an option.THE_END_MARKER\n\n`;
  
  return content;
}

function generateHomeContent(characters: string[], tone: string, context: string): string {
  const mainCharacter = characters[0] || 'The resident';
  const secondaryCharacter = characters.length > 1 ? characters[1] : 'the roommate';
  
  let content = '';
  
  // Start with a home scenario
  if (tone === 'excited') {
    content += `${mainCharacter} rushed into the kitchen, waving an envelope. "It came! The letter we've been waiting for!" The anticipation had been building for weeks.\n\n`;
  } else if (tone === 'melancholic') {
    content += `${mainCharacter} sat by the window, watching raindrops race down the glass. The house felt especially empty today, filled with echoes of conversations that used to fill these rooms.\n\n`;
  } else if (tone === 'suspenseful') {
    content += `${mainCharacter} froze at the sound. It came from the basement—a soft thud that shouldn't be there when no one else was home. The flashlight app cast long shadows as ${mainCharacter} approached the basement door.\n\n`;
  } else {
    content += `${mainCharacter} sorted through the mail, setting aside bills and flipping through advertisements. A postcard from an old friend was a welcome surprise among the usual stack.\n\n`;
  }
  
  // Add some dialogue
  content += `"Have you seen my keys?" called ${secondaryCharacter} from the other room.\n\n`;
  content += `${mainCharacter} spotted them under a magazine. "Found them. You really need a better system for keeping track of things."\n\n`;
  
  // Add a home challenge
  content += `The sudden leak in the ceiling couldn't have come at a worse time. With guests arriving tomorrow and the repair service booked solid, ${mainCharacter} would need to get creative with solutions.\n\n`;
  
  // Add a resolution or cliffhanger
  content += `As evening approached, ${mainCharacter} surveyed the situation. Sometimes the biggest challenges revealed unexpected strengths. Tomorrow would be interesting, one way or another.THE_END_MARKER\n\n`;
  
  return content;
}

function generateGenericContent(characters: string[], tone: string, context: string, title: string): string {
  const mainCharacter = characters[0] || 'The protagonist';
  const secondaryCharacter = characters.length > 1 ? characters[1] : 'the companion';
  
  let content = '';
  
  // Start with a generic scenario based on the title
  if (title.toLowerCase().includes('adventure') || title.toLowerCase().includes('journey')) {
    content += `${mainCharacter} stood at the crossroads, map in hand. The path ahead looked different from what was expected. "I think we need to reconsider our route," ${mainCharacter} said, tracing a finger along the faded lines.\n\n`;
  } else if (title.toLowerCase().includes('mystery') || title.toLowerCase().includes('secret')) {
    content += `${mainCharacter} examined the curious object found in the attic. It didn't belong to anyone in the family, yet here it was, hidden away for who knows how long. What was its purpose?\n\n`;
  } else if (title.toLowerCase().includes('friend') || title.toLowerCase().includes('family')) {
    content += `${mainCharacter} prepared for the gathering with care. It had been too long since everyone was together, and this reunion needed to be special. Would old tensions resurface, or had time healed those wounds?\n\n`;
  } else {
    // Default generic opening
    content += `${mainCharacter} faced a new day with mixed feelings. Change was coming—it always was—but whether it would be welcome remained to be seen.\n\n`;
  }
  
  // Add some dialogue
  content += `"What do you think we should do?" asked ${secondaryCharacter}, waiting for guidance.\n\n`;
  content += `${mainCharacter} considered carefully before answering. "We need more information before making a decision. Let's take our time with this."\n\n`;
  
  // Add a challenge
  content += `The situation grew more complicated when unexpected news arrived. ${mainCharacter} would need to adapt quickly, drawing on past experiences to navigate these unfamiliar waters.\n\n`;
  
  // Add a resolution or cliffhanger
  content += `By day's end, ${mainCharacter} had gained a new perspective. Some questions were answered, while others emerged. The journey continued, as it always does.THE_END_MARKER\n\n`;
  
  return content;
}

function generateFillerSentences(setting: string, characters: string[], tone: string): string[] {
  const mainCharacter = characters[0] || 'The person';
  
  // Create setting-specific filler sentences
  if (setting === 'workplace') {
    return [
      `The office hummed with the usual activity.`,
      `${mainCharacter} checked the time, aware of the approaching deadline.`,
      `Emails continued to flood the inbox, each marked urgent.`,
      `The meeting room slowly filled with colleagues, each bringing their own agenda.`,
      `Coffee cups littered the desk, evidence of a long workday.`,
      `The printer jammed again, causing a minor delay.`,
      `Someone had left donuts in the break room, a small bright spot in the day.`,
      `The view from the office window showed a city in constant motion.`,
      `Phones rang in the background, creating a familiar soundtrack to the workday.`,
      `The project board was covered in sticky notes and task assignments.`
    ];
  } else if (setting === 'space') {
    return [
      `Stars stretched endlessly beyond the viewport.`,
      `The ship's systems hummed with a reassuring rhythm.`,
      `${mainCharacter} checked the navigation coordinates once more.`,
      `The artificial gravity occasionally fluctuated, a reminder of their distance from home.`,
      `Communication with other vessels was sporadic this far out.`,
      `The ship's AI monitored life support functions silently.`,
      `Space dust occasionally pinged against the hull, like distant rain.`,
      `The crew quarters were quiet during this shift rotation.`,
      `Distant planets appeared as mere specks from this vantage point.`,
      `The vastness of space never ceased to inspire awe.`
    ];
  } else if (setting === 'school') {
    return [
      `The classroom clock ticked slowly toward dismissal.`,
      `Students whispered among themselves when the teacher turned to the board.`,
      `${mainCharacter} doodled in the margins of a notebook.`,
      `The hallways echoed with the sounds of lockers opening and closing.`,
      `Announcements crackled over the intercom system.`,
      `Sunlight streamed through the classroom windows, illuminating dust particles.`,
      `The cafeteria buzzed with conversation and laughter.`,
      `Textbooks and papers covered every available surface.`,
      `The library offered a quiet refuge from the usual chaos.`,
      `After-school activities were in full swing across campus.`
    ];
  } else if (setting === 'home') {
    return [
      `The house settled with familiar creaks and sounds.`,
      `${mainCharacter} moved through the familiar rooms with ease.`,
      `Outside, the neighborhood was quiet except for distant lawn mowers.`,
      `The kitchen still smelled faintly of this morning's breakfast.`,
      `Family photos lined the hallway, capturing moments from years past.`,
      `Sunlight shifted across the floor as the afternoon progressed.`,
      `The comfortable silence was occasionally broken by household sounds.`,
      `Plants on the windowsill needed watering, a task for tomorrow.`,
      `The mail had piled up on the side table, mostly unimportant.`,
      `The living room remained the heart of daily activities.`
    ];
  } else {
    // Generic filler sentences
    return [
      `${mainCharacter} paused to consider the next steps.`,
      `The situation required careful thought and planning.`,
      `Past experiences provided valuable guidance in this moment.`,
      `Time seemed to move differently during important decisions.`,
      `Small details sometimes made the biggest difference.`,
      `The path forward wasn't always clear, but movement was necessary.`,
      `Patience had served ${mainCharacter} well in similar situations.`,
      `Sometimes the best approach was the simplest one.`,
      `Memories of previous challenges offered useful lessons.`,
      `The importance of this moment wasn't lost on anyone involved.`
    ];
  }
}

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
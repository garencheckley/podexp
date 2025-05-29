import { GoogleGenerativeAI } from '@google/generative-ai';
import { DetailedResearchResults } from './searchOrchestrator';
import { NarrativeStructure } from './narrativePlanner';
import { POWERFUL_MODEL_ID } from '../config';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generates structured content following the narrative plan
 * @param researchResults Research results for topics
 * @param narrativeStructure Narrative structure to follow
 * @returns Formatted content following the narrative structure
 */
export async function generateStructuredContent(
  researchResults: DetailedResearchResults,
  narrativeStructure: NarrativeStructure
): Promise<string | null> {
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log('[contentFormatter] Generating structured content based on narrative plan');
    
    const prompt = `
      Create a data-driven, market research podcast episode script that follows this exact narrative structure.
      
      NARRATIVE STRUCTURE:
      
      1. Introduction (${narrativeStructure.introduction.wordCount} words)
         - Approach: ${narrativeStructure.introduction.approach}
         - Topics to mention: ${narrativeStructure.introduction.topics}
         - Opening hook: "${narrativeStructure.introduction.hook}"
      
      2. Body Sections:
      ${narrativeStructure.bodySections.map((section, index) => `
         Section ${index + 1}: ${section.sectionTitle} (${section.wordCount} words)
         - Topic: ${section.topicReference}
         - Approach: ${section.contentApproach}
         - Key points: ${section.keyPoints.join(', ')}
         - Lead-in transition: "${section.transitions.leadIn}"
         - Lead-out transition: "${section.transitions.leadOut}"
      `).join('')}
      
      3. Conclusion (${narrativeStructure.conclusion.wordCount} words)
         - Summarization approach: ${narrativeStructure.conclusion.summarizationApproach}
         - Final thoughts: ${narrativeStructure.conclusion.finalThoughts}
      
      RESEARCH CONTENT TO USE:
      
      ${researchResults.topicResearch.map(research => `
      Topic: ${research.topic}
      ${research.synthesizedContent}
      `).join('\n\n')}
      
      OVERALL SYNTHESIS:
      ${researchResults.overallSynthesis}
      
      HOST PERSONA:
      Act as an authoritative market research expert who presents sophisticated analysis backed by HARD DATA. Speak with the confidence of someone who intimately understands the domain space and is talking to other professionals who already grasp the fundamentals. Don't waste time explaining basics that your audience already knows. Your value comes from connecting data points, identifying patterns, and extracting meaningful insights.
      
      CONTENT REQUIREMENTS:
      1. DATA-CENTRIC ANALYSIS: 
         - EVERY significant claim MUST be supported by specific numbers, percentages, or statistics
         - Include exact figures (e.g., "37% growth" not "significant growth")
         - Cite specific dates for data points
         - Include year-over-year comparisons where relevant
      
      2. DIRECT QUOTES:
         - Include at least 2-3 direct quotes from sources in each major section
         - Format quotes as: "According to [Source], '[exact quote]'"
         - Ensure quotes are properly attributed
         - Use quotes that provide specific insights or data
      
      3. PRECISE EXAMPLES:
         - Reference specific companies, products, or case studies
         - Include exact names, dates, and outcomes
         - Provide concrete metrics for each example
      
      4. COMPARATIVE METRICS:
         - Use specific numbers for comparisons
         - Include exact percentages for changes
         - Reference specific time periods for trends
      
      5. EXPERT SYNTHESIS:
         - Connect specific data points across topics
         - Highlight numerical patterns and trends
         - Draw conclusions based on exact figures
      
      WRITING RESTRICTIONS:
      1. NO GENERIC STATEMENTS: Every claim must have specific supporting data
      2. NO VAGUE CLAIMS: Use exact numbers instead of relative terms
      3. NO FILLER PHRASES: Avoid empty phrases like "it's important to note"
      4. NO OBVIOUS STATEMENTS: Focus on specific insights and data
      
      CRITICAL FORMAT REQUIREMENTS:
      1. Write in plain text with ONLY standard punctuation
      2. DO NOT include any audio instructions
      3. DO NOT include any speaker indicators
      4. DO NOT include section headers or transition markers
      5. DO NOT use markdown formatting
      6. Write in a professional, data-focused style
      7. NEVER include text that can't be read aloud
      8. NEVER reference specific time periods
      9. AVOID assumptions about publication frequency
      10. USE PARAGRAPH BREAKS LIBERALLY: Break content into short, digestible paragraphs (2-4 sentences each)
      11. START NEW PARAGRAPHS when changing topics, introducing new data points, or transitioning between ideas
      12. ENSURE READABILITY: Content should never be a dense wall of text - use frequent paragraph breaks for clarity
      
      REQUIRED: Structure the content exactly according to the word counts specified. Every paragraph must include SPECIFIC DATA POINTS, STATISTICS, or DIRECT QUOTES. Write as an authoritative market researcher speaking to other domain experts.
    `;
    
    // Add length check for prompt (Example limit, adjust as needed)
    const MAX_PROMPT_LENGTH = 30000; // Adjust based on model limits 
    if (prompt.length > MAX_PROMPT_LENGTH) {
        console.warn(`[contentFormatter] Prompt length (${prompt.length}) exceeds limit (${MAX_PROMPT_LENGTH}). Truncating research content.`);
        // Implement logic to truncate the research content within the prompt if needed
        // This part is complex and needs careful implementation based on how researchResults is structured
        // For now, we'll just log a warning and proceed, which might still fail
    }

    const result = await model.generateContent(prompt);
    const generatedContent = result.response.text();
    
    // Check if we got a reasonable response
    if (generatedContent.length < 100) {
      console.error('[contentFormatter] Generated content is too short. Failing generation.');
      return null; // Indicate failure
    }
    
    console.log(`[contentFormatter] Generated structured content (${generatedContent.split(/\s+/).length} words)`);
    return generatedContent;
  } catch (error) {
    console.error('[contentFormatter] Error generating structured content. Details:', JSON.stringify(error, null, 2));
    // Log specific properties if available (common in API errors)
    if (error instanceof Error) {
      console.error('[contentFormatter] Error Name:', error.name);
      console.error('[contentFormatter] Error Message:', error.message);
      // console.error('[contentFormatter] Error Stack:', error.stack); // Stack might be too verbose for regular logs
    }
    // Attempt to log response data if it exists (some libraries attach it)
    if (error && typeof error === 'object' && 'response' in error) {
        console.error('[contentFormatter] Error Response Data:', JSON.stringify((error as any).response, null, 2));
    }
    return null; // Indicate failure
  }
}

/**
 * Creates a feedback entry for the narrative structure adherence
 * @param narrativeStructure The narrative structure with adherence metrics
 * @returns Feedback string to store with the episode
 */
export function createAdherenceFeedback(narrativeStructure: NarrativeStructure): string {
  const { structureScore, balanceScore, transitionScore, overallAdherence } = narrativeStructure.adherenceMetrics;
  
  return `
NARRATIVE STRUCTURE ADHERENCE METRICS:
Structure Adherence Score: ${structureScore}/100
Balance Adherence Score: ${balanceScore}/100
Transition Quality Score: ${transitionScore}/100
Overall Adherence Score: ${overallAdherence}/100

Structure Summary:
- Introduction: ${narrativeStructure.introduction.wordCount} words
- Body Sections: ${narrativeStructure.bodySections.length} sections
  ${narrativeStructure.bodySections.map(section => 
    `  - ${section.sectionTitle}: ${section.wordCount} words`
  ).join('\n')}
- Conclusion: ${narrativeStructure.conclusion.wordCount} words
- Total: ${narrativeStructure.overallWordCount} words
  `;
}

/**
 * Generates a concise bullet point summary for an episode
 * @param episodeTitle The title of the episode
 * @param episodeContent The full content of the episode
 * @returns An array of bullet points (3-5) summarizing the key points of the episode
 */
export async function generateEpisodeBulletPoints(episodeTitle: string, episodeContent: string): Promise<string[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  
  try {
    console.log(`Generating bullet points for episode: ${episodeTitle}`);
    
    // Create a prompt for bullet point generation
    const bulletPointPrompt = `
      Create 3-5 concise bullet points that summarize the key points of this podcast episode.
      Each bullet point should capture a distinct and important aspect of the content.
      
      Episode Title: ${episodeTitle}
      
      Episode Content:
      ${episodeContent.substring(0, 15000)} ${episodeContent.length > 15000 ? '...' : ''}
      
      Respond with ONLY the bullet points in a JSON array format:
      ["Bullet point 1", "Bullet point 2", "Bullet point 3"]
      
      Guidelines for good bullet points:
      - Focus on the most important information
      - Be specific and informative
      - Keep each bullet point to 1-2 sentences
      - Cover different aspects of the content
      - Don't repeat information
    `;
    
    const result = await model.generateContent(bulletPointPrompt);
    const responseText = result.response.text();
    
    // Parse the JSON response
    try {
      // Clean up potential markdown formatting
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const bulletPoints = JSON.parse(cleanedResponse);
      
      // Ensure we have at least 3 and at most 5 bullet points
      if (Array.isArray(bulletPoints) && bulletPoints.length >= 3 && bulletPoints.length <= 5) {
        return bulletPoints;
      } else {
        // If the response doesn't match our expected format, extract bullet points manually
        const extractedBullets = responseText
          .split('\n')
          .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
          .map(line => line.trim().replace(/^[-*]\s*/, ''))
          .filter(line => line.length > 10); // Ensure substantive bullets
        
        if (extractedBullets.length >= 3) {
          return extractedBullets.slice(0, 5); // Limit to 5 bullets
        }
        
        // Fallback if we couldn't extract properly formatted bullets
        console.warn(`Could not parse bullet points properly for ${episodeTitle}. Generating generic ones.`);
        return [
          `Summary of "${episodeTitle}"`,
          "Key points from the episode content",
          "Main takeaways from the discussion"
        ];
      }
    } catch (parseError) {
      console.error('Error parsing bullet points:', parseError);
      // Fallback for parsing errors
      return [
        `Summary of "${episodeTitle}"`,
        "Key points from the episode content",
        "Main takeaways from the discussion"
      ];
    }
  } catch (error) {
    console.error('Error generating bullet points:', error);
    // Fallback for generation errors
    return [
      `Summary of "${episodeTitle}"`,
      "Key points from the episode content",
      "Main takeaways from the discussion"
    ];
  }
} 
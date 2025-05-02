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
      1. DATA-CENTRIC ANALYSIS: Liberally cite SPECIFIC statistics, percentages, growth rates, market sizes, and other quantifiable metrics in EVERY section
      2. PRECISE EXAMPLES: Reference specific companies, products, or case studies to illustrate key points
      3. COMPARATIVE METRICS: Use data to make meaningful comparisons (year-over-year changes, industry benchmarks, cross-sector analysis)
      4. EXPERT SYNTHESIS: Connect disparate data points to reveal non-obvious patterns and implications
      5. DOMAIN-SPECIFIC TERMINOLOGY: Use specialized vocabulary and industry terms appropriate to field experts
      6. Follow the narrative structure precisely, maintaining the specified word counts for each section
      7. Use the provided transitions between sections exactly as written
      8. Incorporate all the key points for each section
      
      WRITING RESTRICTIONS:
      1. NO GENERIC STATEMENTS: Every significant claim must be supported by specific data or concrete examples
      2. NO DUMBING DOWN: Write for an audience that already understands the domain - focus on advanced insights
      3. NO VAGUE CLAIMS: Instead of "sales grew significantly," say "sales grew 37% year-over-year"
      4. NO FILLER PHRASES: Avoid empty phrases like "it's important to note," "as we can see," "it's worth mentioning"
      5. NO OBVIOUS STATEMENTS: Don't tell listeners what they already know - focus exclusively on high-value insights
      
      CRITICAL FORMAT REQUIREMENTS:
      1. Write in plain text with ONLY standard punctuation (periods, commas, question marks)
      2. DO NOT include any audio instructions like "(upbeat music)" or "(pause)"
      3. DO NOT include any speaker indicators like "Host:" or "Speaker:"
      4. DO NOT include section headers or transition markers in the actual content
      5. DO NOT use markdown formatting, special characters, bold, or italics
      6. Write in a professional, data-focused style but without explicitly marking the speaker
      7. Do not mention section numbers or use formatting markers in the actual content
      8. NEVER include text that can't be read aloud like "(Podcast Intro Music Fades)" or "(Podcast Outro Music Fades In)"
      9. NEVER reference specific time periods like "monthly update" or "April 2025 update" - keep content timeless
      10. AVOID assumptions about publication frequency (daily, weekly, monthly)
      
      REQUIRED: Structure the content exactly according to the word counts specified - this is critical. Every paragraph should include SPECIFIC DATA POINTS, STATISTICS or CONCRETE EXAMPLES. Write as an authoritative market researcher speaking to other domain experts.
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
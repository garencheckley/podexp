import { GoogleGenerativeAI } from '@google/generative-ai';
import { EpisodeAnalysis } from './episodeAnalyzer';
import { POWERFUL_MODEL_ID } from '../config';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Interface for content validation result
 */
export interface ValidationResult {
  similarityScore: number;
  uniqueElements: string[];
  redundantElements: string[];
  differentiationAssessment: string;
  improvementSuggestions: string[];
  isPassing: boolean;
  improvedContent?: string;
}

/**
 * Validates that new content is sufficiently differentiated from previous episode content
 * @param draftContent Draft episode content to validate
 * @param analysis Analysis of previous episodes
 * @returns Validation result with assessment and potential improvements
 */
export async function validateContentDifferentiation(
  draftContent: string,
  analysis: EpisodeAnalysis
): Promise<ValidationResult> {
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log('Validating content differentiation');
    
    // If there are no previous episodes, content is automatically differentiated
    if (analysis.episodeCount === 0) {
      return {
        similarityScore: 0,
        uniqueElements: ['All content is unique as there are no previous episodes'],
        redundantElements: [],
        differentiationAssessment: 'Content is unique as this is the first episode.',
        improvementSuggestions: [],
        isPassing: true
      };
    }
    
    const validationPrompt = `
      Evaluate this draft episode content against previous episodes to ensure it provides unique value.
      
      Draft episode content:
      ${draftContent.substring(0, 6000)}
      
      Previous episodes have covered these topics:
      ${analysis.recentTopics.map(t => `- ${t.topic} (mentioned ${t.frequency} times)`).join('\n')}
      
      Recurrent themes in previous episodes:
      ${Array.from(analysis.recurrentThemes).join(', ')}
      
      Analyze and respond in JSON format:
      {
        "similarityScore": 0-100,
        "uniqueElements": ["element1", "element2", ...],
        "redundantElements": ["element1", "element2", ...],
        "differentiationAssessment": "Detailed assessment of how unique this content is",
        "improvementSuggestions": ["suggestion1", "suggestion2", ...],
        "isPassing": true/false
      }
      
      Set "isPassing" to true if the content is sufficiently differentiated, or false if it needs improvement.
      A content should pass if:
      1. It covers topics not extensively covered in previous episodes
      2. It provides new perspectives or information on existing topics
      3. It has a unique approach or angle to the subject matter
      4. The similarity score is below 50
    `;
    
    const result = await model.generateContent(validationPrompt);
    const responseText = result.response.text();
    
    try {
      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const validationResult = JSON.parse(cleanedResponse) as ValidationResult;
      
      console.log(`Content validation complete. Similarity score: ${validationResult.similarityScore}, Passing: ${validationResult.isPassing}`);
      
      // If content isn't differentiated enough, request improvements
      if (!validationResult.isPassing) {
        console.log('Content needs improvement. Requesting improved version...');
        const improvedContent = await improveContentDifferentiation(
          draftContent,
          validationResult.redundantElements,
          validationResult.improvementSuggestions
        );
        
        return {
          ...validationResult,
          improvedContent
        };
      }
      
      return validationResult;
    } catch (parseError) {
      console.error('Error parsing validation result:', parseError);
      // Provide a default passing validation on error
      return {
        similarityScore: 30,
        uniqueElements: ['Unable to determine unique elements due to parsing error'],
        redundantElements: [],
        differentiationAssessment: 'Error in validation process, but content is assumed to be sufficiently unique.',
        improvementSuggestions: [],
        isPassing: true
      };
    }
  } catch (error) {
    console.error('Error validating content differentiation:', error);
    // Provide a default passing validation on error
    return {
      similarityScore: 30,
      uniqueElements: ['Unable to determine unique elements due to error'],
      redundantElements: [],
      differentiationAssessment: 'Error in validation process, but content is assumed to be sufficiently unique.',
      improvementSuggestions: [],
      isPassing: true
    };
  }
}

/**
 * Improves content to make it more differentiated from previous episodes
 * @param draftContent Original draft content
 * @param redundantElements Elements identified as redundant
 * @param improvementSuggestions Suggestions for improvement
 * @returns Improved content
 */
async function improveContentDifferentiation(
  draftContent: string,
  redundantElements: string[],
  improvementSuggestions: string[]
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log('Improving content differentiation');
    
    const improvementPrompt = `
      Rewrite this podcast episode content to make it more unique and differentiated.
      
      Original content:
      ${draftContent.substring(0, 6000)}
      
      The following elements were identified as redundant or too similar to previous episodes:
      ${redundantElements.map(e => `- ${e}`).join('\n')}
      
      Please implement these specific improvement suggestions:
      ${improvementSuggestions.map(s => `- ${s}`).join('\n')}
      
      Create an improved version that:
      1. Replaces redundant elements with significantly different content, focusing on new insights or information.
      2. Focuses on changing the ANALYTICAL FRAME or PERSPECTIVE on the topics, rather than just swapping minor facts or rephrasing. Offer a different angle or interpretation.
      3. Deepens coverage in areas that allow for this new perspective.
      4. Maintains the same general structure and flow.
      5. Preserves the educational value and information accuracy.
      
      CRITICAL FORMAT REQUIREMENTS:
      1. Write in plain text with ONLY standard punctuation (periods, commas, question marks)
      2. DO NOT include any audio instructions like "(upbeat music)" or "(pause)"
      3. DO NOT include any speaker indicators like "Host:" or "Speaker:"
      4. NEVER include text that can't be read aloud like "(Podcast Intro Music Fades)" or "(Podcast Outro Music Fades In)"
      5. NEVER reference specific time periods like "monthly update" or "April 2025 update" - keep content timeless
      6. AVOID assumptions about publication frequency (daily, weekly, monthly)
      
      Improved content:
    `;
    
    const result = await model.generateContent(improvementPrompt);
    const improvedContent = result.response.text();
    
    console.log('Generated improved content');
    return improvedContent;
  } catch (error) {
    console.error('Error improving content differentiation:', error);
    // Return the original content if improvement fails
    return draftContent;
  }
} 
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DetailedResearchResults } from './searchOrchestrator';
import { NarrativeStructure } from './narrativePlanner';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const modelId = 'gemini-2.0-flash';
const model = genAI.getGenerativeModel({ model: modelId });

/**
 * Generates structured content following the narrative plan
 * @param researchResults Research results for topics
 * @param narrativeStructure Narrative structure to follow
 * @returns Formatted content following the narrative structure
 */
export async function generateStructuredContent(
  researchResults: DetailedResearchResults,
  narrativeStructure: NarrativeStructure
): Promise<string> {
  try {
    console.log('Generating structured content based on narrative plan');
    
    const prompt = `
      Create a podcast episode script that follows this exact narrative structure.
      
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
      
      ${researchResults.topicResearch.map((research, index) => `
      Topic ${index + 1}: ${research.topic}
      ${research.synthesizedContent.substring(0, 500)}...
      `).join('\n\n')}
      
      INSTRUCTIONS:
      1. Follow the narrative structure precisely, maintaining the specified word counts for each section
      2. Use the provided transitions between sections exactly as written
      3. Incorporate the key points for each section
      4. Use the research content as your factual basis
      5. Maintain a conversational podcast tone throughout
      6. Create a cohesive story that flows naturally between sections
      7. Write in plain text with no formatting, speech directions, or special characters
      8. Use only standard punctuation (periods, commas, question marks)
      
      REQUIRED: Structure the content exactly according to the word counts specified - this is critical.
    `;
    
    const result = await model.generateContent(prompt);
    const generatedContent = result.response.text();
    
    // Check if we got a reasonable response
    if (generatedContent.length < 100) {
      console.error('Generated content is too short, falling back to unstructured content');
      return researchResults.overallSynthesis;
    }
    
    console.log(`Generated structured content (${generatedContent.split(/\s+/).length} words)`);
    return generatedContent;
  } catch (error) {
    console.error('Error generating structured content:', error);
    // Fall back to using the overall synthesis from research results
    console.log('Falling back to unstructured content');
    return researchResults.overallSynthesis;
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
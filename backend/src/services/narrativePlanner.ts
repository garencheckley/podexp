import { GoogleGenerativeAI } from '@google/generative-ai';
import { EpisodePlan } from './searchOrchestrator';
import { POWERFUL_MODEL_ID, RELIABLE_MODEL_ID } from '../config';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY || '');

// Types
export interface DetailedResearchResults {
  episodeTitle: string;
  overallSynthesis: string;
  topicResearch: Array<{
    topic: string;
    synthesizedContent: string;
  }>;
}

export type ContentLength = 'short' | 'medium' | 'long';

/**
 * Interface for enhanced narrative structure
 */
export interface NarrativeStructure {
  introduction: {
    approach: string;
    topics: string;
    hook: string;
    wordCount: number;
  };
  bodySections: Array<{
    sectionTitle: string;
    topicReference: string;
    contentApproach: string;
    keyPoints: string[];
    transitions: {
      leadIn: string;
      leadOut: string;
    };
    wordCount: number;
  }>;
  conclusion: {
    summarizationApproach: string;
    finalThoughts: string;
    wordCount: number;
  };
  overallWordCount?: number;
  adherenceMetrics?: {
    structureScore: number;
    balanceScore: number;
    transitionScore: number;
    overallAdherence: number;
  };
}

/**
 * Helper function to get word count based on content length
 */
function getWordCountForLength(contentLength: ContentLength): number {
  switch (contentLength) {
    case 'short': return 800;
    case 'medium': return 1500;
    case 'long': return 2500;
    default: return 1500;
  }
}

/**
 * Helper function to get optimal section count based on content length
 */
function getOptimalSectionCount(contentLength: ContentLength): number {
  switch (contentLength) {
    case 'short': return 3;
    case 'medium': return 4;
    case 'long': return 5;
    default: return 4;
  }
}

/**
 * Creates an enhanced narrative structure based on the episode plan
 * @param episodePlan Basic episode plan from searchOrchestrator
 * @param targetWordCount Target word count for the entire episode
 * @returns Enhanced narrative structure with detailed section planning
 */
export async function createNarrativeStructure(
  researchResults: DetailedResearchResults,
  contentLength: ContentLength
): Promise<NarrativeStructure> {
  const model = genAI.getGenerativeModel({ model: RELIABLE_MODEL_ID });
  try {
    console.log(`Creating narrative structure for ${contentLength} content`);
    const wordCount = getWordCountForLength(contentLength);
    
    // Calculate rough word count allocations
    const introWordCount = Math.floor(wordCount * 0.15); // 15% for intro
    const conclusionWordCount = Math.floor(wordCount * 0.1); // 10% for conclusion
    const bodyWordCount = wordCount - introWordCount - conclusionWordCount;
    
    // Determine optimal number of body sections based on content length
    const optimalSectionCount = getOptimalSectionCount(contentLength);
    const sectionWordCount = Math.floor(bodyWordCount / optimalSectionCount);
    
    const prompt = `
      As a market analysis expert, create a detailed narrative structure for a data-focused podcast episode about the following topic. The structure should emphasize quantitative analysis, industry metrics, and evidence-based insights.
      
      RESEARCH CONTENT:
      ${researchResults.overallSynthesis}
      
      Topic Research Details:
      ${researchResults.topicResearch.map(research => `
      - ${research.topic}: ${research.synthesizedContent.substring(0, 500)}...
      `).join('\n')}
      
      INSTRUCTIONS:
      Create a professional narrative structure for a data-driven podcast episode with EXACTLY the following components:
      
      1. Introduction section with:
         - An attention-grabbing hook statement that mentions a surprising statistic or metric
         - A brief explanation of what analysts should know about this topic
         - Word count: exactly ${introWordCount} words
      
      2. Exactly ${optimalSectionCount} body sections, each with:
         - A clear section title incorporating metrics or analytical terms (e.g., "Segment Growth: 43% YoY Increase in Enterprise Adoption")
         - Reference to specific topics from the research (identify which research topic to use)
         - Content approach emphasizing data-driven analysis, trend identification, market impact
         - 3-5 key bullet points (as phrases) highlighting metrics, quantitative insights, and specific examples to cover
         - A transition statement leading into the section
         - A transition statement leading out of the section
         - Word count: exactly ${sectionWordCount} words per section
      
      3. Conclusion section with:
         - Approach for synthesizing the key metrics and insights
         - Final thought statement that ties back to the hook but is forward-looking
         - Word count: exactly ${conclusionWordCount} words
      
      REQUIREMENTS:
      - Focus on quantitative analysis and evidence-based insights
      - Use business/market research terminology appropriate for experts
      - Prioritize topics with the strongest data points and metrics
      - Structure each section to follow a logical analytical progression
      - Ensure transitions between sections create a cohesive analytical narrative
      - Format as a valid JSON object with the structure shown below
      
      OUTPUT FORMAT:
      Return a valid JSON object with this exact structure:
      {
        "introduction": {
          "hook": "string - engaging opening statement with a key statistic",
          "approach": "string - how to introduce the topic",
          "topics": "string - key points to cover in intro",
          "wordCount": number
        },
        "bodySections": [
          {
            "sectionTitle": "string - analytical section title with metrics",
            "topicReference": "string - which research topic this section draws from",
            "contentApproach": "string - analytical approach for this section",
            "keyPoints": ["string", "string", "string", "string", "string"],
            "transitions": {
              "leadIn": "string - transition into this section",
              "leadOut": "string - transition out of this section"
            },
            "wordCount": number
          },
          ... additional sections ...
        ],
        "conclusion": {
          "summarizationApproach": "string - how to wrap up the analysis",
          "finalThoughts": "string - closing statement with forward-looking insight",
          "wordCount": number
        }
      }
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    try {
      const narrativeStructure = JSON.parse(response);
      
      // Quick validation
      if (!narrativeStructure.introduction || !narrativeStructure.bodySections || !narrativeStructure.conclusion) {
        throw new Error('Narrative structure missing required sections');
      }
      
      console.log('Successfully created narrative structure');
      return narrativeStructure;
    } catch (error) {
      console.error('Error parsing narrative structure:', error);
      throw new Error('Failed to create valid narrative structure');
    }
  } catch (error) {
    console.error('Error creating narrative structure:', error);
    
    // Return a basic fallback structure
    return createFallbackNarrativeStructure(researchResults, contentLength);
  }
}

/**
 * Fallback narrative structure in case the AI-generated one fails
 */
function createFallbackNarrativeStructure(
  researchResults: DetailedResearchResults,
  contentLength: ContentLength
): NarrativeStructure {
  console.log('Creating fallback narrative structure');
  
  // Calculate basic word count distribution
  const introWordCount = Math.round(getWordCountForLength(contentLength) * 0.15);
  const conclusionWordCount = Math.round(getWordCountForLength(contentLength) * 0.1);
  const bodyTotalWordCount = getWordCountForLength(contentLength) - introWordCount - conclusionWordCount;
  
  // Distribute remaining words among body sections
  const topics = researchResults.topicResearch;
  const bodySections = topics.map((topic, index) => {
    // Calculate word count based on position (simpler fallback)
    const sectionWordCount = Math.round(bodyTotalWordCount / topics.length);
    
    return {
      sectionTitle: `Analysis of ${topic.topic}`,
      topicReference: topic.topic,
      contentApproach: "Explore key insights and implications",
      keyPoints: [
        "Main finding from research",
        "Supporting evidence or data",
        "Implications for stakeholders"
      ],
      transitions: {
        leadIn: index === 0 
          ? "Let's begin by examining" 
          : "Moving on to another important aspect",
        leadOut: index === topics.length - 1 
          ? "With that analysis complete, let's summarize" 
          : "This leads us to our next topic"
      },
      wordCount: sectionWordCount
    };
  });
  
  return {
    introduction: {
      approach: "Start with a clear overview of the episode topics",
      topics: researchResults.topicResearch.map(t => t.topic).join(', '),
      hook: `Today we're exploring ${researchResults.episodeTitle}, a fascinating topic with many dimensions.`,
      wordCount: introWordCount
    },
    bodySections,
    conclusion: {
      summarizationApproach: "Recap key insights and their interconnections",
      finalThoughts: "Reflect on the broader implications for the industry",
      wordCount: conclusionWordCount
    },
    overallWordCount: getWordCountForLength(contentLength)
  };
}

/**
 * Evaluates generated content against the planned narrative structure
 * @param generatedContent The final generated podcast script content
 * @param narrativeStructure The planned narrative structure
 * @returns The narrative structure updated with adherence metrics
 */
export async function evaluateContentAdherence(
  generatedContent: string,
  narrativeStructure: NarrativeStructure
): Promise<NarrativeStructure> {
  const model = genAI.getGenerativeModel({ model: POWERFUL_MODEL_ID });
  try {
    console.log('Evaluating content adherence to narrative structure');

    const prompt = `
      Evaluate how well this generated podcast content adheres to the planned narrative structure.
      
      Planned Structure:
      ${JSON.stringify(narrativeStructure, null, 2)}
      
      Generated Content:
      ${generatedContent.substring(0, 15000)}
      
      Evaluate the following on a scale of 1-10 (1=poor, 10=excellent):
      1. Structure Score: How well does the content follow the planned sections (intro, body, conclusion)?
      2. Balance Score: How well does the word count distribution match the planned allocation?
      3. Transition Score: How smooth are the transitions between sections?
      
      Respond ONLY in JSON format:
      {
        "structureScore": <number>,
        "balanceScore": <number>,
        "transitionScore": <number>
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
    const metrics = JSON.parse(cleanedResponse);

    // Calculate overall adherence
    const overallAdherence = Math.round(
      (metrics.structureScore + metrics.balanceScore + metrics.transitionScore) / 3
    );

    console.log(`Adherence Evaluation: Structure=${metrics.structureScore}, Balance=${metrics.balanceScore}, Transitions=${metrics.transitionScore}, Overall=${overallAdherence}`);

    // Update the narrative structure with the metrics
    return {
      ...narrativeStructure,
      adherenceMetrics: {
        structureScore: metrics.structureScore,
        balanceScore: metrics.balanceScore,
        transitionScore: metrics.transitionScore,
        overallAdherence: overallAdherence
      }
    };

  } catch (error) {
    console.error('Error evaluating content adherence:', error);
    // Return the original structure if evaluation fails
    return narrativeStructure;
  }
} 
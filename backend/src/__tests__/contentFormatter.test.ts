import { createAdherenceFeedback } from '../services/contentFormatter';
import { NarrativeStructure } from '../services/narrativePlanner';

describe('contentFormatter', () => {
  describe('createAdherenceFeedback', () => {
    it('should create feedback with all adherence metrics', () => {
      const mockNarrativeStructure: NarrativeStructure = {
        introduction: {
          wordCount: 200,
          approach: 'Hook with industry trend',
          topics: 'AI, Machine Learning',
          hook: 'The AI revolution is accelerating'
        },
        bodySections: [
          {
            sectionTitle: 'Market Overview',
            topicReference: 'AI Market Growth',
            contentApproach: 'Data-driven analysis',
            wordCount: 300,
            keyPoints: ['Market size', 'Growth rate', 'Key players'],
            transitions: {
              leadIn: 'Let\'s dive into the numbers',
              leadOut: 'This sets the stage for'
            }
          },
          {
            sectionTitle: 'Technology Trends',
            topicReference: 'ML Innovations',
            contentApproach: 'Technical deep dive',
            wordCount: 250,
            keyPoints: ['New algorithms', 'Hardware advances'],
            transitions: {
              leadIn: 'Building on this foundation',
              leadOut: 'These developments lead us to'
            }
          }
        ],
        conclusion: {
          wordCount: 150,
          summarizationApproach: 'Key takeaways synthesis',
          finalThoughts: 'Future outlook and implications'
        },
        overallWordCount: 900,
        adherenceMetrics: {
          structureScore: 95,
          balanceScore: 88,
          transitionScore: 92,
          overallAdherence: 91
        }
      };

      const feedback = createAdherenceFeedback(mockNarrativeStructure);

      // Check that feedback includes all key metrics
      expect(feedback).toContain('Structure Adherence Score: 95/100');
      expect(feedback).toContain('Balance Adherence Score: 88/100');
      expect(feedback).toContain('Transition Quality Score: 92/100');
      expect(feedback).toContain('Overall Adherence Score: 91/100');

      // Check that it includes structure summary
      expect(feedback).toContain('Introduction: 200 words');
      expect(feedback).toContain('Body Sections: 2 sections');
      expect(feedback).toContain('Market Overview: 300 words');
      expect(feedback).toContain('Technology Trends: 250 words');
      expect(feedback).toContain('Conclusion: 150 words');
      expect(feedback).toContain('Total: 900 words');
    });

    it('should handle narrative structure with single body section', () => {
      const mockNarrativeStructure: NarrativeStructure = {
        introduction: {
          wordCount: 150,
          approach: 'Direct opening',
          topics: 'Single Topic',
          hook: 'Test hook'
        },
        bodySections: [
          {
            sectionTitle: 'Main Content',
            topicReference: 'Main Topic',
            contentApproach: 'Comprehensive analysis',
            wordCount: 500,
            keyPoints: ['Point 1', 'Point 2'],
            transitions: {
              leadIn: 'Let\'s begin',
              leadOut: 'In conclusion'
            }
          }
        ],
        conclusion: {
          wordCount: 100,
          summarizationApproach: 'Brief summary',
          finalThoughts: 'Final wrap-up'
        },
        overallWordCount: 750,
        adherenceMetrics: {
          structureScore: 100,
          balanceScore: 90,
          transitionScore: 85,
          overallAdherence: 91
        }
      };

      const feedback = createAdherenceFeedback(mockNarrativeStructure);

      expect(feedback).toContain('Body Sections: 1 sections');
      expect(feedback).toContain('Main Content: 500 words');
      expect(feedback).toContain('Total: 750 words');
    });

    it('should handle narrative structure with multiple body sections', () => {
      const mockNarrativeStructure: NarrativeStructure = {
        introduction: {
          wordCount: 100,
          approach: 'Brief intro',
          topics: 'Multiple topics',
          hook: 'Opening statement'
        },
        bodySections: [
          {
            sectionTitle: 'Section 1',
            topicReference: 'Topic 1',
            contentApproach: 'Analysis',
            wordCount: 200,
            keyPoints: ['Point A'],
            transitions: { leadIn: 'First', leadOut: 'Next' }
          },
          {
            sectionTitle: 'Section 2',
            topicReference: 'Topic 2',
            contentApproach: 'Analysis',
            wordCount: 200,
            keyPoints: ['Point B'],
            transitions: { leadIn: 'Second', leadOut: 'Then' }
          },
          {
            sectionTitle: 'Section 3',
            topicReference: 'Topic 3',
            contentApproach: 'Analysis',
            wordCount: 200,
            keyPoints: ['Point C'],
            transitions: { leadIn: 'Third', leadOut: 'Finally' }
          }
        ],
        conclusion: {
          wordCount: 100,
          summarizationApproach: 'Summary',
          finalThoughts: 'Conclusion'
        },
        overallWordCount: 800,
        adherenceMetrics: {
          structureScore: 98,
          balanceScore: 95,
          transitionScore: 96,
          overallAdherence: 96
        }
      };

      const feedback = createAdherenceFeedback(mockNarrativeStructure);

      expect(feedback).toContain('Body Sections: 3 sections');
      expect(feedback).toContain('Section 1: 200 words');
      expect(feedback).toContain('Section 2: 200 words');
      expect(feedback).toContain('Section 3: 200 words');
    });
  });
});

# Podcast Enhancement Backlog

## Introduction

This document outlines planned enhancements to address issues with news-type podcast episodes, specifically focusing on making content:
1. Less repetitive across episodes
2. More in-depth rather than surface-level
3. More comprehensive in analysis and viewpoints
4. Better at building upon previous episodes (additive knowledge)

These improvements aim to enhance the quality of AI-generated podcast episodes, particularly for news-type content using web search integration.

## Key User Issues (Persistent)

The backlog items aim to address the following core user-reported problems with the generated news podcast content:

1.  **Repetitiveness**: Episodes cover similar topics or information already discussed.
2.  **Lack of Depth**: Content often feels surface-level, scratching the surface without digging into details or nuances.
3.  **Insufficient Analysis**: Episodes lack comprehensive analysis, expert-level commentary, or exploration of implications ("why it matters").
4.  **Lack of Continuity**: Episodes don't effectively build upon knowledge or context established in previous episodes.
5.  **"Fluff"**: Content includes filler phrases or lacks substance, reducing overall value.

*(These issues will remain listed until explicitly marked as resolved by the user, regardless of project completion status.)*

## Prioritized Project Backlog

**Project: Podcast Topic Generation Improvement**

*   **Goal:** Address the "Key User Issues" (repetitiveness, lack of depth, insufficient analysis, fluff) by significantly improving how initial podcast topics are generated. The aim is to make topics more specific, relevant, up-to-date, and directly aligned with the podcast's theme and designated news sources.

*   **Core Strategy:** Transition from the current multi-step AI process for initial topic discovery (which involves one AI call to generate search queries, followed by another AI call to identify potential topics from those search results) to a **new, single, direct AI call**. 

*   **New Prompting Mechanism:**
    *   A detailed, carefully crafted prompt will be sent to the Gemini API (via the existing `executeWebSearch` function, leveraging its web grounding capabilities).
    *   This prompt will instruct Gemini to directly generate 5-7 potential podcast episode topic ideas.
    *   **Key inputs to the prompt:**
        *   The podcast's main theme/description.
        *   A list of the podcast's configured preferred reference websites/sources.
        *   A strict requirement for topics to be based on news and developments from within a **fixed 14-day window**.
    *   **Expected output from Gemini:** A JSON array where each object represents a topic idea and includes:
        *   `topic_title`: A concise, engaging title.
        *   `topic_summary`: A brief explanation of its timeliness and relevance.
        *   `key_questions`: 2-3 questions the episode could explore.
        *   `supporting_sources`: 1-3 URLs supporting the topic's timeliness.

*   **Implementation Details (primarily in `backend/src/services/searchOrchestrator.ts`):**
    1.  A new function (e.g., `generateDirectTopicIdeas`) will be created to construct this new prompt and manage the call to `executeWebSearch`.
    2.  This function will include robust parsing for the expected JSON response from Gemini.
    3.  Another new helper function (e.g., `adaptDirectResultsToSearchResults`) will transform the detailed output from Gemini into the existing `SearchResults` interface. This ensures compatibility with downstream processes like episode planning (`planEpisodeContent`) without requiring extensive changes to those later stages.
    4.  The main `performInitialSearch` function will be modified to use these new helper functions, replacing its current calls to `generateExploratoryQueries` and `identifyPotentialTopics`.
    5.  **Fallback:** A robust fallback to the *entire existing old topic generation method* will be implemented if the new direct method fails (e.g., API error, parsing failure), ensuring system continuity.

*   **Phased Rollout:**
    *   **Phase 1 (Initial Live Deployment):** Focus on reliably extracting `topic_title`s using the new prompt. The `adaptDirectResultsToSearchResults` function will perform a light adaptation. The robust fallback to the old system is critical here. This allows for real-world validation of the new prompt's effectiveness.
    *   **Phase 2 (Full Integration):** Enhance parsing to extract all fields from Gemini's response (`summary`, `key_questions`, `supporting_sources`). Fully implement `adaptDirectResultsToSearchResults` to map all this rich data. Continue with the robust fallback.

*   **Expected Outcome:** This approach aims to make the initial topic discovery more direct, targeted, and aligned with successful manual prompting strategies, leading to more relevant, timely, and in-depth topic suggestions, thereby improving the overall quality of generated podcast episodes.

## Technical Considerations

- All enhancements should maintain compatibility with existing Gemini API usage
- Improvements should scale appropriately with episode length (shorter episodes need fewer topics, longer episodes need more depth)
- Search strategies must respect API rate limits and costs
- The system should gracefully degrade if any enhancement component fails
- All enhancements should respect the podcast's original prompt/format
- Source attribution should be maintained and improved throughout

## Success Metrics

The success of these enhancements will be measured by:

1. **Semantic diversity** between episodes (lower repetition)
2. **Information density** per topic (higher depth)
3. **Viewpoint representation** (broader perspective)
4. **Knowledge continuity** between episodes (building upon previous content)
5. **Source diversity** (variety of reference material)
6. **Listener satisfaction** with content depth and quality

## Conclusion

This backlog represents a strategic approach to enhancing the podcast generation system's ability to create news content that is more in-depth, less repetitive, and more valuable to listeners. The projects are designed to be implemented sequentially, with each building on the foundations laid by previous improvements. 
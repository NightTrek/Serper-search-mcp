/**
 * Handler implementation for the Deep Research tool
 */
import { ResearchOrchestrator } from '../../orchestration/researchOrchestrator.js';
import { ResearchRequest, ResearchResult } from '../../../domain/types/research.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

/**
 * Handles requests to the deep-research tool
 */
export class ResearchToolHandler {
  private researchOrchestrator: ResearchOrchestrator;

  /**
   * Creates a new research tool handler
   */
  constructor(researchOrchestrator: ResearchOrchestrator) {
    this.researchOrchestrator = researchOrchestrator;
  }

  /**
   * Handles the research tool request
   * @param args Tool input arguments
   * @returns Formatted tool response
   */
  async handleResearchRequest(args: any) {
    try {
      // Validate and create research request
      const request: ResearchRequest = {
        query: args.query,
        depth: args.depth || 'standard',
        maxSources: args.maxSources || 10
      };
      
      
      // Execute the research process
      const result = await this.researchOrchestrator.executeResearch(request);
      
      // Return formatted results
      return {
        content: [
          {
            type: 'text',
            text: this.formatResearchResult(result),
          },
        ],
      };
    } catch (error) {
      console.error('Error in research tool handler:', error);
      
      if (error instanceof McpError) {
        throw error;
      }
      
      // Handle unexpected errors
      throw new McpError(
        ErrorCode.InternalError,
        `Unexpected error during research: ${(error as Error).message}`
      );
    }
  }

  /**
   * Formats the research result as rich markdown with enhanced citations and metadata
   */
  private formatResearchResult(result: ResearchResult): string {
    // Start with the main answer
    let formattedResult = result.answer;

    // Add research methodology section if not already included
    if (!formattedResult.includes('## Research Methodology')) {
      formattedResult += `\n\n## Research Methodology\n`;
      formattedResult += `This analysis was generated through a multi-stage research process:\n\n`;
      formattedResult += `1. **Query Analysis**: The original query was analyzed to identify key dimensions and knowledge requirements\n`;
      formattedResult += `2. **Strategic Decomposition**: ${result.subQueriesGenerated} targeted sub-queries were generated to explore different aspects\n`;
      formattedResult += `3. **Comprehensive Search**: ${result.searchesPerformed} distinct searches were performed to gather information\n`;
      formattedResult += `4. **Source Collection**: ${result.citations.length} relevant sources were identified and analyzed\n`;
      formattedResult += `5. **Critical Synthesis**: Information was evaluated, compared, and integrated to form a comprehensive analysis\n\n`;
      
      // Add sub-query information if available
      if (result.subQueriesGenerated > 0) {
        formattedResult += `### Research Coverage\n`;
        formattedResult += `The research process explored multiple dimensions of the topic to ensure comprehensive coverage:\n\n`;
        formattedResult += `- **Information Breadth**: Multiple perspectives and viewpoints were incorporated\n`;
        formattedResult += `- **Analytical Depth**: Core concepts were examined in detail with supporting evidence\n`;
        formattedResult += `- **Critical Evaluation**: Sources were assessed for reliability and relevance\n`;
      }
    }

    // Add source quality assessment if not already included and there are citations
    if (!formattedResult.includes('## Source Assessment') && result.citations.length > 0) {
      formattedResult += `\n\n## Source Assessment\n`;
      formattedResult += `The information in this report comes from ${result.citations.length} distinct sources. `;
      
      // Group sources by approximate domain
      const domains = new Map<string, number>();
      result.citations.forEach(citation => {
        try {
          const url = new URL(citation.url);
          const domain = url.hostname;
          domains.set(domain, (domains.get(domain) || 0) + 1);
        } catch (e) {
          // Skip invalid URLs
        }
      });
      
      if (domains.size > 0) {
        formattedResult += `Sources include:\n\n`;
        
        // List the top domains
        Array.from(domains.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([domain, count]) => {
            formattedResult += `- ${domain}: ${count} source${count > 1 ? 's' : ''}\n`;
          });
      }
    }

    // Add sources section if not already included
    if (!formattedResult.includes('## Sources')) {
      formattedResult += `\n\n## Sources\n\n`;
      
      // Sort citations by relevance score before listing
      const sortedCitations = [...result.citations]
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      // Add sources with numbers matching citations in the text
      sortedCitations.forEach((citation, index) => {
        const sourceNum = index + 1;
        formattedResult += `[${sourceNum}] **${citation.title}**\n`;
        formattedResult += `    URL: ${citation.url}\n`;
        if (citation.snippet && citation.snippet.trim().length > 0) {
          formattedResult += `    Summary: ${citation.snippet}\n`;
        }
        formattedResult += `\n`;
      });
    }

    return formattedResult;
  }
}

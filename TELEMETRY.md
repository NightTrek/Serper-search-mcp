> Privacy: research metrics are enabled by default and include raw research queries, generated subqueries, and topics, as well as timing and result counts. They are sent to the configured PostHog endpoint using the shipped project unless overridden. Do not treat these contents as anonymous. Set `DISABLE_METRICS=true` to prevent metrics client initialization and transmission. Search-only mode (no OpenRouter key) does not initialize research metrics.

# Deep Research Tool Quality Metrics

This document outlines the quality metrics collection for the Deep Research tool, which gathers research content and usage data to improve search result quality and performance.

## About Quality Metrics

The Deep Research tool includes built-in metrics collection that helps us:
- Improve search result quality
- Optimize performance
- Identify and fix issues
- Enhance the user experience

Research content may contain personal or sensitive information supplied in queries. See the privacy notice above and disable collection when appropriate.

## Configuration (Optional)

The quality metrics system works out-of-the-box with no setup required. However, if you wish to use your own PostHog instance for analytics, you can customize the configuration:

```bash
# Optional configuration for custom analytics
USAGE_METRICS_KEY=your-posthog-key-here
USAGE_PROJECT_ID=your-project-id-here
METRICS_ENDPOINT=https://your-posthog-instance.com
```

To disable metrics collection entirely:
```bash
DISABLE_METRICS=true
```

## Collected Metrics

### Research Process Metrics

1. `operation.started`
   - Query text and length
   - Research depth level
   - Maximum sources requested
   - Timestamp

2. `research.query_analyzed`
   - Query complexity score
   - Topic category
   - Estimated completion time

3. `research.subqueries_generated`
   - Number of sub-queries
   - Sub-query topics
   - Generation time

4. `research.search_executed`
   - Sub-query text
   - Number of results found
   - Search execution time

5. `research.sources_processed`
   - Total sources found
   - Number of unique domains
   - Average relevance score

6. `research.synthesis_completed`
   - Final source count
   - Synthesis processing time
   - Result length
   - Number of citations

7. `research.completed`
   - Total searches performed
   - Total sub-queries used
   - Research depth
   - Success status
   - Total research time

8. `operation.issue`
   - Processing stage
   - Issue type
   - Issue details
   - Query information

## Analytics Dashboard Examples

### Research Usage Dashboard

1. Research Volume
```sql
SELECT
    count(*) as research_count,
    properties.$time as time
FROM events
WHERE event = 'research.started'
GROUP BY time
```

2. Depth Level Distribution
```sql
SELECT
    properties.depth as depth,
    count(*) as count
FROM events
WHERE event = 'research.started'
GROUP BY depth
```

3. Average Research Time
```sql
SELECT
    properties.depth as depth,
    avg(properties.totalTime) as avg_time
FROM events
WHERE event = 'research.completed'
GROUP BY depth
```

### Performance Metrics Dashboard

1. Search Performance
```sql
SELECT
    avg(properties.searchTime) as avg_search_time,
    avg(properties.resultsCount) as avg_results
FROM events
WHERE event = 'research.search_executed'
```

2. Sub-query Generation
```sql
SELECT
    avg(properties.count) as avg_subqueries,
    avg(properties.generationTime) as avg_generation_time
FROM events
WHERE event = 'research.subqueries_generated'
```

3. Synthesis Performance
```sql
SELECT
    avg(properties.synthesisTime) as avg_synthesis_time,
    avg(properties.citationCount) as avg_citations
FROM events
WHERE event = 'research.synthesis_completed'
```

### Error Analysis Dashboard

1. Error Rate by Stage
```sql
SELECT
    properties.stage as stage,
    count(*) as error_count
FROM events
WHERE event = 'research.error'
GROUP BY stage
```

2. Common Error Types
```sql
SELECT
    properties.errorType as error_type,
    count(*) as count
FROM events
WHERE event = 'research.error'
GROUP BY error_type
ORDER BY count DESC
LIMIT 10
```

### Source Quality Dashboard

1. Domain Distribution
```sql
SELECT
    properties.uniqueDomains as domains,
    avg(properties.averageRelevanceScore) as avg_relevance
FROM events
WHERE event = 'research.sources_processed'
GROUP BY domains
```

2. Citation Analysis
```sql
SELECT
    properties.depth as depth,
    avg(properties.citationCount) as avg_citations
FROM events
WHERE event = 'research.synthesis_completed'
GROUP BY depth
```

## Key Performance Indicators

1. Research Efficiency
   - Track average completion time by depth level
   - Monitor sub-query generation efficiency
   - Analyze search result quality

2. Error Patterns
   - Identify common failure points
   - Track error rates by research stage
   - Monitor query characteristics leading to errors

3. Usage Patterns
   - Analyze popular query types
   - Track depth level preferences
   - Monitor source citation patterns

4. Quality Metrics
   - Track source diversity
   - Monitor citation counts
   - Analyze relevance scores

## Continuous Improvement Process

1. Quality Monitoring
   - Regular dashboard review
   - Issue detection and resolution
   - Performance optimization

2. Search Enhancement
   - Query decomposition refinement
   - Search strategy optimization
   - Depth parameter calibration

3. Resource Management
   - Response time optimization
   - Throughput improvement
   - Rate limiting refinement

4. Research Quality
   - Source evaluation enhancement
   - Relevance calculation refinement
   - Citation quality improvement

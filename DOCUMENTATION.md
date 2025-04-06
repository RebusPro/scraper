# Enhanced Email Scraper: Technical Documentation

## System Architecture Overview

The enhanced email scraper is a sophisticated multi-mode web scraping system optimized for extracting email addresses and contact information from coaching and sports websites. It employs a three-tiered approach with multiple filtering layers to ensure high-quality results while respecting website structures.

## Core Components

### 1. Scraping Engine

- **Browser Automation**: Built on Playwright for headless/headed browser orchestration
- **Page Processing**: Handles navigation, content extraction, and HTML parsing
- **Link Discovery**: Prioritizes contact-related pages through intelligent URL queue management
- **Error Handling**: Implements retry logic, graceful timeouts, and session recovery

### 2. Contact Extraction Pipeline

- **Pattern Recognition**: Uses regex-based extraction with context-awareness
- **Multi-pass Scanning**: Employs multiple extraction techniques per page
- **False Positive Filtering**: Three-layer filtering system to eliminate non-email data
- **Contact Correlation**: Associates names and titles with extracted emails

### 3. Cancellation Mechanism

- **Clean Shutdown**: Gracefully terminates processes without losing data
- **Resource Management**: Properly closes browser instances and connections
- **Partial Results Return**: Returns valid results even when terminated early

## Mode Specifications

### Standard Mode

**Technical Parameters:**

- **Maximum Pages**: 5 pages per website
- **Crawl Depth**: 1 (main page + direct links)
- **Priority System**: Contact pages > About pages > Other pages
- **Browser Settings**: Headless Chromium, 15-second timeout
- **Resource Handling**: Blocks CSS/images/fonts for speed
- **Link Following**: Enabled, but limited to same domain

**Best Use Cases:**

- Medium-sized coaching websites (5-20 pages)
- Sites with standard navigation structures
- When you need a balance of speed and thoroughness
- For batch processing multiple sites (10-50) in reasonable time

**Technical Implementation Details:**

- Uses a breadth-first crawling strategy with priority queue
- Employs standard browser timeout settings (15s)
- Follows same-origin links only
- Pages are visited in priority order based on keyword matching

### Aggressive Mode

**Technical Parameters:**

- **Maximum Pages**: 10 pages per website
- **Crawl Depth**: 2 (follows links from contact pages)
- **Priority System**: Enhanced with 3-tier priority weighting
- **Browser Settings**: Uses headed browser for JavaScript-heavy sites
- **Resource Handling**: Selectively loads resources based on page type
- **Link Following**: Enabled with increased timeout (30s)

**Best Use Cases:**

- Complex websites with dynamic content (like hockey.travelsports.com)
- Sites with hidden contact information
- For high-priority websites where maximum data extraction is needed
- When dealing with JavaScript-rendered content

**Technical Implementation Details:**

- Dynamically detects JavaScript-heavy sites and switches to headed browser
- Implements scrolling behavior to trigger lazy-loaded content
- Uses more aggressive timeouts for complex operations
- Follows nested links based on relevance scoring
- Applies heavier processing for contact pages

### Gentle Mode

**Technical Parameters:**

- **Maximum Pages**: 1 page per website
- **Crawl Depth**: 0 (scans only the provided URL)
- **Priority System**: N/A (no link following)
- **Browser Settings**: Headless Chromium, 5-second timeout
- **Resource Handling**: Blocks all non-essential resources
- **Link Following**: Disabled

**Best Use Cases:**

- Very simple landing pages or contact pages
- When processing hundreds of URLs quickly
- As a first-pass scan to identify promising sites
- For initial dataset exploration or validation

**Technical Implementation Details:**

- Single-page scan with minimal network requests
- Uses aggressive resource blocking for maximum speed
- Implements shortened timeouts (5s)
- Employs only basic email extraction techniques
- Optimized for minimum server load and maximum throughput

## Advanced Feature Details

### Contact Page Prioritization

The system implements a sophisticated page prioritization system:

```javascript
// Priority levels (higher number = higher priority)
priority = 3; // Contact pages (highest)
priority = 2; // About/team pages
priority = 1; // Support/help pages
priority = 0; // Regular pages (lowest)
```

Pages are queued based on their priority level, ensuring that the most promising pages are processed first. This significantly improves the chances of finding contact information early in the scraping process.

### GPS Coordinate Filtering (Triple-Layer)

To prevent GPS coordinates from being mistakenly identified as emails, the system implements three layers of filtering:

1. **Initial Extraction Filter**:

   ```javascript
   // Filter out GPS coordinates during initial extraction
   if (
     email.startsWith("/@") ||
     /\/@\d+\.\d+/.test(email) ||
     /^@\d+\.\d+/.test(email)
   )
     return false;
   ```

2. **Deduplication Filter**:

   ```javascript
   // During email normalization and deduplication
   if (cleanedEmail.match(/^\/?\@[0-9\.\-]+$/)) return; // Skip this GPS coordinate
   ```

3. **Final Output Filter**:
   ```javascript
   // Final filtering before returning results
   filteredContacts = this.applyFinalFiltering(contacts);
   ```

### Dynamic Mode Adjustments

The system automatically adjusts settings based on the URL being processed:

```javascript
const dynamicSitePatterns = [
  "travelsports.com",
  "hockey",
  "sports",
  "coaches",
  "directory",
];

const needsHeadlessFalse = dynamicSitePatterns.some((pattern) =>
  url.toLowerCase().includes(pattern)
);

if (needsHeadlessFalse) {
  useHeadless = false; // Switch to headed browser for dynamic content
}
```

## Performance Optimization

### Resource Handling

To improve scraping performance, the system selectively blocks resource types:

```javascript
// Disable resource loading for speed
await context.route(
  "**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2,ttf,otf}",
  (route) => route.abort()
);
```

### Intelligent Timeouts

Timeouts are optimized based on the mode and operation:

- **Navigation Timeout**: Varies by mode (5s, 15s, 30s)
- **Wait Timeout**: Reduced for DOM stabilization (5s max)
- **Network Idle**: Set to shorter thresholds for improved performance

## Usage Recommendations

### For Small Batches (1-10 websites)

- Use **Aggressive Mode** for maximum data extraction
- Expect approximately 30-60 seconds per website
- Best for targeted marketing campaigns or high-value coach lists

### For Medium Batches (10-50 websites)

- Use **Standard Mode** for balanced performance
- Expect approximately 10-30 seconds per website
- Suitable for regional marketing campaigns or specific sports

### For Large Batches (50+ websites)

- Use **Gentle Mode** for initial scanning
- Switch to **Standard Mode** for promising results
- Expect 3-10 seconds per website in Gentle Mode
- Ideal for initial market exploration or database building

### For Technical Sites with Dynamic Content

- Force **Aggressive Mode** with headed browser
- Consider using specific URL patterns that directly target contact pages
- Add additional time buffer for complex JavaScript rendering

## Error Handling and Resilience

The system implements multiple error handling strategies:

1. **Navigation Retry Logic**: Automatically retries failed navigations
2. **Context Isolation**: Each website is processed in an isolated context
3. **Graceful Degradation**: Falls back to simpler extraction if complex methods fail
4. **Memory Management**: Closes unused browser contexts to prevent memory leaks
5. **Cancellation Handling**: Properly terminates operations when cancelled

## Best Practices

1. **URL Quality**: Provide the most specific URLs possible (e.g., homepage or contact page)
2. **Batch Sizing**: Process websites in reasonable batch sizes (20-50 max)
3. **Mode Selection**: Match mode to website complexity and importance
4. **Time Management**: For large datasets, start with Gentle mode then upgrade
5. **Cancellation**: Use the Stop button when needed - results up to that point will be preserved

## Implementation Note

The enhanced system handles both standard websites and complex dynamic sites, but specialized sites may require configuration adjustments. The multi-layer filtering system ensures high-quality results with minimal false positives.

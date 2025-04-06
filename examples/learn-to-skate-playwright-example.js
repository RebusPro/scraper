/**
 * Example for scraping the Learn To Skate USA website with Playwright
 * This example demonstrates how to handle dynamic content with form interactions
 */

// Import the PlaywrightScraper
import { PlaywrightScraper } from '../src/lib/scraper/playwrightScraper.js';

/**
 * Scrapes the Learn To Skate USA website for a specific location
 * @param {string} location - The location to search for (e.g., "Alabama", "Chicago", etc.)
 * @returns {Promise<Array>} - Array of contacts with emails
 */
async function scrapeLearnToSkatePrograms(location) {
  // Create a new instance of the PlaywrightScraper
  const scraper = new PlaywrightScraper();

  // Define scraping options with form interactions for the search page
  const scrapingOptions = {
    // Playwright has better dynamic content handling than Puppeteer
    browserType: 'chromium', // Can also use 'firefox' or 'webkit' for different engines
    timeout: 60000, // 60 seconds timeout for slow sites
    includePhoneNumbers: true,

    // The most important part - form interaction configuration
    formInteraction: {
      enabled: true,

      // Define the search field and submit button
      fields: [
        {
          // The search location input field
          selector: '#searchLocation',
          value: location,
          type: 'text'
        }
      ],

      // The search button
      submitButtonSelector: '#searchButton',

      // Wait for the results to load - important for dynamic sites!
      waitForSelector: '.results-container',

      // Additional wait time after results appear (5 seconds)
      waitTime: 5000
    }
  };

  try {
    // Scrape the website with the configured options
    const contacts = await scraper.scrapeWebsite(
      'https://www.learntoskateusa.com/findaskatingprogram/',
      scrapingOptions
    );

    console.log(`Found ${contacts.length} contacts from Learn To Skate USA programs`);
    return contacts;
  } catch (error) {
    console.error('Error scraping Learn To Skate USA:', error);
    return [];
  }
}

// Example usage (can be uncommented to run)
/*
scrapeLearnToSkatePrograms('Alabama')
  .then(contacts => {
    console.log('Results:', contacts);
  })
  .catch(error => {
    console.error('Error:', error);
  });
*/

export { scrapeLearnToSkatePrograms };
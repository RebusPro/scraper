/**
 * Updated example for scraping the Learn to Skate USA website
 * with improved handling of search results
 */

import { WebScraper } from '../src/lib/scraper';

export async function scrapeLearToSkateUpdated() {
  console.log('Starting Learn to Skate USA scraper with improved result handling...');

  // Create a scraper instance with enhanced form interaction
  const scraper = new WebScraper({
    // Enable headless browser (required for form interaction)
    useHeadless: true,

    // Follow links to find more contacts on detail pages
    followLinks: true,
    maxDepth: 2,

    // Enable form interaction with enhanced configuration
    formInteraction: {
      enabled: true,

      // Define form fields to fill - using proper selectors and values
      fields: [
        // State dropdown - different states may yield different results
        {
          selector: '#mapStateId',
          value: '6', // Colorado (try different states if no results)
          type: 'select'
        },

        // Zip radius - make sure it's large enough
        {
          selector: '#zipSelect',
          value: '100', // 100 mile radius (maximum)
          type: 'select'
        }
      ],

      // The search button selector
      submitButtonSelector: '#searchProgramsSubmitBtn',

      // Increased wait time to ensure results load
      waitTime: 5000 // 5 seconds
    }
  });

  try {
    // Run the scraper on the Learn to Skate USA website
    const result = await scraper.scrapeWebsite('https://www.learntoskateusa.com/findaskatingprogram/#mapListings');

    console.log(`Scraping completed. Found ${result.contacts.length} contacts.`);

    // Log more details about what was found
    if (result.contacts.length > 0) {
      console.log('Emails found:');
      result.contacts.forEach(contact => {
        console.log(`- ${contact.email}${contact.name ? ' (' + contact.name + ')' : ''}`);
      });
    } else {
      console.log('No contacts found. This could mean:');
      console.log('1. The search parameters did not yield any results');
      console.log('2. The contacts are not directly accessible via email on this site');
      console.log('3. The site structure changed and selectors need updating');
    }

    return result;
  } catch (error) {
    console.error('Error running scraper:', error);
    throw error;
  }
}

// Example of how to run the script
if (typeof window === 'undefined') { // Only run in Node environment
  scrapeLearToSkateUpdated()
    .then(() => console.log('Scraping completed successfully.'))
    .catch(err => {
      console.error('Scraping failed:', err);
      process.exit(1);
    });
}
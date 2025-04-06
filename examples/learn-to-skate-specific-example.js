/**
 * Specific example configuration for the Learn to Skate USA website
 * based on the exact form elements provided by the user
 */

import { WebScraper } from '../src/lib/scraper';

export async function scrapeLearnToSkateSpecific() {
  console.log('Starting Learn to Skate USA scraper with specific selectors...');

  // Create a scraper instance with form interaction enabled
  const scraper = new WebScraper({
    // Enable headless browser (required for form interaction)
    useHeadless: true,

    // Enable form interaction with specific configuration for Learn to Skate USA
    formInteraction: {
      enabled: true,

      // Define form fields to fill based on the exact selectors provided
      fields: [
        // Optional: Program Name field
        // {
        //   selector: '#mapFacilityName',
        //   value: 'Ice Center', // Optional: You can search for a specific program
        //   type: 'text'
        // },

        // State dropdown - Using the exact ID from your HTML
        {
          selector: '#mapStateId',
          value: '6', // Value 6 corresponds to Colorado in the dropdown
          type: 'select'
        }
      ],

      // The search button selector using the exact ID
      submitButtonSelector: '#searchProgramsSubmitBtn',

      // Wait for results to appear
      // Since you didn't specify the results container selector,
      // we'll use a reasonable wait time instead
      waitTime: 3000
    }
  });

  try {
    // Run the scraper on the Learn to Skate USA website
    const result = await scraper.scrapeWebsite('https://www.learntoskateusa.com/findaskatingprogram/#mapListings');

    // Display results
    console.log(`Scraping completed. Found ${result.contacts.length} contacts.`);
    console.log('Results:', JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error('Error running scraper:', error);
    throw error;
  }
}

// Example of how to run the script
if (typeof window === 'undefined') { // Only run in Node environment
  scrapeLearnToSkateSpecific()
    .then(() => console.log('Scraping completed successfully.'))
    .catch(err => {
      console.error('Scraping failed:', err);
      process.exit(1);
    });
}
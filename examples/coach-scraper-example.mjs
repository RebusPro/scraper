/**
 * Example of using the enhanced Coach Directory scraper
 * This demonstrates how to extract emails from coaching websites
 * 
 * Note: This is an ES Module file (.mjs) to use modern import syntax
 */
import { PlaywrightScraper } from '../src/lib/scraper/playwrightScraper.js';

async function scrapeCoachingSite() {
  console.log('Starting coach website scraper example...');

  const scraper = new PlaywrightScraper();

  try {
    // Example coaching website
    const url = 'https://hockey.travelsports.com/coaches';

    // Use our enhanced scraper with optimized settings for coaching sites
    const contacts = await scraper.scrapeWebsite(url, {
      maxDepth: 3,           // Search deeper in the site structure
      followLinks: true,      // Follow links to find more emails
      includePhoneNumbers: true,
      useHeadless: false,     // Set to true in production for better performance
      timeout: 60000,
      browserType: 'chromium',
    });

    // Display results
    console.log(`Found ${contacts.length} coaching contacts:`);
    contacts.forEach((contact, index) => {
      console.log(`\nContact #${index + 1}:`);
      console.log(`- Email: ${contact.email}`);
      if (contact.name) console.log(`- Name: ${contact.name}`);
      if (contact.title) console.log(`- Title: ${contact.title}`);
      console.log(`- Source: ${contact.source}`);
    });

    // Save results to a CSV if needed
    // import { exportToCSV } from '../src/lib/scraper/exportUtils.js';
    // exportToCSV(contacts, 'coaching-contacts');

  } catch (error) {
    console.error('Error in scraping process:', error);
  } finally {
    await scraper.close(); // Ensure browser is closed
  }
}

// Run the example
scrapeCoachingSite().catch(console.error);
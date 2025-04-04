/**
 * Example for scraping wiki sites like the Figure Skating Fandom
 * This example demonstrates special handling for wiki sites with contact information
 * in tables, expandable sections, and references
 */

import { PlaywrightScraper } from '../src/lib/scraper/playwrightScraper.js';

/**
 * Scrapes a wiki page for contact information
 * @param {string} wikiUrl - The URL of the wiki page to scrape
 * @returns {Promise<Array>} - Array of contacts with emails
 */
async function scrapeWikiContacts(wikiUrl) {
  // Create a new instance of the PlaywrightScraper
  const scraper = new PlaywrightScraper();

  // Define scraping options optimized for wiki sites
  const scrapingOptions = {
    // Use Playwright which has special handling for wiki pages
    usePlaywright: true,
    browserType: 'chromium', // For best compatibility

    // Give more time for wiki pages to fully load expandable content
    timeout: 60000, // 60 seconds

    // Enable phone number extraction
    includePhoneNumbers: true,

    // No need for form interaction on basic wiki pages
    formInteraction: {
      enabled: false
    }
  };

  try {
    console.log(`Scraping wiki page: ${wikiUrl}`);

    // Scrape the website with the configured options
    const contacts = await scraper.scrapeWebsite(
      wikiUrl,
      scrapingOptions
    );

    console.log(`Found ${contacts.length} contacts from the wiki page`);

    // Filter out any remaining non-contact emails that might have slipped through
    const filteredContacts = contacts.filter(contact => {
      // Skip any tracking or error monitoring emails that our filter missed
      if (
        contact.email.includes('sentry') ||
        contact.email.includes('wixpress') ||
        contact.email.includes('example.com') ||
        contact.email.includes('placeholder')
      ) {
        return false;
      }
      return true;
    });

    console.log(`Filtered to ${filteredContacts.length} legitimate contacts`);
    return filteredContacts;
  } catch (error) {
    console.error('Error scraping wiki page:', error);
    return [];
  }
}

/**
 * Example usage for the Figure Skating Fandom wiki
 */
async function scrapeFigureSkatingRinks() {
  const wikiUrl = 'https://figure-skating.fandom.com/wiki/List_of_ice_rinks_in_the_USA';

  try {
    const contacts = await scrapeWikiContacts(wikiUrl);

    // Log found contacts
    if (contacts.length > 0) {
      console.log('Found contacts:');
      contacts.forEach((contact, index) => {
        console.log(`${index + 1}. ${contact.email}${contact.name ? ` (${contact.name})` : ''}`);
      });
    } else {
      console.log('No contacts found on the wiki page');
    }

    return contacts;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

// Example usage (can be uncommented to run)
/*
scrapeFigureSkatingRinks()
  .then(contacts => {
    console.log('Scraping complete');
  })
  .catch(error => {
    console.error('Error:', error);
  });
*/

export { scrapeWikiContacts, scrapeFigureSkatingRinks };
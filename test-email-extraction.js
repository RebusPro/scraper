/**
 * Test script to demonstrate and verify email extraction improvements
 */
const { PlaywrightScraper } = require('./src/lib/scraper/playwrightScraper');
const { extractEmails, processContactData } = require('./src/lib/scraper/emailExtractor');

// Sample URLs that were problematic before
const testUrls = [
  'https://hockey.travelsports.com/coaches',
  'https://www.championsskatingcenter.com/coaches',
  'https://rays-rentals.com/contact-us/',
  'https://www.greatparkice.com/general-info/contact-us/'
];

// Test function to extract emails and report results
async function testEmailExtraction() {
  console.log('Email Extraction Test - Enhanced Version');
  console.log('=======================================\n');

  const scraper = new PlaywrightScraper();

  for (const url of testUrls) {
    console.log(`\nTesting URL: ${url}`);
    console.log('--------------------------------------------------');

    try {
      // Use enhanced options with longer timeouts and special handling
      const options = {
        followLinks: true,
        maxDepth: 2,
        useHeadless: true,
        usePlaywright: true,
        includePhoneNumbers: true,
        timeout: 60000,
        browserType: 'chromium'
      };

      const contacts = await scraper.scrapeWebsite(url, options);

      // Print results
      console.log(`Found ${contacts.length} contacts:`);

      contacts.forEach((contact, index) => {
        console.log(`\n[Contact ${index + 1}]`);
        console.log(`Email: ${contact.email}`);
        console.log(`Name: ${contact.name || '(not found)'}`);
        console.log(`Title: ${contact.title || '(not found)'}`);
        console.log(`Phone: ${contact.phone || '(not found)'}`);
      });

      console.log('\n--------------------------------------------------');
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
    }
  }

  console.log('\nTest completed!');
}

// Run the test
testEmailExtraction()
  .then(() => console.log('All tests done'))
  .catch(err => console.error('Test failed:', err))
  .finally(() => process.exit(0));
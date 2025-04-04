/**
 * Test script to demonstrate and verify email extraction improvements
 * This version uses ES modules and can be run with node --experimental-modules
 */
import { PlaywrightScraper } from './src/lib/scraper/playwrightScraper.js';
import { extractEmails, processContactData } from './src/lib/scraper/emailExtractor.js';

// Sample URLs that were problematic before
const testUrls = [
  'https://hockey.travelsports.com/coaches',
  'https://www.championsskatingcenter.com/coaches',
  'https://rays-rentals.com/contact-us/',
  'https://www.greatparkice.com/general-info/contact-us/'
];

// Sample HTML content to test email extraction directly
const sampleContent = `
<div>
  Contact our coaches at info@rays-rentals.com or coach@example.com
  <span>Head Coach - John Smith</span>
  <div>jshaffer@therinks.com</div>
  <p>Learn to Skate Coordinator - Jacqie Shaffer</p>
  <img src="40x40_claim_your_page_v2@2x.yji-bd2968af3654281a8794.png" alt="Image">
  <div>Reset password link was sent to your email</div>
</div>
`;

// Test direct email extraction function
function testDirectExtraction() {
  console.log('\nTesting direct email extraction:');
  console.log('--------------------------------------------------');

  // Extract emails from sample content
  const emails = extractEmails(sampleContent);
  console.log('Extracted emails:', emails);

  // Test that image filenames are NOT extracted as emails
  const hasImageFile = emails.some(email => email.includes('@2x') || email.includes('.png'));
  console.log('Contains image filename as email?', hasImageFile ? 'YES (ERROR)' : 'NO (CORRECT)');

  // Test that UI text is NOT extracted as emails
  const hasUIText = emails.some(email => email.includes('Reset password'));
  console.log('Contains UI text as email?', hasUIText ? 'YES (ERROR)' : 'NO (CORRECT)');

  // Process contact data
  const contacts = processContactData(emails, sampleContent, 'https://example.com/test');
  console.log('\nProcessed contacts:');
  contacts.forEach((contact, index) => {
    console.log(`\n[Contact ${index + 1}]`);
    console.log(`Email: ${contact.email}`);
    console.log(`Name: ${contact.name || '(not found)'}`);
    console.log(`Title: ${contact.title || '(not found)'}`);
  });

  console.log('--------------------------------------------------');
}

// Test function to extract emails and report results
async function testEmailExtraction() {
  console.log('Email Extraction Test - Enhanced Version');
  console.log('=======================================\n');

  // First test direct extraction
  testDirectExtraction();

  // Then test with Playwright
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
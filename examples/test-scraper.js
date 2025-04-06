/**
 * Test script to validate the scraper improvements
 * Tests both dynamic form-based sites and wiki sites
 */

import { PlaywrightScraper } from '../src/lib/scraper/playwrightScraper.js';
import { scrapeLearnToSkatePrograms } from './learn-to-skate-playwright-example.js';
import { scrapeWikiContacts } from './wiki-scraper-example.js';

/**
 * Run a comprehensive test of the enhanced scraper
 */
async function runScraperTests() {
  console.log('=== ENHANCED SCRAPER TEST SUITE ===');

  // Test 1: Learn To Skate USA (form-based dynamic site)
  console.log('\n🧪 TEST 1: Learn To Skate USA (Dynamic Form Interaction)');
  try {
    const ltsContacts = await scrapeLearnToSkatePrograms('Alabama');
    console.log(`✅ Found ${ltsContacts.length} contacts from Learn To Skate USA`);
    if (ltsContacts.length > 0) {
      console.log('Sample contacts:');
      ltsContacts.slice(0, 3).forEach(contact => {
        console.log(`  - ${contact.email}${contact.name ? ` (${contact.name})` : ''}`);
      });
    }
  } catch (error) {
    console.error('❌ Learn To Skate test failed:', error);
  }

  // Test 2: Figure Skating Fandom Wiki
  console.log('\n🧪 TEST 2: Figure Skating Fandom Wiki (Structured Content)');
  try {
    const wikiUrl = 'https://figure-skating.fandom.com/wiki/List_of_ice_rinks_in_the_USA';
    const wikiContacts = await scrapeWikiContacts(wikiUrl);
    console.log(`✅ Found ${wikiContacts.length} genuine contacts from Figure Skating Wiki`);
    if (wikiContacts.length > 0) {
      console.log('Sample contacts:');
      wikiContacts.slice(0, 3).forEach(contact => {
        console.log(`  - ${contact.email}${contact.name ? ` (${contact.name})` : ''}`);
      });
    }
  } catch (error) {
    console.error('❌ Wiki test failed:', error);
  }

  // Test 3: Direct PlaywrightScraper test with debugging
  console.log('\n🧪 TEST 3: Direct PlaywrightScraper Test with Verbose Logging');
  try {
    const scraper = new PlaywrightScraper();

    // Example URL that has shown issues with tracking emails
    const testUrl = 'https://figure-skating.fandom.com/wiki/List_of_ice_rinks_in_the_USA#Alaska';

    console.log(`Testing direct scraping of: ${testUrl}`);

    const options = {
      usePlaywright: true,
      browserType: 'chromium',
      timeout: 60000,
      includePhoneNumbers: true
    };

    const contacts = await scraper.scrapeWebsite(testUrl, options);

    // Log details about found contacts
    console.log(`✅ Found ${contacts.length} total contacts`);
    console.log('Email domains found:');

    // Group by domain for analysis
    const domainCounts = {};
    contacts.forEach(contact => {
      const domain = contact.email.split('@')[1];
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });

    // Show domain distribution
    Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([domain, count]) => {
        console.log(`  - ${domain}: ${count} email(s)`);
      });

    // Show valid contacts
    const validContacts = contacts.filter(c =>
      !c.email.includes('sentry') &&
      !c.email.includes('placeholder') &&
      !c.email.includes('example.com')
    );

    console.log(`\n✅ Valid contacts: ${validContacts.length}`);
    validContacts.slice(0, 5).forEach((contact, i) => {
      console.log(`  ${i + 1}. ${contact.email}${contact.name ? ` (${contact.name})` : ''}`);
    });
  } catch (error) {
    console.error('❌ Direct test failed:', error);
  }

  console.log('\n=== TEST SUITE COMPLETE ===');
}

// Run the tests (uncomment to execute)
/*
runScraperTests()
  .then(() => console.log('All tests completed'))
  .catch(error => console.error('Test suite error:', error));
*/

export { runScraperTests };
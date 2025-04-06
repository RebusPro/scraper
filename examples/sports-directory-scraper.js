/**
 * Example scraper for sports directory sites where coaches/contacts 
 * are listed on separate profile pages
 * 
 * This example demonstrates how to scrape sites like hockey.travelsports.com
 * where each coach has their own profile page with contact information
 */

import { PlaywrightScraper } from '../src/lib/scraper/playwrightScraper.js';

/**
 * Scrapes coaches/contacts from a sports directory site that has profile pages
 * @param {string} directoryUrl - The main directory listing URL
 * @param {number} maxProfiles - Maximum number of profile pages to visit (default: 10)
 * @returns {Promise<Array>} - Array of contacts with emails
 */
async function scrapeDirectorySite(directoryUrl, maxProfiles = 10) {
  // Create a new instance of the PlaywrightScraper
  const scraper = new PlaywrightScraper();

  // Define scraping options
  const scrapingOptions = {
    usePlaywright: true,
    browserType: 'chromium',
    timeout: 60000,
    includePhoneNumbers: true,
    followLinks: true, // Enable following links to profile pages
    maxDepth: 2, // Only follow one level deep (main page -> profile pages)
  };

  const allContacts = [];

  try {
    console.log(`Starting directory scrape of: ${directoryUrl}`);

    // First, scrape the main directory page
    const browser = await scraper.launchBrowser(scrapingOptions);
    const page = await browser.newPage();

    // Go to the directory page
    await page.goto(directoryUrl, { waitUntil: 'networkidle' });
    console.log('Loaded main directory page');

    // Get all profile links - look for coach profile patterns
    // This pattern needs to be adjusted for each site's structure
    const profileLinks = await page.$$eval('a[href*="/coaches/"]', links =>
      links.filter(link =>
        link.href.includes('/coaches/') &&
        !link.href.includes('#') &&
        !link.href.includes('?')
      ).map(link => link.href)
    );

    const uniqueLinks = [...new Set(profileLinks)]; // Remove duplicates
    console.log(`Found ${uniqueLinks.length} coach profile links`);

    // Limit the number of profiles to scrape
    const linksToScrape = uniqueLinks.slice(0, maxProfiles);

    // Visit each profile page and extract contact info
    for (const profileUrl of linksToScrape) {
      try {
        console.log(`Scraping profile: ${profileUrl}`);

        // Navigate to the profile page
        await page.goto(profileUrl, { waitUntil: 'networkidle' });

        // Wait for content to load
        await page.waitForTimeout(1000);

        // Extract page content
        const content = await page.content();
        const pageTitle = await page.title();

        // Extract email using our standard extractor
        const emails = scraper.extractEmails(content);

        // If found emails on the profile page, process them
        if (emails.length > 0) {
          console.log(`Found ${emails.length} emails on profile: ${pageTitle}`);

          // Get coach name from page title or URL
          const coachName = pageTitle.includes('-')
            ? pageTitle.split('-')[0].trim()
            : profileUrl.split('/').pop().replace(/-/g, ' ');

          // Process each email
          for (const email of emails) {
            allContacts.push({
              email,
              name: coachName,
              title: 'Coach', // Default title
              source: profileUrl
            });
          }
        } else {
          // If no emails found, check for "contact this coach" forms
          // or other contact patterns specific to the site
          const hasContactForm = await page.$('form[action*="contact"], button:has-text("Contact")');

          if (hasContactForm) {
            console.log('Found contact form, attempting to extract hidden email');

            // Try to find hidden emails in form elements
            const hiddenFields = await page.$$eval('input[type="hidden"]', fields =>
              fields.map(field => ({ name: field.name, value: field.value }))
            );

            const emailField = hiddenFields.find(field =>
              field.name.includes('email') ||
              field.value.includes('@') ||
              field.name.includes('recipient')
            );

            if (emailField && emailField.value.includes('@')) {
              console.log(`Found hidden email in form: ${emailField.value}`);
              allContacts.push({
                email: emailField.value,
                name: coachName,
                title: 'Coach',
                source: profileUrl
              });
            }
          }
        }

        // Wait a bit between requests to avoid overloading the server
        await page.waitForTimeout(500);

      } catch (error) {
        console.error(`Error scraping profile ${profileUrl}:`, error.message);
      }
    }

    // Close the browser
    await browser.close();

    console.log(`Found ${allContacts.length} unique contacts`);
    return allContacts;

  } catch (error) {
    console.error('Error in directory scraping:', error);
    return allContacts;
  }
}

/**
 * Example usage for Travel Sports Hockey coaches
 */
async function scrapeTravelSportsCoaches() {
  const directoryUrl = 'https://hockey.travelsports.com/coaches';

  try {
    console.log('Starting Travel Sports Hockey coach directory scrape');
    const contacts = await scrapeDirectorySite(directoryUrl, 20); // Scrape up to 20 profiles

    // Log found contacts
    if (contacts.length > 0) {
      console.log('Found coaches with contact information:');
      contacts.forEach((contact, index) => {
        console.log(`${index + 1}. ${contact.name || 'Unknown'} (${contact.email})`);
      });
    } else {
      console.log('No coach contacts found');
    }

    return contacts;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

// Example usage (can be uncommented to run)
/*
scrapeTravelSportsCoaches()
  .then(contacts => {
    console.log('Scraping complete');
  })
  .catch(error => {
    console.error('Error:', error);
  });
*/

export { scrapeDirectorySite, scrapeTravelSportsCoaches };
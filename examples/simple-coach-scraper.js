/**
 * Simple Coach Email Extractor
 * 
 * A script to demonstrate the functionality of our coach email extraction system
 * without the complexity of a full batch processing system.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// Configuration
const CSV_FILE = path.join(__dirname, '../public/sample-websites.csv');
const MAX_TIMEOUT = 30000;

/**
 * Extract coach emails from a website
 */
async function extractCoachEmails(url) {
  console.log(`Processing ${url}...`);

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
  });

  const page = await context.newPage();
  const results = { url, contacts: [], error: null };

  try {
    // Navigate to URL with a timeout
    await page.goto(url, {
      timeout: MAX_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });

    // Wait for network to be mostly idle
    await page.waitForLoadState('networkidle').catch(() => { });

    // Special handling for Travel Sports coaches website
    if (url.includes('travelsports.com/coaches')) {
      console.log('Detected Travel Sports coaches page, applying specialized extraction');

      // Extract coach information
      const coachData = await page.evaluate(() => {
        const coaches = [];

        // Find all coach links
        const coachLinks = document.querySelectorAll('a[href*="/coaches/"]');

        coachLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (!href || href === '/coaches' || href.includes('/register')) return;

          // Get coach name
          const nameElement = link.querySelector('strong');
          const name = nameElement && nameElement.textContent ? nameElement.textContent.trim() : null;

          // Get coach info from URL if name not found
          const urlName = href.split('/').pop()?.replace(/-/g, ' ');
          const coachName = name || urlName;

          if (coachName) {
            // Generate possible email formats based on name
            const nameParts = coachName.split(' ');
            if (nameParts.length >= 2) {
              const firstName = nameParts[0].toLowerCase();
              const lastName = nameParts[nameParts.length - 1].toLowerCase();

              coaches.push({
                name: coachName,
                title: 'Hockey Coach',
                emails: [
                  `${firstName}.${lastName}@travelsports.com`,
                  `${firstName}${lastName}@travelsports.com`,
                  `${firstName[0]}${lastName}@travelsports.com`
                ]
              });
            }
          }
        });

        return coaches;
      });

      // Add to results
      coachData.forEach(coach => {
        if (coach.emails && coach.emails.length > 0) {
          results.contacts.push({
            email: coach.emails[0],
            name: coach.name,
            title: coach.title,
            alternateEmails: coach.emails.slice(1)
          });
        }
      });

      console.log(`Found ${results.contacts.length} possible coach contacts`);
    } else {
      // Generic email extraction for other sites
      console.log('Applying generic email extraction');

      // Extract all visible emails on the page
      const emails = await page.evaluate(() => {
        // Get all text on the page
        const allText = document.body.innerText;

        // Find emails with regex
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        return [...new Set(allText.match(emailRegex) || [])];
      });

      // Extract mailto links
      const mailtoEmails = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
        return links.map(link => {
          const email = link.getAttribute('href').replace('mailto:', '');

          // Try to find a name near the email
          const parent = link.closest('div,li,article');
          const nameElement = parent?.querySelector('h1,h2,h3,h4,strong');
          const name = nameElement?.textContent?.trim();

          return { email, name };
        });
      });

      // Combine results
      const allEmails = new Set(emails);
      mailtoEmails.forEach(item => allEmails.add(item.email));

      // Create contact objects
      for (const email of allEmails) {
        // Find matching link data
        const linkData = mailtoEmails.find(link => link.email === email);

        results.contacts.push({
          email,
          name: linkData?.name || undefined,
          source: url
        });
      }

      console.log(`Found ${results.contacts.length} email addresses`);
    }

  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    results.error = error.message;
  } finally {
    await browser.close();
  }

  return results;
}

/**
 * Read URLs from CSV file
 */
function loadUrlsFromCsv(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Skip header
    const urls = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        urls.push(line);
      }
    }

    return urls;
  } catch (error) {
    console.error('Error reading CSV file:', error);
    return [];
  }
}

/**
 * Display the results in a readable format
 */
function displayResults(results) {
  console.log('\n===== SCRAPING RESULTS =====');

  for (const result of results) {
    console.log(`\nWebsite: ${result.url}`);
    console.log(`Status: ${result.error ? 'Error' : 'Success'}`);

    if (result.error) {
      console.log(`Error: ${result.error}`);
    }

    if (result.contacts.length > 0) {
      console.log(`Found ${result.contacts.length} contacts:`);

      for (const contact of result.contacts) {
        console.log(`  - ${contact.email}${contact.name ? ` (${contact.name})` : ''}${contact.title ? `, ${contact.title}` : ''}`);

        if (contact.alternateEmails && contact.alternateEmails.length > 0) {
          console.log(`    Alternative formats: ${contact.alternateEmails.join(', ')}`);
        }
      }
    } else {
      console.log('No contacts found');
    }
  }
}

/**
 * Main function
 */
async function main() {
  // Load URLs from CSV
  console.log(`Loading URLs from: ${CSV_FILE}`);
  const urls = loadUrlsFromCsv(CSV_FILE);

  if (urls.length === 0) {
    console.error('No URLs found in the CSV file.');
    process.exit(1);
  }

  console.log(`Found ${urls.length} URLs to process.`);

  // Process each URL (limit to first 2 for demonstration)
  const maxUrls = Math.min(2, urls.length);
  const results = [];

  for (let i = 0; i < maxUrls; i++) {
    const url = urls[i];
    console.log(`\n[${i + 1}/${maxUrls}] Processing ${url}`);

    const result = await extractCoachEmails(url);
    results.push(result);

    // Short delay between requests
    if (i < maxUrls - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Display results
  displayResults(results);
}

// Run the script
main().catch(error => {
  console.error('Error in script execution:', error);
  process.exit(1);
});
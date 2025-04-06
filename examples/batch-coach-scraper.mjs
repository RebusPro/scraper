/**
 * Batch Scraper for Coach Emails
 * 
 * This script allows scraping multiple coaching websites from an Excel/CSV file
 * and saves the results to a new Excel file.
 * 
 * Usage:
 * node examples/batch-coach-scraper.mjs path/to/excel-file.xlsx
 * 
 * Excel file should have a column containing website URLs.
 */

import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { chromium } from 'playwright';

// Destructure the required XLSX functions
const { readFile, utils, writeFile, utils: { book_new } } = xlsx;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==== CONFIG ====
const DEFAULT_INPUT_FILE = join(__dirname, '../public/sample-websites.csv');
const OUTPUT_FOLDER = join(__dirname, '../output');
const MAX_WAIT_TIME = 30000; // 30 seconds max per website

// ==== HELPER FUNCTIONS ====

/**
 * Extract emails from a coach website
 */
async function extractCoachEmails(url) {
  // Initialize browser
  console.log(`Processing ${url}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
  });

  const page = await context.newPage();
  const results = { url, contacts: [], error: null };

  try {
    // Navigate to URL
    await page.goto(url, { timeout: MAX_WAIT_TIME, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => { });

    // Extract all possible emails
    const emailMatches = await page.evaluate(() => {
      // Get all text content
      const allText = document.body.innerText;

      // Find email patterns
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      return allText.match(emailRegex) || [];
    });

    // Extract mailto links
    const mailtoLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
      return links.map(link => {
        const email = link.href.replace('mailto:', '').trim();

        // Try to find a name near the email
        const parent = link.closest('div,li,article');
        const nameElement = parent?.querySelector('h1,h2,h3,h4,strong');
        const name = nameElement?.textContent?.trim();

        return { email, name };
      });
    });

    // Merge email sources
    const allEmails = new Set([...emailMatches]);
    mailtoLinks.forEach(item => allEmails.add(item.email));

    // Process each email
    for (const email of allEmails) {
      // Find matching link to get name
      const linkMatch = mailtoLinks.find(link => link.email === email);

      // Extract name and title from page context
      const extractedData = await extractNameAndTitle(page, email);

      results.contacts.push({
        email,
        name: linkMatch?.name || extractedData.name || undefined,
        title: extractedData.title || undefined,
        source: url
      });
    }

    // Special handling for travelsports.com coaches
    if (url.includes('travelsports.com/coaches')) {
      await handleTravelSportsCoaches(page, url, results);
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
 * Extract name and title context for an email
 */
async function extractNameAndTitle(page, email) {
  return await page.evaluate((emailAddress) => {
    // Find text surrounding the email
    const allText = document.body.innerHTML;
    const emailIndex = allText.indexOf(emailAddress);
    if (emailIndex === -1) return { name: null, title: null };

    // Get surrounding context (1000 chars before and after the email)
    const start = Math.max(0, emailIndex - 1000);
    const end = Math.min(allText.length, emailIndex + 1000);
    const context = allText.substring(start, end);

    // Look for name patterns (first last format)
    const nameRegex = /([A-Z][a-z]+ [A-Z][a-z]+)/g;
    const nameMatches = [...context.matchAll(nameRegex)];

    // Look for title patterns
    const titleRegex = /(Coach|Director|Manager|Instructor|Trainer|Head Coach|Assistant Coach|Skating Director)/gi;
    const titleMatches = [...context.matchAll(titleRegex)];

    // Return the closest name and title to the email
    const getName = () => {
      if (nameMatches.length === 0) return null;

      // Use the name closest to the email
      let closestName = null;
      let minDistance = Infinity;

      for (const match of nameMatches) {
        const name = match[0];
        // Avoid matching elements that are likely not names
        if (name.includes('Copyright') || name.includes('All Rights')) continue;

        const nameStart = start + match.index;
        const distance = Math.abs(nameStart - emailIndex);
        if (distance < minDistance) {
          closestName = name;
          minDistance = distance;
        }
      }

      return closestName;
    };

    const getTitle = () => {
      if (titleMatches.length === 0) return null;

      // Use the title closest to the email
      let closestTitle = null;
      let minDistance = Infinity;

      for (const match of titleMatches) {
        const title = match[0];
        const titleStart = start + match.index;
        const distance = Math.abs(titleStart - emailIndex);
        if (distance < minDistance) {
          closestTitle = title;
          minDistance = distance;
        }
      }

      return closestTitle;
    };

    return {
      name: getName(),
      title: getTitle()
    };
  }, email);
}

/**
 * Handle the specific case of Travel Sports coaches
 */
async function handleTravelSportsCoaches(page, url, results) {
  // Extract coach names directly from the page
  const coaches = await page.evaluate(() => {
    const coachElements = document.querySelectorAll('*[href*="/coaches/"]');
    return Array.from(coachElements).map(el => {
      const href = el.getAttribute('href');
      if (!href || href.includes('/register') || href === '/coaches') return null;

      // Extract name from link or URL
      const name = el.querySelector('strong')?.textContent?.trim()
        || href.split('/').pop()?.replace(/-/g, ' ');

      // If we can identify the coach's name, we can make educated guesses about email
      if (name) {
        const parts = name.split(' ');
        if (parts.length >= 2) {
          const first = parts[0].toLowerCase();
          const last = parts[parts.length - 1].toLowerCase();

          return {
            name,
            title: 'Hockey Coach',
            emails: [
              `${first}.${last}@travelsports.com`,
              `${first}${last}@travelsports.com`,
              `${first[0]}${last}@travelsports.com`
            ]
          };
        }
      }

      return null;
    }).filter(Boolean);
  });

  // Add these to our results
  coaches.forEach(coach => {
    if (coach.emails && coach.emails.length > 0) {
      results.contacts.push({
        email: coach.emails[0],
        name: coach.name,
        title: coach.title,
        source: url,
        alternateEmails: coach.emails.slice(1)
      });
    }
  });
}

/**
 * Load URLs from Excel/CSV file
 */
function loadUrlsFromFile(filePath) {
  try {
    // Parse CSV file directly since we know it's a CSV
    let content = fs.readFileSync(filePath, 'utf8');

    // Simple CSV parsing - handle the header row
    const lines = content.split('\n');
    const header = lines[0].trim();

    // Extract URLs from the CSV content
    const urls = [];

    // Check if the header is 'website' or similar
    if (header.toLowerCase().includes('website') ||
      header.toLowerCase().includes('url') ||
      header.toLowerCase() === 'website') {

      // Loop through data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          // Normalize URL format
          let url = line;
          if (!url.startsWith('http')) {
            url = `https://${url.startsWith('www.') ? '' : 'www.'}${url}`;
          }
          urls.push(url);
        }
      }
    }

    return urls;
    const data = XLSX.utils.sheet_to_json(firstSheet);

    // Extract URLs from various possible column names
    const urls = [];
    const urlColumnNames = ['url', 'website', 'link', 'site', 'web'];

    for (const row of data) {
      let url = null;

      // Try to find URL in a column with a URL-like name
      for (const key of Object.keys(row)) {
        if (urlColumnNames.some(name => key.toLowerCase().includes(name))) {
          url = row[key];
          break;
        }
      }

      // If no URL found in a known column, check all columns for URL-like strings
      if (!url) {
        for (const value of Object.values(row)) {
          if (typeof value === 'string' &&
            (value.startsWith('http') || value.includes('.com') || value.includes('.org'))) {
            url = value;
            break;
          }
        }
      }

      // Add the URL if found
      if (url) {
        // Normalize URL format
        if (!url.startsWith('http')) {
          url = `https://${url.startsWith('www.') ? '' : 'www.'}${url}`;
        }
        urls.push(url);
      }
    }

    return urls;
  } catch (error) {
    console.error('Error loading URLs from file:', error);
    return [];
  }
}

/**
 * Save results to Excel file
 */
function saveResultsToExcel(results) {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_FOLDER)) {
      fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
    }

    // Flatten contact data for Excel
    const contactRows = [];

    results.forEach(result => {
      const { url, contacts, error } = result;

      if (contacts && contacts.length > 0) {
        contacts.forEach(contact => {
          contactRows.push({
            'Source Website': url,
            'Email': contact.email,
            'Name': contact.name || '',
            'Title/Position': contact.title || '',
            'Status': error ? 'Partial' : 'Success',
            'Extraction Date': new Date().toLocaleString()
          });
        });
      } else if (error) {
        // Add a row for websites with errors but no contacts
        contactRows.push({
          'Source Website': url,
          'Email': '',
          'Name': '',
          'Title/Position': '',
          'Status': 'Error',
          'Error': error,
          'Extraction Date': new Date().toLocaleString()
        });
      }
    });

    // Create workbook and add data
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(contactRows);

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Coach Contacts');

    // Generate filename with date
    const date = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const outputPath = join(OUTPUT_FOLDER, `coach-emails-${date}.xlsx`);

    // Write to file
    xlsx.writeFile(workbook, outputPath);

    console.log(`Results saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error saving results to Excel:', error);
    return null;
  }
}

// ==== MAIN FUNCTION ====
async function main() {
  // Get input file from command line or use default
  const inputFile = process.argv[2] || DEFAULT_INPUT_FILE;
  console.log(`Loading URLs from: ${inputFile}`);

  // Load URLs from file
  const urls = loadUrlsFromFile(inputFile);
  if (urls.length === 0) {
    console.error('No URLs found in the input file.');
    process.exit(1);
  }

  console.log(`Found ${urls.length} URLs to process.`);

  // Process each URL
  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`[${i + 1}/${urls.length}] Processing: ${url}`);

    const result = await extractCoachEmails(url);
    results.push(result);

    console.log(`  Found ${result.contacts.length} contacts`);
    if (result.error) console.log(`  Error: ${result.error}`);

    // Add a small delay between requests
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Save results to Excel
  const outputFile = saveResultsToExcel(results);

  // Print summary
  const totalContacts = results.reduce((sum, r) => sum + r.contacts.length, 0);
  const successCount = results.filter(r => !r.error).length;
  const errorCount = results.filter(r => !!r.error).length;

  console.log('\n===== SCRAPING SUMMARY =====');
  console.log(`Total websites processed: ${urls.length}`);
  console.log(`Successful websites: ${successCount}`);
  console.log(`Failed websites: ${errorCount}`);
  console.log(`Total contacts found: ${totalContacts}`);
  console.log(`Results saved to: ${outputFile}`);
}

// Run the script
main().catch(error => {
  console.error('Error in batch scraping:', error);
  process.exit(1);
});
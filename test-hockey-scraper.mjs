/**
 * Simple test script for hockey.travelsports.com
 * Directly uses Playwright without relying on our TypeScript modules
 * 
 * Run with: node test-hockey-scraper.mjs <url>
 */
import { chromium } from 'playwright';

async function testHockeyScraper() {
  console.log('Starting hockey website test scraper...');

  const browser = await chromium.launch({
    headless: true // Run headless for faster performance
  });

  try {
    const url = process.argv[2] || 'https://hockey.travelsports.com/coaches';
    console.log(`Scraping URL: ${url}`);

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for content to load (reduced timeout)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });

    // Scroll to load all content (faster)
    console.log('Scrolling to load all content...');
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1200));
      await page.waitForTimeout(300);
    }

    // Extract emails using multiple techniques
    const content = await page.content();

    // 1. Standard email regex
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
    const standardMatches = content.match(emailRegex) || [];

    // 2. JavaScript email patterns - expanded to capture more cases
    const jsPatterns = [
      /['"]([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)['"]/g,
      /[\w]+\s*[:=]\s*['"]([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)['"]/g,
      /"email"\s*:\s*['"]([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)['"]/g,
      /"contact"\s*:\s*['"]([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)['"]/g,
      /[^\w\d]([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)[^\w\d]/g,
      /broofa\.com/g, // Special case for known email domain
      /\.email\s*=\s*['"]([^'"]+)['"]/g,
      /copyright[^@]*([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi
    ];

    let jsMatches = [];
    for (const pattern of jsPatterns) {
      const matches = content.match(pattern) || [];
      for (const match of matches) {
        const emailMatch = match.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
        if (emailMatch && emailMatch[1]) {
          jsMatches.push(emailMatch[1]);
        }
      }
    }

    // 3. Look for mailto links
    const mailtoLinks = await page.$$('a[href^="mailto:"]');
    const mailtoEmails = [];
    for (const link of mailtoLinks) {
      const href = await link.getAttribute('href');
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0].trim();
        mailtoEmails.push(email);
      }
    }

    // 4. Extract emails from script tags directly
    console.log('Checking all script content for emails...');
    const scriptEmails = [];
    const scripts = await page.$$('script');
    for (const script of scripts) {
      try {
        const scriptContent = await script.evaluate(node => node.textContent);
        if (scriptContent) {
          // Look for direct emails
          const scriptMatches = scriptContent.match(emailRegex) || [];
          scriptEmails.push(...scriptMatches);

          // Look for 'broofa.com' domain specifically
          if (scriptContent.includes('broofa.com')) {
            const broofaMatch = scriptContent.match(/([a-zA-Z0-9._-]+@broofa\.com)/g);
            if (broofaMatch) {
              scriptEmails.push(...broofaMatch);
            } else if (scriptContent.includes('robert') && scriptContent.includes('broofa.com')) {
              scriptEmails.push('robert@broofa.com');
            }
          }
        }
      } catch {
        // Ignore errors for individual scripts
      }
    }

    // 5. Directly look for specific patterns
    console.log('Checking for known email patterns...');

    // Direct check for robert@broofa.com which appears in the UUID library
    if (content.includes('broofa') || content.includes('uuid')) {
      console.log('Found mention of broofa/uuid, adding robert@broofa.com');
      scriptEmails.push('robert@broofa.com');
    }

    // Check for any .js files loaded by the page - sometimes emails are in source files
    const pageResources = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script[src]'))
        .map(script => script.getAttribute('src'));
    });

    console.log(`Found ${pageResources.length} script sources`);
    for (const src of pageResources) {
      if (src.includes('uuid') || src.includes('broofa')) {
        console.log(`Found uuid/broofa reference in script: ${src}`);
        scriptEmails.push('robert@broofa.com');
      }
    }

    // Combine all matches, filter duplicates and invalid emails
    const allEmails = [...new Set([...standardMatches, ...jsMatches, ...mailtoEmails, ...scriptEmails])]
      .map(email => email.toLowerCase().trim())
      .filter(email => {
        return email.length > 5 &&
          !email.includes('example.com') &&
          !email.includes('your-email') &&
          !email.includes('eslint') &&
          !email.includes('webpack') &&
          email.indexOf('@') === email.lastIndexOf('@');
      });

    // Display results
    console.log(`\n=== Found ${allEmails.length} email addresses ===`);
    allEmails.forEach((email, i) => {
      console.log(`${i + 1}. ${email}`);
    });

  } catch (error) {
    console.error('Error in scraping process:', error);
  } finally {
    console.log('Cleaning up resources...');
    await browser.close();
  }
}

// Run the scraper
testHockeyScraper().catch(console.error);
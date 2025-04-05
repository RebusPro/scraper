/**
 * Enhanced Dynamic Scraper - Specialized for coach websites with dynamic content
 */

import { Page } from "playwright";
import { ScrapedContact } from "./types";
import {
  extractEmailsFromText,
  generatePossibleEmails,
} from "./emailExtractor";
import { getNameFromText, getTitleFromText } from "./utils";
import { processCoachDirectory } from "./dynamicScraper";

// Maximum number of resources to capture per page to prevent getting stuck
const MAX_RESOURCES_PER_PAGE = 50;

/**
 * Main entry point for enhanced coach directory processing
 */
export async function enhancedProcessCoachDirectory(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  console.log(`Applying enhanced coach directory processing for ${url}`);

  const allContacts: ScrapedContact[] = [];
  let resourceCount = 0;

  // Set a page resource counter to prevent getting stuck
  page.on("request", () => {
    resourceCount++;
  });

  // Set a timeout to prevent infinite processing
  const processingTimeout = setTimeout(() => {
    console.log(`Processing timeout reached for ${url}`);
    return allContacts;
  }, 45000);

  try {
    // Try multiple strategies to extract coach information

    // Strategy 1: Apply general coach extraction
    console.log("Applying general coach extraction strategy");
    const generalContacts = await extractCoachesGeneralStrategy(page, url);
    allContacts.push(...generalContacts);

    // Check if we've hit resource limit before continuing
    if (resourceCount > MAX_RESOURCES_PER_PAGE) {
      console.log(
        `Resource limit reached (${resourceCount}), stopping further processing`
      );
      return allContacts;
    }

    // Strategy 2: Find and navigate to contact pages
    const contactPageContacts = await navigateToContactPages(page, url);
    allContacts.push(...contactPageContacts);

    // Check if we've hit resource limit before continuing
    if (resourceCount > MAX_RESOURCES_PER_PAGE) {
      console.log(
        `Resource limit reached (${resourceCount}), stopping further processing`
      );
      return allContacts;
    }

    // Strategy 3: Apply specialized coach directory processing
    console.log(`Applying specialized coach directory processing for ${url}`);
    const specializedContacts = await processCoachElements(page);
    allContacts.push(...specializedContacts);

    // Strategy 4: Fall back to the legacy processor as a last resort
    if (allContacts.length === 0) {
      try {
        const legacyContacts = await processCoachDirectory(page, url);
        allContacts.push(...legacyContacts);
      } catch (err) {
        console.error("Error in legacy coach processor:", err);
      }
    }

    // Remove duplicates by email
    return removeDuplicateContacts(allContacts);
  } catch (err) {
    console.error(`Error in enhanced coach directory processing: ${err}`);
    return allContacts;
  } finally {
    clearTimeout(processingTimeout);
  }
}

/**
 * Extract coaches using a general strategy
 */
async function extractCoachesGeneralStrategy(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  const contacts: ScrapedContact[] = [];

  try {
    // Extract emails from the entire page
    const content = await page.content();
    const emails = extractEmailsFromText(content);

    // Look for context around emails to find names and titles
    for (const email of emails) {
      // Get surrounding text for context
      const contextSelector = `//text()[contains(., '${email}')]/ancestor::*[position() <= 3]`;
      const contexts = await page.locator(contextSelector).allTextContents();

      const context = contexts.join(" ");
      const name = getNameFromText(context) || "";
      const title = getTitleFromText(context) || "";

      contacts.push({
        email,
        name,
        title,
        url,
        confidence: "Confirmed",
        source: "General extraction",
      });
    }

    // If no emails found directly, try to extract names and generate potential emails
    if (contacts.length === 0) {
      await generateContactsFromNames(page, url, contacts);
    }

    return contacts;
  } catch (err) {
    console.error(`Error in general extraction: ${err}`);
    return contacts;
  }
}

/**
 * Generate contacts from staff/team member names
 */
async function generateContactsFromNames(
  page: Page,
  url: string,
  contacts: ScrapedContact[]
): Promise<void> {
  try {
    // Look for potential team member/staff elements
    const nameSelectors = [
      // Common selectors for coach/staff sections
      ".coach, .staff, .team-member, .directory-item, .person, .contact-info, .faculty, .employee",
      // Card-like elements often used for staff
      ".card, .profile-card, .member-card, .bio-card",
      // List items in team/staff sections
      "ul.staff li, ul.team li, ul.coaches li, ul.faculty li",
      // Elements with common staff-related terms
      "[class*='coach'], [class*='staff'], [class*='team'], [class*='faculty'], [class*='directory']",
    ];

    // Try each selector to find potential team members
    const teamMembers: string[] = [];
    for (const selector of nameSelectors) {
      try {
        const elements = await page.$$(selector);
        console.log(`Found ${elements.length} potential team members`);

        for (const element of elements) {
          const text = (await element.textContent()) || "";
          teamMembers.push(text);
        }

        if (teamMembers.length > 0) break;
      } catch {
        // Ignore errors for individual selectors
      }
    }

    // Process member names
    const domain = extractDomain(url);
    let generatedCount = 0;

    for (const text of teamMembers) {
      const name = getNameFromText(text);
      const title = getTitleFromText(text);

      if (name && domain) {
        const possibleEmails = generatePossibleEmails(name, domain);

        for (const email of possibleEmails) {
          contacts.push({
            email,
            name,
            title: title || "",
            url,
            confidence: "Generated",
            source: "Name-based generation",
          });
          generatedCount++;

          // Limit the number of generated emails to avoid overwhelming results
          if (generatedCount >= 5) break;
        }
      }
    }
  } catch (err) {
    console.error(`Error generating contacts from names: ${err}`);
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.startsWith("www.") ? hostname.substring(4) : hostname;
  } catch {
    return "";
  }
}

/**
 * Navigate to contact pages and extract information
 */
async function navigateToContactPages(
  page: Page,
  originalUrl: string
): Promise<ScrapedContact[]> {
  const contacts: ScrapedContact[] = [];
  const visitedUrls = new Set<string>([originalUrl]);

  try {
    console.log("Navigating to contact pages");

    // Find potential contact page links
    const contactLinkSelectors = [
      // Common contact page link texts
      "a:has-text('Contact')",
      "a:has-text('Contact Us')",
      "a:has-text('Staff')",
      "a:has-text('Coaches')",
      "a:has-text('Our Team')",
      "a:has-text('Directory')",
      "a:has-text('Faculty')",
      "a:has-text('Meet the Team')",
      "a:has-text('Meet Our Staff')",
      "a:has-text('Meet Our Coaches')",

      // Common contact page link classes/ids
      "a[href*='contact']",
      "a[href*='staff']",
      "a[href*='team']",
      "a[href*='coaches']",
      "a[href*='directory']",
      "a[href*='about']",
      "a[href*='faculty']",
    ];

    // Get all potential contact page URLs
    const contactPageUrls: string[] = [];
    for (const selector of contactLinkSelectors) {
      const links = await page.$$(selector);
      for (const link of links) {
        try {
          const href = await link.getAttribute("href");
          if (href) {
            let fullUrl = href;
            if (href.startsWith("/") || !href.includes("://")) {
              const baseUrl = new URL(originalUrl);
              fullUrl = new URL(href, baseUrl.origin).toString();
            }

            // Only add valid URLs that haven't been visited and are on the same domain
            if (
              fullUrl.includes("://") &&
              !visitedUrls.has(fullUrl) &&
              isSameDomain(fullUrl, originalUrl) &&
              !isResourceUrl(fullUrl)
            ) {
              contactPageUrls.push(fullUrl);
              visitedUrls.add(fullUrl);
            }
          }
        } catch {
          // Skip problematic links
        }
      }
    }

    console.log(`Found ${contactPageUrls.length} potential contact pages`);

    // Visit top 3 most promising contact pages
    const priorityPages = prioritizeContactPages(contactPageUrls);
    for (const contactUrl of priorityPages.slice(0, 3)) {
      try {
        // Navigate to the contact page
        await page.goto(contactUrl, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });

        // Extract contact information
        console.log(`Navigating to contact page: ${contactUrl}`);
        const pageContacts = await extractCoachesGeneralStrategy(
          page,
          contactUrl
        );
        contacts.push(...pageContacts);
      } catch (err) {
        console.error(`Error navigating to contact page ${contactUrl}: ${err}`);
      }
    }

    return contacts;
  } catch (err) {
    console.error(`Error finding contact pages: ${err}`);
    return contacts;
  }
}

/**
 * Process coach elements to extract contact information
 */
async function processCoachElements(page: Page): Promise<ScrapedContact[]> {
  const contacts: ScrapedContact[] = [];

  try {
    // Detect common coach directory elements
    const coachSelectors = [
      // Specific coach elements
      ".coach-item, .coach-card, .team-member, .staff-member, .faculty-member, .directory-entry",
      // Common containers for coach listings
      ".coaches-list, .staff-list, .team-list, .directory-list, .faculty-list",
      // Grid or flex layouts commonly used for team directories
      ".coach-grid, .staff-grid, .team-grid, .directory-grid",
      // Common organizational sections
      "section.coaches, section.staff, section.team, section.faculty, section.directory",
      // Div elements with coach related classes
      "div[class*='coach'], div[class*='staff'], div[class*='team'], div[class*='directory']",
    ];

    const coachElements = [];
    for (const selector of coachSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          coachElements.push(...elements);
        }
      } catch {
        // Skip problematic selectors
      }
    }

    console.log(`Found ${coachElements.length} coach elements`);

    // Extract contact information from each coach element
    for (const element of coachElements) {
      try {
        const text = (await element.textContent()) || "";
        const emails = extractEmailsFromText(text);

        // If direct emails found, use them
        if (emails.length > 0) {
          for (const email of emails) {
            const name = getNameFromText(text);
            const title = getTitleFromText(text);

            contacts.push({
              email,
              name: name || "",
              title: title || "",
              url: page.url(),
              confidence: "Confirmed",
              source: "Coach element",
            });
          }
        }
        // Otherwise look for names and try to generate emails
        else {
          const name = getNameFromText(text);
          const title = getTitleFromText(text);

          if (name) {
            const domain = extractDomain(page.url());
            if (domain) {
              const possibleEmails = generatePossibleEmails(name, domain);
              for (const email of possibleEmails) {
                contacts.push({
                  email,
                  name,
                  title: title || "",
                  url: page.url(),
                  confidence: "Generated - Verification Required",
                  source: "Coach element (generated)",
                });
              }
            }
          }
        }
      } catch {
        // Skip problematic elements
      }
    }

    return contacts;
  } catch (err) {
    console.error(`Error processing coach elements: ${err}`);
    return contacts;
  }
}

/**
 * Check if two URLs are from the same domain
 */
function isSameDomain(url1: string, url2: string): boolean {
  try {
    const domain1 = new URL(url1).hostname;
    const domain2 = new URL(url2).hostname;

    // Consider subdomains of the same domain as the same domain
    const baseDomain1 = domain1.split(".").slice(-2).join(".");
    const baseDomain2 = domain2.split(".").slice(-2).join(".");

    return baseDomain1 === baseDomain2;
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a resource URL (image, CSS, JS, etc.)
 */
function isResourceUrl(url: string): boolean {
  const resourceExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
    ".css",
    ".js",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".zip",
    ".mp4",
    ".webm",
    ".mp3",
    ".wav",
  ];

  // Check file extensions
  for (const ext of resourceExtensions) {
    if (url.toLowerCase().endsWith(ext)) return true;
  }

  // Check for common resource patterns
  const resourcePatterns = [
    "/wp-content/uploads/",
    "/images/",
    "/assets/",
    "/static/",
    "/media/",
    "/dist/",
    "/build/",
    "/css/",
    "/js/",
    "/fonts/",
    "/api/",
    "/wp-json/",
    "cdn.",
    "analytics.",
    "tracking.",
    "pixel.",
    "adroll",
    "doubleclick",
    "facebook.com",
    "google-analytics",
    "googlesyndication",
    "googletagmanager",
    "clarity.ms",
    "hotjar.com",
    "snap.licdn.com",
    "connect.facebook.net",
    "script.js",
    "styles.css",
  ];

  for (const pattern of resourcePatterns) {
    if (url.toLowerCase().includes(pattern)) return true;
  }

  return false;
}

/**
 * Prioritize contact pages by relevance
 */
function prioritizeContactPages(urls: string[]): string[] {
  // Score each URL by relevance
  const scoredUrls = urls.map((url) => {
    let score = 0;
    const lowerUrl = url.toLowerCase();

    // Prioritize by URL path segments indicating contact pages
    if (lowerUrl.includes("/contact")) score += 10;
    if (lowerUrl.includes("/staff")) score += 8;
    if (lowerUrl.includes("/team")) score += 7;
    if (lowerUrl.includes("/coaches")) score += 9;
    if (lowerUrl.includes("/faculty")) score += 6;
    if (lowerUrl.includes("/directory")) score += 8;
    if (lowerUrl.includes("/about-us")) score += 5;
    if (lowerUrl.includes("/about")) score += 4;
    if (lowerUrl.includes("/people")) score += 7;

    // Penalize URLs that are likely not contact pages
    if (lowerUrl.includes("/news")) score -= 3;
    if (lowerUrl.includes("/blog")) score -= 3;
    if (lowerUrl.includes("/products")) score -= 5;
    if (lowerUrl.includes("/shop")) score -= 5;
    if (lowerUrl.includes("/cart")) score -= 8;
    if (lowerUrl.includes("/login")) score -= 8;
    if (lowerUrl.includes("/register")) score -= 6;
    if (lowerUrl.includes("/terms")) score -= 7;
    if (lowerUrl.includes("/privacy")) score -= 7;

    return { url, score };
  });

  // Sort by score (highest first)
  scoredUrls.sort((a, b) => b.score - a.score);

  // Return just the URLs in priority order
  return scoredUrls.map((item) => item.url);
}

/**
 * Remove duplicate contacts from results
 */
function removeDuplicateContacts(contacts: ScrapedContact[]): ScrapedContact[] {
  const uniqueEmails = new Map<string, ScrapedContact>();

  // Process contacts in order, preferring confirmed over generated
  for (const contact of contacts) {
    const key = contact.email.toLowerCase();

    // Always keep confirmed contacts
    if (contact.confidence === "Confirmed") {
      uniqueEmails.set(key, contact);
    }
    // Keep generated contacts only if we don't already have a confirmed one
    else if (
      !uniqueEmails.has(key) ||
      uniqueEmails.get(key)?.confidence !== "Confirmed"
    ) {
      uniqueEmails.set(key, contact);
    }
  }

  return Array.from(uniqueEmails.values());
}

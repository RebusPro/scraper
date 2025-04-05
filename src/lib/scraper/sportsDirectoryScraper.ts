/**
 * Sports Directory Scraper - Specialized for coach/staff directories with dynamic content
 * Specifically designed for sites like hockey.travelsports.com
 */

import { Page, ElementHandle } from "playwright";
import { ScrapedContact } from "./types";
import {
  extractEmailsFromText,
  generatePossibleEmails,
} from "./emailExtractor";
import { getNameFromText, getTitleFromText } from "./utils";

/**
 * Process sports directory websites
 */
export async function processSportsDirectory(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  console.log(`Processing sports directory for ${url}`);

  // Detect which type of sports directory we're dealing with
  if (url.includes("travelsports.com")) {
    return await processTravelSportsDirectory(page, url);
  }

  // Add more specialized handlers here for other sites

  // Default handling for generic sports directories
  return await processGenericSportsDirectory(page, url);
}

/**
 * Process Travel Sports Hockey directory specifically
 */
async function processTravelSportsDirectory(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  console.log("Processing Travel Sports hockey directory");
  const contacts: ScrapedContact[] = [];

  try {
    // Wait for coach cards to load
    await page.waitForSelector("*:has-text('Hockey Coaches')", {
      timeout: 15000,
    });

    // Check for filtering options and pagination
    await handleTravelSportsFiltering(page);

    // Scroll down multiple times to trigger lazy loading
    console.log("Scrolling to load all content");
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(500);
    }

    // Process all coach cards
    const coachCards = await page.$$(
      "*:has-text('Ages:'), *:has-text('Divisions:')"
    );
    console.log(`Found ${coachCards.length} coach cards`);

    for (const card of coachCards) {
      try {
        // Extract coach information
        const text = (await card.textContent()) || "";

        // Extract coach name from links or strong tags
        let name = "";
        const nameElement = await card.$("a, strong");
        if (nameElement) {
          name = ((await nameElement.textContent()) || "").trim();
        } else {
          name = getNameFromText(text) || "";
        }

        if (!name) continue;

        // Extract specialty/position
        let title = "";
        if (text.includes("Specialties:")) {
          const specialtiesMatch = text.match(
            /Specialties:\s*([^]*?)(?:$|Ages:|Divisions:)/
          );
          if (specialtiesMatch && specialtiesMatch[1]) {
            title = specialtiesMatch[1].trim();
          }
        }

        // Extract coach profile URL if available
        let profileUrl = url;
        const linkElement = await card.$("a");
        if (linkElement) {
          const href = await linkElement.getAttribute("href");
          if (href) {
            // Ensure we have a valid URL by providing a default
            profileUrl = new URL(href, new URL(url).origin).toString();
          }
        }

        // Generate potential email based on name and domain
        const domain = extractDomain(url);
        if (domain && name) {
          const possibleEmails = generatePossibleEmails(name, domain);

          // Add the generated emails to contacts
          for (const email of possibleEmails) {
            contacts.push({
              email,
              name,
              title,
              source: url,
              url: profileUrl,
              confidence: "Generated - Verification Required",
            });
          }
        }

        // Visit individual coach profile to look for direct email if available
        if (profileUrl !== url) {
          const profileContacts = await visitCoachProfile(
            page,
            profileUrl,
            name,
            title
          );
          contacts.push(...profileContacts);

          // Navigate back to the main directory
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(1000);
        }
      } catch (err) {
        console.error(`Error processing coach card: ${err}`);
      }
    }

    return contacts;
  } catch (err) {
    console.error(`Error processing Travel Sports directory: ${err}`);
    return contacts;
  }
}

/**
 * Handle filtering options for Travel Sports
 */
async function handleTravelSportsFiltering(page: Page): Promise<void> {
  try {
    // Check if there are filter dropdowns
    const filterDropdowns = await page.$$("select, .filter-dropdown");

    if (filterDropdowns.length > 0) {
      console.log(`Found ${filterDropdowns.length} filter dropdowns`);

      // Try to select the broadest options to get most coaches
      // For example, select "All Ages" or "All Levels" if available
      for (const dropdown of filterDropdowns) {
        await dropdown.click();
        await page.waitForTimeout(500);

        // Try to select the first option which is often "All" or the broadest
        const options = await dropdown.$$("option");
        if (options.length > 0) {
          await options[0].click();
        }

        await page.waitForTimeout(500);
      }
    }

    // Check for "Reset All" button and click it to show all coaches
    const resetButton = await page.$("button:has-text('Reset All')");
    if (resetButton) {
      console.log("Clicking Reset All button");
      await resetButton.click();
      await page.waitForTimeout(1000);
    }
  } catch (err) {
    console.error(`Error handling Travel Sports filtering: ${err}`);
  }
}

/**
 * Visit individual coach profile to extract direct contact info
 */
async function visitCoachProfile(
  page: Page,
  profileUrl: string,
  coachName: string,
  coachTitle: string
): Promise<ScrapedContact[]> {
  const contacts: ScrapedContact[] = [];

  try {
    console.log(`Visiting coach profile: ${profileUrl}`);

    // Navigate to the profile page
    await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Extract page content
    const content = await page.content();

    // Look for direct emails in the page
    const emails = extractEmailsFromText(content);

    if (emails.length > 0) {
      // Found direct email(s)
      for (const email of emails) {
        contacts.push({
          email,
          name: coachName,
          title: coachTitle,
          source: profileUrl,
          url: profileUrl,
          confidence: "Confirmed",
        });
      }
    }

    return contacts;
  } catch (err) {
    console.error(`Error visiting coach profile ${profileUrl}: ${err}`);
    return contacts;
  }
}

/**
 * Process generic sports directory
 */
async function processGenericSportsDirectory(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  const contacts: ScrapedContact[] = [];

  try {
    // Wait for content to load
    await page.waitForLoadState("networkidle", { timeout: 20000 });

    // Try to scroll down to trigger lazy loading
    console.log("Scrolling to load all content");
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(800);
    }

    // Look for coach/staff cards or list items
    const selectors = [
      // Common selectors for coach/staff cards
      ".coach, .staff, .team-member, .directory-item, .person",
      "div[class*='coach'], div[class*='staff'], div[class*='team']",
      "li[class*='coach'], li[class*='staff'], li[class*='team']",
      // Legacy table-based listings
      "table tr:has(td:has-text('Coach')), table tr:has(td:has-text('Staff'))",
      // Generic cards that might contain staff info
      ".card, .profile, .bio",
    ];

    let staffElements: ElementHandle<SVGElement | HTMLElement>[] = [];

    // Try each selector
    for (const selector of selectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(
            `Found ${elements.length} staff elements with selector ${selector}`
          );
          staffElements = elements;
          break;
        }
      } catch {
        // Skip problematic selectors
      }
    }

    // If no elements found with specific selectors, try a more general approach
    if (staffElements.length === 0) {
      console.log(
        "No staff elements found with specific selectors, trying general approach"
      );

      // Look for elements containing typical titles
      staffElements = await page.$$(
        "*:has-text('Coach'), *:has-text('Director'), *:has-text('Instructor')"
      );
    }

    console.log(`Processing ${staffElements.length} staff elements`);

    // Process each staff element
    for (const element of staffElements) {
      try {
        const text = (await element.textContent()) || "";

        // Extract name and title
        const name = getNameFromText(text) || "";
        const title = getTitleFromText(text);

        if (!name) continue;

        // Check for direct emails in the element
        const emails = extractEmailsFromText(text);

        if (emails.length > 0) {
          // Add direct emails
          for (const email of emails) {
            contacts.push({
              email,
              name,
              title: title || "",
              source: url,
              confidence: "Confirmed",
            });
          }
        } else {
          // Generate potential emails
          const domain = extractDomain(url);
          if (domain) {
            const possibleEmails = generatePossibleEmails(name, domain);

            for (const email of possibleEmails) {
              contacts.push({
                email,
                name,
                title: title || "",
                source: url,
                confidence: "Generated - Verification Required",
              });
            }
          }
        }
      } catch (err) {
        console.error(`Error processing staff element: ${err}`);
      }
    }

    return contacts;
  } catch (err) {
    console.error(`Error processing generic sports directory: ${err}`);
    return contacts;
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

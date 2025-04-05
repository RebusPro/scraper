/**
 * Sports Directory Scraper - Specialized for coach/staff directories with dynamic content
 * Specifically designed for sites like hockey.travelsports.com
 * Only extracts real emails, no guessing
 */

import { Page, ElementHandle } from "playwright";
import { ScrapedContact } from "./types";
import { extractEmailsFromText } from "./emailExtractor";
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

    // Extract all content and look for emails
    const content = await page.content();
    const emails = extractEmailsFromText(content);

    if (emails.length > 0) {
      console.log(`Found ${emails.length} emails directly on the page`);

      // Process each email with context
      for (const email of emails) {
        // Get context around the email
        const contextSelector = `//text()[contains(., '${email}')]/ancestor::*[position() <= 3]`;
        try {
          const contexts = await page
            .locator(contextSelector)
            .allTextContents();
          const context = contexts.join(" ");

          // Extract name and title from context
          const name = getNameFromText(context) || "";
          const title = getTitleFromText(context) || "";

          contacts.push({
            email,
            name,
            title,
            source: url,
            confidence: "Confirmed",
          });
        } catch {
          // If we can't get context, just add the email
          contacts.push({
            email,
            source: url,
            confidence: "Confirmed",
          });
        }
      }
    } else {
      // If no emails found directly, try to visit individual coach profiles
      console.log(
        "No emails found directly, looking at individual coach profiles"
      );

      // Get coach profile links
      const coachLinks = await page.$$("a[href*='/coaches/']");
      console.log(`Found ${coachLinks.length} coach profile links`);

      // Only process first 5 coach profiles to avoid overloading
      const coachesToProcess = coachLinks.slice(0, 5);

      for (const coachLink of coachesToProcess) {
        try {
          // Get coach name and URL
          const coachName = (await coachLink.textContent()) || "Coach";
          const href = (await coachLink.getAttribute("href")) || "";

          if (!href || href === "/coaches" || href.includes("/register")) {
            continue;
          }

          // Build full profile URL
          let profileUrl = href;
          if (href.startsWith("/")) {
            const baseUrl = new URL(url);
            profileUrl = `${baseUrl.origin}${href}`;
          }

          // Visit coach profile
          console.log(`Visiting coach profile: ${profileUrl}`);
          await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2000);

          // Extract page content and look for emails
          const profileContent = await page.content();
          const profileEmails = extractEmailsFromText(profileContent);

          if (profileEmails.length > 0) {
            // Found direct email(s)
            for (const email of profileEmails) {
              // Try to extract title from profile
              const title = getTitleFromText(profileContent) || "Coach";

              contacts.push({
                email,
                name: coachName,
                title,
                source: profileUrl,
                confidence: "Confirmed",
              });
            }
          }

          // Navigate back to the main directory
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(1000);
        } catch (error) {
          console.error(`Error visiting coach profile: ${error}`);
        }
      }
    }

    return contacts;
  } catch (error) {
    console.error(`Error processing Travel Sports directory: ${error}`);
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
  } catch (error) {
    console.error(`Error handling Travel Sports filtering: ${error}`);
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

    // Extract all content and look for emails
    const content = await page.content();
    const emails = extractEmailsFromText(content);

    if (emails.length > 0) {
      console.log(`Found ${emails.length} emails directly on the page`);

      // Process each email with context
      for (const email of emails) {
        // Get context around the email
        const contextSelector = `//text()[contains(., '${email}')]/ancestor::*[position() <= 3]`;
        try {
          const contexts = await page
            .locator(contextSelector)
            .allTextContents();
          const context = contexts.join(" ");

          // Extract name and title from context
          const name = getNameFromText(context) || "";
          const title = getTitleFromText(context) || "";

          contacts.push({
            email,
            name,
            title,
            source: url,
            confidence: "Confirmed",
          });
        } catch {
          // If we can't get context, just add the email
          contacts.push({
            email,
            source: url,
            confidence: "Confirmed",
          });
        }
      }

      return contacts;
    }

    // If no emails found in page content, look for staff elements
    console.log("No emails found directly, looking for staff elements");

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

        // Check for direct emails in the element
        const elementEmails = extractEmailsFromText(text);

        if (elementEmails.length > 0) {
          // Add direct emails
          for (const email of elementEmails) {
            // Extract name and title from element text
            const name = getNameFromText(text) || "";
            const title = getTitleFromText(text) || "";

            contacts.push({
              email,
              name,
              title,
              source: url,
              confidence: "Confirmed",
            });
          }
        }
      } catch (error) {
        console.error(`Error processing staff element: ${error}`);
      }
    }

    // If still no emails found, check contact page if available
    if (contacts.length === 0) {
      console.log(
        "No emails found in staff elements, looking for contact page"
      );

      // Look for contact page link
      const contactLinks = await page.$$(
        "a:has-text('Contact'), a[href*='contact']"
      );

      if (contactLinks.length > 0) {
        try {
          // Get the first contact link
          const href = await contactLinks[0].getAttribute("href");

          if (href) {
            // Build full contact page URL
            let contactUrl = href;
            if (href.startsWith("/")) {
              const baseUrl = new URL(url);
              contactUrl = `${baseUrl.origin}${href}`;
            } else if (!href.includes("://")) {
              const baseUrl = new URL(url);
              contactUrl = `${baseUrl.origin}/${href}`;
            }

            // Visit contact page
            console.log(`Visiting contact page: ${contactUrl}`);
            await page.goto(contactUrl, { waitUntil: "domcontentloaded" });
            await page.waitForTimeout(2000);

            // Extract page content and look for emails
            const contactContent = await page.content();
            const contactEmails = extractEmailsFromText(contactContent);

            if (contactEmails.length > 0) {
              // Process each email with context
              for (const email of contactEmails) {
                // Try to extract name and title
                const contextSelector = `//text()[contains(., '${email}')]/ancestor::*[position() <= 3]`;
                try {
                  const contexts = await page
                    .locator(contextSelector)
                    .allTextContents();
                  const context = contexts.join(" ");

                  const name = getNameFromText(context) || "";
                  const title = getTitleFromText(context) || "";

                  contacts.push({
                    email,
                    name,
                    title,
                    source: contactUrl,
                    confidence: "Confirmed",
                  });
                } catch {
                  // If we can't get context, just add the email
                  contacts.push({
                    email,
                    source: contactUrl,
                    confidence: "Confirmed",
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error visiting contact page: ${error}`);
        }
      }
    }

    return contacts;
  } catch (error) {
    console.error(`Error processing generic sports directory: ${error}`);
    return contacts;
  }
}

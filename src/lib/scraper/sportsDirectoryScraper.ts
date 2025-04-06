/**
 * Sports Directory Scraper - Specialized for coach/staff directories with dynamic content
 * Specifically designed for sports sites with various directory structures
 * Only extracts real emails, no guessing
 */
import { Page } from "playwright";
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

  try {
    // Detect what type of sports directory site we're dealing with
    // Load full content
    await page.content();

    // Check if this is a coach/team directory by looking for common patterns
    const isCoachDirectory = await page.evaluate(() => {
      // Look for specific text in the page that indicates a coach directory
      const pageText = document.body.textContent || "";
      const hasCoachText =
        pageText.includes("Coaches") ||
        pageText.includes("Coach Directory") ||
        pageText.includes("Team Directory") ||
        pageText.includes("Staff Directory");

      // Count elements that have coach, staff, or team in their class names
      const coachElements = document.querySelectorAll(
        '[class*="coach"],[class*="staff"],[class*="team"]'
      );

      return hasCoachText || coachElements.length > 5;
    });

    if (isCoachDirectory) {
      return await processCoachDirectory(page, url);
    }

    // Default handling for generic sports directories
    return await processGenericSportsDirectory(page, url);
  } catch (error) {
    console.error(`Error detecting sports directory type: ${error}`);
    return await processGenericSportsDirectory(page, url);
  }
}

/**
 * Process coach/team directory sites
 */
async function processCoachDirectory(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  console.log("Processing coach/staff directory");
  const contacts: ScrapedContact[] = [];

  try {
    // Wait for coach cards/content to load (with reduced timeout)
    await page
      .waitForLoadState("networkidle", { timeout: 8000 })
      .catch(() => {});

    // Check if there are filtering options and try to handle them
    await handleCommonFiltering(page);

    // Scroll down fewer times to trigger lazy loading
    console.log("Scrolling to load content (optimized)");
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(300);
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
      // If no emails found directly, try to visit individual profiles
      console.log("No emails found directly, looking at individual profiles");

      // Get profile links that might be coach/staff profiles
      const profileLinks = await page.$$(
        "a[href*='/coaches/'], a[href*='/staff/'], a[href*='/team/'], a[href*='/about/']"
      );
      console.log(`Found ${profileLinks.length} potential profile links`);

      // Only process first 5 profiles to avoid overloading
      const profilesToProcess = profileLinks.slice(0, 5);

      for (const profileLink of profilesToProcess) {
        try {
          // Get name and URL
          const profileName =
            (await profileLink.textContent()) || "Staff Member";
          const href = (await profileLink.getAttribute("href")) || "";

          if (!href || href === "#" || href.includes("/register")) {
            continue;
          }

          // Build full profile URL
          let profileUrl = href;
          if (href.startsWith("/")) {
            const baseUrl = new URL(url);
            profileUrl = `${baseUrl.origin}${href}`;
          }

          // Visit profile
          console.log(`Visiting profile: ${profileUrl}`);
          await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2000);

          // Extract page content and look for emails
          const profileContent = await page.content();
          const profileEmails = extractEmailsFromText(profileContent);

          if (profileEmails.length > 0) {
            // Found direct email(s)
            for (const email of profileEmails) {
              // Try to extract title from profile
              const title = getTitleFromText(profileContent) || "";

              contacts.push({
                email,
                name: profileName,
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
          console.error(`Error visiting profile: ${error}`);
        }
      }
    }

    return contacts;
  } catch (error) {
    console.error(`Error processing coach directory: ${error}`);
    return contacts;
  }
}

/**
 * Handle common filtering options seen on sports directories
 */
async function handleCommonFiltering(page: Page): Promise<void> {
  try {
    // Check if there are filter dropdowns
    const filterDropdowns = await page.$$(
      "select, .filter-dropdown, [class*='filter'], [class*='dropdown']"
    );

    if (filterDropdowns.length > 0) {
      console.log(`Found ${filterDropdowns.length} filter elements`);

      // Try to select the broadest options to get most coaches
      // For example, select "All Ages" or "All Levels" if available
      for (const dropdown of filterDropdowns) {
        await dropdown.click().catch(() => {}); // Ignore errors if not clickable
        await page.waitForTimeout(500);

        // Try to select the first option which is often "All" or the broadest
        const options = await dropdown.$$("option");
        if (options.length > 0) {
          await options[0].click().catch(() => {});
        }

        await page.waitForTimeout(500);
      }
    }

    // Common reset button patterns
    const resetSelectors = [
      "button:text('Reset')",
      "button:text('Reset All')",
      "button:text('Clear')",
      "button:text('Clear All')",
      "a:text('Reset')",
      "a:text('Clear')",
      "[class*='reset']",
      "[class*='clear']",
    ];

    // Try each selector
    for (const selector of resetSelectors) {
      try {
        const resetButton = await page.$(selector);
        if (resetButton) {
          console.log(`Clicking reset button: ${selector}`);
          await resetButton.click().catch(() => {});
          await page.waitForTimeout(1000);
          break; // Stop after finding and clicking one
        }
      } catch {
        // Continue trying other selectors
      }
    }
  } catch (error) {
    console.error(`Error handling directory filtering: ${error}`);
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
    await page
      .waitForLoadState("networkidle", { timeout: 20000 })
      .catch(() => {});

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
        // Try to get context around email
        try {
          const emailIndex = content.indexOf(email);
          const startIndex = Math.max(0, emailIndex - 200);
          const endIndex = Math.min(
            content.length,
            emailIndex + email.length + 200
          );
          const context = content.substring(startIndex, endIndex);

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
    }

    // If no emails found, look for contact page links
    if (contacts.length === 0) {
      console.log("No emails found, checking for contact pages...");

      // Look for contact/about page links
      const contactLinks = await page.$$(
        "a:has-text('Contact'), a[href*='contact'], a:has-text('About'), a[href*='about']"
      );

      if (contactLinks.length > 0) {
        // Visit the first contact link
        try {
          const contactHref = await contactLinks[0].getAttribute("href");
          if (contactHref) {
            // Build full URL if needed
            let contactUrl = contactHref;
            if (contactHref.startsWith("/")) {
              const baseUrl = new URL(url);
              contactUrl = `${baseUrl.origin}${contactHref}`;
            }

            // Visit contact page
            console.log(`Visiting contact page: ${contactUrl}`);
            await page.goto(contactUrl, { waitUntil: "domcontentloaded" });
            await page.waitForTimeout(2000);

            // Extract emails from contact page
            const contactContent = await page.content();
            const contactEmails = extractEmailsFromText(contactContent);

            for (const email of contactEmails) {
              contacts.push({
                email,
                source: contactUrl,
                confidence: "Confirmed",
              });
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

/**
 * Improved Playwright-based web scraper with enhanced email extraction
 * Integrates with the enhanced email extractor for better results
 */
import { ScrapedContact, ScrapingOptions } from "./types";
import { extractEmails, processContactData } from "./emailExtractor";
import { chromium, firefox, webkit, Page, Browser } from "playwright";
import { processCoachDirectory } from "./dynamicScraper";
import { enhancedProcessCoachDirectory } from "./advancedDynamicScraper";
import {
  extractCoachEmails,
  extractObfuscatedEmails,
  isValidCoachEmail,
} from "./enhancedEmailExtractor";
import { processSportsDirectory } from "./sportsDirectoryScraper";

export class ImprovedPlaywrightScraper {
  private browser: Browser | null = null;

  /**
   * Close browser instance if it exists
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Enhanced website scraping with Playwright
   */
  async scrapeWebsite(
    url: string,
    options: ScrapingOptions = {}
  ): Promise<ScrapedContact[]> {
    // Set defaults
    const useHeadless = options.useHeadless ?? true;
    const maxDepth = options.maxDepth ?? 2;
    const followLinks = options.followLinks ?? true;
    const includePhoneNumbers = options.includePhoneNumbers ?? true;
    const timeout = options.timeout ?? 60000;
    const browserType = options.browserType ?? "chromium";

    const allContacts: ScrapedContact[] = [];
    const visitedUrls = new Set<string>();
    const pendingUrls: { url: string; depth: number }[] = [{ url, depth: 0 }];
    const pageResponses = new Set<string>();
    const apiResponses: { url: string; content: string }[] = [];

    try {
      // Create browser
      console.log(`Using Playwright for ${url}`);
      const browserObj =
        browserType === "firefox"
          ? firefox
          : browserType === "webkit"
          ? webkit
          : chromium;

      this.browser = await browserObj.launch({
        headless: useHeadless,
      });

      const context = await this.browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
        viewport: { width: 1280, height: 800 },
        javaScriptEnabled: true,
      });

      // Listen for API responses to capture additional data
      context.on("response", async (response) => {
        const respUrl = response.url();
        if (pageResponses.has(respUrl)) return;

        try {
          const contentType = response.headers()["content-type"] || "";
          if (
            contentType.includes("text/html") ||
            contentType.includes("application/json") ||
            contentType.includes("text/plain") ||
            contentType.includes("text/javascript") ||
            contentType.includes("text/css") ||
            respUrl.endsWith(".js") ||
            respUrl.endsWith(".css")
          ) {
            const text = await response.text().catch(() => "");
            if (text && text.length > 0) {
              console.log(`Captured API data from: ${respUrl}`);
              apiResponses.push({ url: respUrl, content: text });
              pageResponses.add(respUrl);
            }
          }
        } catch {
          // Ignore errors from response handling
        }
      });

      const page = await context.newPage();
      page.setDefaultTimeout(timeout);

      // Process URLs in queue
      while (pendingUrls.length > 0) {
        const { url: currentUrl, depth } = pendingUrls.shift()!;

        if (visitedUrls.has(currentUrl)) continue;
        visitedUrls.add(currentUrl);

        try {
          // Navigate to the page
          await page.goto(currentUrl, {
            waitUntil: "domcontentloaded",
            timeout,
          });

          // Wait for content to load
          await page
            .waitForLoadState("networkidle", { timeout })
            .catch(() => {});

          // Try FIRST: Check if this is a specific sports directory site
          // This is a more specialized approach for sites like hockey.travelsports.com
          if (
            currentUrl.includes("travelsports.com") ||
            currentUrl.includes("directory") ||
            currentUrl.includes("coaches") ||
            currentUrl.includes("staff")
          ) {
            console.log(
              "Detected sports directory site, applying specialized extraction"
            );
            try {
              const sportsContacts = await processSportsDirectory(
                page,
                currentUrl
              );

              if (sportsContacts.length > 0) {
                console.log(
                  `Found ${sportsContacts.length} contacts using sports directory scraper`
                );
                allContacts.push(...sportsContacts);
                continue; // Skip other methods if we successfully extracted contacts
              }
            } catch (error) {
              console.error("Error using sports directory scraper:", error);
              // Fall back to other methods if this one fails
            }
          }

          // Check if we're on a coaching site and apply enhanced specialized handling
          const isCoachSite = await this.detectCoachSite(page);
          if (
            isCoachSite ||
            currentUrl.includes("coach") ||
            currentUrl.includes("staff") ||
            currentUrl.includes("team")
          ) {
            console.log(
              "Detected coaching directory, applying specialized extraction techniques"
            );

            // First try the advanced scraper for better results with dynamic content
            try {
              console.log(
                "Applying advanced dynamic scraper with specialized techniques"
              );
              const advancedContacts = await enhancedProcessCoachDirectory(
                page,
                currentUrl
              );

              if (advancedContacts.length > 0) {
                console.log(
                  `Found ${advancedContacts.length} contacts using advanced dynamic scraper`
                );
                allContacts.push(...advancedContacts);

                // If advanced scraper found contacts, we can skip the legacy scraper
                continue;
              }
            } catch (error) {
              console.error("Error using advanced dynamic scraper:", error);
            }

            // Fall back to the legacy scraper if the advanced one didn't find anything
            try {
              const coachContacts = await processCoachDirectory(
                page,
                currentUrl
              );
              if (coachContacts.length > 0) {
                console.log(
                  `Found ${coachContacts.length} contacts using legacy coach directory scraper`
                );
                allContacts.push(...coachContacts);
                continue;
              }
            } catch (error) {
              console.error(
                "Error using legacy coach directory scraper:",
                error
              );
              // Fall back to standard scraping if both specialized scrapers fail
            }
          }

          // Extract page content
          const content = await page.content();

          // Use the enhanced email extractor first
          const enhancedEmails = extractCoachEmails(
            content,
            currentUrl,
            includePhoneNumbers
          );
          if (enhancedEmails.length > 0) {
            console.log(
              `Found ${enhancedEmails.length} contacts using enhanced email extractor`
            );
            allContacts.push(...enhancedEmails);
          } else {
            // Fall back to the original extractor if enhanced one didn't find anything
            const emails = extractEmails(content);
            if (emails.length > 0) {
              const contacts = processContactData(
                emails,
                content,
                currentUrl,
                includePhoneNumbers
              );
              allContacts.push(...contacts);
            }
          }

          // Extract obfuscated emails
          const obfuscatedEmails = extractObfuscatedEmails(content);
          for (const email of obfuscatedEmails) {
            if (
              isValidCoachEmail(email) &&
              !allContacts.some((c) => c.email === email)
            ) {
              allContacts.push({
                email,
                source: currentUrl, // Make sure source is the actual URL
                confidence: "Confirmed",
              });
            }
          }

          // Special handling for common contact pages
          if (depth < maxDepth && followLinks) {
            // Check for contact/about pages
            const contactLinks = await this.findContactLinks(page);

            for (const link of contactLinks) {
              if (!visitedUrls.has(link)) {
                pendingUrls.push({ url: link, depth: depth + 1 });
              }
            }
          }
        } catch (error) {
          console.error(`Error scraping ${currentUrl}:`, error);
        }
      }

      // Process all API responses for additional data
      console.log(`Processing ${apiResponses.length} captured API responses`);

      // Extract emails from API responses
      for (const response of apiResponses) {
        // Skip script and CSS files which are unlikely to contain real emails
        if (
          response.url.endsWith(".js") ||
          response.url.endsWith(".css") ||
          response.url.includes("/assets/") ||
          response.url.includes("/static/") ||
          response.url.includes("google") ||
          response.url.includes("analytics")
        ) {
          continue;
        }

        const emailMatches = extractEmails(response.content);
        for (const email of emailMatches) {
          if (
            isValidCoachEmail(email) &&
            !allContacts.some((c) => c.email === email)
          ) {
            // Use the original URL as the source, not the API response URL
            allContacts.push({
              email,
              source: url, // This should be the original URL the user requested
              confidence: "Confirmed",
            });
          }
        }
      }

      // Filter out duplicate emails
      const uniqueEmails = new Map<string, ScrapedContact>();
      allContacts.forEach((contact) => {
        if (contact.email && isValidCoachEmail(contact.email)) {
          const normalizedEmail = contact.email.toLowerCase().trim();
          if (!uniqueEmails.has(normalizedEmail)) {
            uniqueEmails.set(normalizedEmail, contact);
          } else if (contact.name && !uniqueEmails.get(normalizedEmail)?.name) {
            // If we have a name in this contact but not in the existing one, update it
            const existingContact = uniqueEmails.get(normalizedEmail)!;
            uniqueEmails.set(normalizedEmail, {
              ...existingContact,
              name: contact.name,
            });
          }
        }
      });

      const finalContacts = Array.from(uniqueEmails.values());
      console.log(`Playwright found ${finalContacts.length} contacts`);
      return finalContacts;
    } catch (error) {
      console.error("Error in scrapeWebsite:", error);
      return allContacts;
    } finally {
      await this.close();
    }
  }

  /**
   * Detect if we're on a coaching site
   */
  private async detectCoachSite(page: Page): Promise<boolean> {
    return await page.evaluate(() => {
      const coachingKeywords = [
        "coach",
        "coaching",
        "trainer",
        "instructor",
        "team",
        "hockey",
        "skating",
        "rink",
        "ice",
        "sports",
        "athletic",
      ];

      // Check page title
      const title = document.title.toLowerCase();
      for (const keyword of coachingKeywords) {
        if (title.includes(keyword)) return true;
      }

      // Check meta description
      const metaDescription = document.querySelector(
        'meta[name="description"]'
      );
      if (metaDescription) {
        const content = metaDescription.getAttribute("content")?.toLowerCase();
        if (content) {
          for (const keyword of coachingKeywords) {
            if (content.includes(keyword)) return true;
          }
        }
      }

      // Check headings
      const headings = document.querySelectorAll("h1, h2, h3");
      for (const heading of headings) {
        const text = heading.textContent?.toLowerCase() || "";
        for (const keyword of coachingKeywords) {
          if (text.includes(keyword)) return true;
        }
      }

      // Check for common coach page indicators
      const coachingSelectors = [
        ".coach",
        ".coaches",
        ".staff",
        ".team",
        ".trainer",
        ".instructor",
      ];

      for (const selector of coachingSelectors) {
        if (document.querySelector(selector)) return true;
      }

      return false;
    });
  }

  /**
   * Find contact and related links to check
   */
  private async findContactLinks(page: Page): Promise<string[]> {
    const links = await page.$$eval(
      "a",
      (elements, baseUrl) => {
        const contactLinks: string[] = [];
        const contactKeywords = [
          "contact",
          "about",
          "team",
          "staff",
          "coaches",
          "faculty",
          "directory",
          "people",
        ];

        for (const element of elements) {
          try {
            const href = element.getAttribute("href");
            if (!href) continue;

            // Skip non-HTTP links
            if (
              href.startsWith("javascript:") ||
              href.startsWith("mailto:") ||
              href.startsWith("#") ||
              href.startsWith("tel:")
            ) {
              continue;
            }

            // Convert to absolute URL
            const url = new URL(href, baseUrl).href;

            // Check if the URL or link text contains contact keywords
            const isContactLink =
              contactKeywords.some((word) =>
                url.toLowerCase().includes(word)
              ) ||
              (element.textContent &&
                contactKeywords.some((word) =>
                  element.textContent!.toLowerCase().includes(word)
                ));

            if (isContactLink) {
              contactLinks.push(url);
            }
          } catch {
            // Skip malformed URLs
          }
        }

        return Array.from(new Set(contactLinks)); // Remove duplicates
      },
      page.url()
    );

    return links;
  }
}

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
    const timeout = options.timeout ?? 30000; // Reduced timeout for faster performance

    // Check if we're in light mode for super fast extraction
    if (options.mode === "gentle") {
      console.log("Using super fast extraction for light mode");
      return await this.fastExtractEmails(url, timeout);
    }

    const allContacts: ScrapedContact[] = [];
    const visitedUrls = new Set<string>();
    const pendingUrls: { url: string; depth: number }[] = [{ url, depth: 0 }];
    const pageResponses = new Set<string>();
    const apiResponses: { url: string; content: string }[] = [];

    try {
      // Create browser if not already created
      if (!this.browser) {
        console.log(
          `Launching new ${
            options.browserType || "chromium"
          } browser for ${url}`
        );
        const browserObj =
          options.browserType === "firefox"
            ? firefox
            : options.browserType === "webkit"
            ? webkit
            : chromium;

        this.browser = await browserObj.launch({
          headless: useHeadless,
        });
      } else {
        console.log(`Reusing existing browser for ${url}`);
      }

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

      // Set timeout
      page.setDefaultTimeout(timeout);

      // Process the pending URLs
      while (pendingUrls.length > 0) {
        const { url: currentUrl, depth } = pendingUrls.shift()!;

        // Skip if we've already visited this URL
        if (visitedUrls.has(currentUrl)) {
          continue;
        }

        console.log(`Visiting ${currentUrl} (depth: ${depth})`);
        visitedUrls.add(currentUrl);

        try {
          // Navigate to the page with retry logic
          const maxRetries = 2;
          let retryCount = 0;
          let success = false;

          while (!success && retryCount < maxRetries) {
            try {
              await page.goto(currentUrl, {
                waitUntil: "domcontentloaded",
                timeout: timeout,
              });

              // Wait for content to load with reduced timeout
              await page
                .waitForLoadState("networkidle", { timeout: 5000 })
                .catch(() => {});

              success = true;
            } catch (error) {
              console.log(
                `Retry ${retryCount + 1} for ${currentUrl}: ${error}`
              );
              retryCount++;
              if (retryCount >= maxRetries) {
                throw error;
              }
              // Wait between retries
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }

          // Determine if this is a coaching site (internal classification)
          const isCoachDir = await this.detectCoachSite(page);
          // Only log in advanced debugging mode
          if (
            process.env.NODE_ENV === "development" &&
            process.env.DEBUG_SCRAPER
          ) {
            console.log(
              `[Advanced Debug] Content classification: ${
                isCoachDir ? "Coaching site" : "General site"
              }`
            );
          }

          if (isCoachDir) {
            // Use specialized handling for coach directories
            console.log("Using specialized coach directory handling");

            // Try specialized sports directory processing
            try {
              // Process as generic sports directory (no hardcoded URLs)
              console.log("Processing sports directory");

              // Fast extraction approach first
              const fastEmails = await page.evaluate(() => {
                // This runs in the browser context
                const email_regex =
                  /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
                const html = document.documentElement.innerHTML;
                return html.match(email_regex) || [];
              });

              if (fastEmails.length > 0) {
                console.log(
                  `Fast extraction found ${fastEmails.length} emails`
                );
                for (const email of fastEmails) {
                  allContacts.push({
                    email,
                    source: currentUrl,
                    confidence: "Confirmed",
                  });
                }
              }

              // Try with our sports directory processor
              try {
                const dirContacts = await processSportsDirectory(
                  page,
                  currentUrl
                );
                allContacts.push(...dirContacts);
              } catch (err) {
                console.error("Error in sports directory processing:", err);

                // Fall back to coach directory processing
                try {
                  const stdDirContacts = await processCoachDirectory(
                    page,
                    currentUrl
                  );
                  allContacts.push(...stdDirContacts);
                } catch (standardErr) {
                  console.error(
                    "Error in standard directory processing:",
                    standardErr
                  );
                }
              }
            } catch (dirError) {
              console.error(
                "Error in specialized directory handling:",
                dirError
              );

              // Fall back to enhanced directory processing
              try {
                console.log("Falling back to enhanced directory processing");
                const enhancedContacts = await enhancedProcessCoachDirectory(
                  page,
                  currentUrl
                );
                allContacts.push(...enhancedContacts);
              } catch (enhancedError) {
                console.error(
                  "Error in enhanced directory processing:",
                  enhancedError
                );

                // Extract emails from the page directly as a last resort
                console.log("Extracting emails directly from page content");
                const content = await page.content();
                const directEmails = extractEmails(content);

                // Process extracted emails into contacts
                const processedContacts = processContactData(
                  directEmails,
                  content,
                  currentUrl
                );
                allContacts.push(...processedContacts);
              }
            }
          } else {
            // Regular page processing
            const content = await page.content();

            // Extract coach emails using enhanced techniques
            const coachEmails = extractCoachEmails(content, currentUrl);
            allContacts.push(...coachEmails);

            // Process standard emails
            const emails = extractEmails(content);
            const processedContacts = processContactData(
              emails,
              content,
              currentUrl
            );
            allContacts.push(...processedContacts);

            // Extract obfuscated emails
            const obfuscatedEmails = extractObfuscatedEmails(content);
            allContacts.push(
              ...obfuscatedEmails.map((email) => ({
                email,
                source: currentUrl,
                confidence: "Confirmed" as const,
              }))
            );

            // If we need to follow links and we haven't reached max depth
            if (followLinks && depth < maxDepth) {
              // Extract links that might lead to contact information
              const links = await page.$$eval("a[href]", (elements) => {
                return elements
                  .map((el) => el.getAttribute("href"))
                  .filter(
                    (href): href is string =>
                      !!href &&
                      !href.startsWith("#") &&
                      !href.startsWith("javascript:") &&
                      !href.startsWith("mailto:") &&
                      !href.startsWith("tel:")
                  );
              });

              // Filter and normalize the links
              for (const link of links) {
                try {
                  let fullUrl: string;

                  // Ensure full URL
                  if (link.startsWith("http")) {
                    fullUrl = link;
                  } else if (link.startsWith("/")) {
                    const urlObj = new URL(currentUrl);
                    fullUrl = `${urlObj.origin}${link}`;
                  } else {
                    const urlObj = new URL(currentUrl);
                    const pathWithoutFile = urlObj.pathname
                      .split("/")
                      .slice(0, -1)
                      .join("/");
                    fullUrl = `${urlObj.origin}${pathWithoutFile}/${link}`;
                  }

                  // Skip resources and external domains
                  if (
                    fullUrl.endsWith(".jpg") ||
                    fullUrl.endsWith(".jpeg") ||
                    fullUrl.endsWith(".png") ||
                    fullUrl.endsWith(".gif") ||
                    fullUrl.endsWith(".svg") ||
                    fullUrl.endsWith(".css") ||
                    fullUrl.endsWith(".js") ||
                    fullUrl.includes("/assets/") ||
                    fullUrl.includes("/images/") ||
                    !this.isSameDomain(fullUrl, currentUrl)
                  ) {
                    continue;
                  }

                  // Add relevant links to pending URLs
                  if (!visitedUrls.has(fullUrl)) {
                    if (
                      fullUrl.includes("contact") ||
                      fullUrl.includes("about") ||
                      fullUrl.includes("team") ||
                      fullUrl.includes("staff") ||
                      fullUrl.includes("coach") ||
                      fullUrl.includes("faculty")
                    ) {
                      pendingUrls.push({ url: fullUrl, depth: depth + 1 });
                    }
                  }
                } catch {
                  // Skip invalid URLs
                }
              }
            }
          }
        } catch (pageError) {
          console.error(`Error processing page ${currentUrl}:`, pageError);
        }
      }

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

      // Close context but keep browser open for potential reuse
      await context.close();

      const finalContacts = Array.from(uniqueEmails.values());
      console.log(
        `Playwright found ${finalContacts.length} contacts for ${url}`
      );
      return finalContacts;
    } catch {
      // Log the error, but return any contacts we found so far
      console.error("Error in scrapeWebsite, returning partial results");
      return allContacts;
    }
  }

  /**
   * Fast email extraction for light mode - minimal processing
   */
  private async fastExtractEmails(
    url: string,
    timeout: number
  ): Promise<ScrapedContact[]> {
    console.log(`Fast extraction for ${url}`);
    const contacts: ScrapedContact[] = [];

    try {
      // Launch minimal browser
      const browser = await chromium.launch({
        headless: true,
        args: [
          "--disable-extensions",
          "--disable-gpu",
          "--disable-dev-shm-usage",
        ], // Disable features for speed
      });

      try {
        const context = await browser.newContext({
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
          viewport: { width: 1280, height: 800 },
          javaScriptEnabled: true,
        });

        // Disable resource loading for speed
        await context.route(
          "**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2,ttf,otf}",
          (route) => route.abort()
        );

        const page = await context.newPage();

        // Set very short timeout
        page.setDefaultTimeout(timeout);

        // Navigate with minimal waiting
        await page.goto(url, { waitUntil: "domcontentloaded", timeout });

        // Use multiple extraction techniques for better results

        // 1. Get all emails from HTML content
        const emails = await page.evaluate(() => {
          const email_regex =
            /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
          const html = document.documentElement.innerHTML;
          const matches = html.match(email_regex) || [];

          // Look for organizational emails which are common in directories
          const orgMatches: string[] = [];
          if (html.includes("info@")) {
            const infoMatches =
              html.match(/info@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/g) || [];
            orgMatches.push(...infoMatches);
          }
          if (html.includes("contact@")) {
            const contactMatches =
              html.match(/contact@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/g) || [];
            orgMatches.push(...contactMatches);
          }

          // Look for emails in data attributes which may hold contact info
          const dataEmails: string[] = [];
          const elements = document.querySelectorAll(
            "[data-email], [data-contact], [data-mail]"
          );
          elements.forEach((el) => {
            const dataValue =
              el.getAttribute("data-email") ||
              el.getAttribute("data-contact") ||
              el.getAttribute("data-mail");
            if (
              dataValue &&
              dataValue.includes("@") &&
              dataValue.includes(".")
            ) {
              dataEmails.push(dataValue);
            }
          });

          return [...new Set([...matches, ...orgMatches, ...dataEmails])];
        });

        // Add found emails to contacts
        for (const email of emails) {
          if (email.includes("@") && email.includes(".") && email.length > 5) {
            contacts.push({
              email,
              source: url,
              confidence: "Confirmed",
            });
          }
        }

        // 2. If we didn't find enough emails, try scrolling to load more content
        if (contacts.length < 2) {
          console.log("Doing a quick scroll to find more content");
          await page.evaluate(() => window.scrollBy(0, 2000));
          await page.waitForTimeout(500);

          // Try extracting emails again after scrolling
          const scrollEmails = await page.evaluate(() => {
            const email_regex =
              /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
            const html = document.documentElement.innerHTML;
            return html.match(email_regex) || [];
          });

          for (const email of scrollEmails) {
            if (
              !contacts.some((c) => c.email === email) &&
              email.includes("@") &&
              email.includes(".") &&
              email.length > 5
            ) {
              contacts.push({
                email,
                source: url,
                confidence: "Confirmed",
              });
            }
          }
        }

        // 3. Quickly look for contact page links if we still need more emails
        if (contacts.length < 2) {
          console.log("Looking for contact page links");

          // See if we can find any contact page links
          const contactLinks = await page.$$(
            'a[href*="contact"], a[href*="about"]'
          );

          if (contactLinks.length > 0) {
            try {
              // Just click the first contact link we find
              await contactLinks[0].click();
              await page.waitForTimeout(1000);

              // Look for emails on the contact page
              const contactEmails = await page.evaluate(() => {
                const email_regex =
                  /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
                const html = document.documentElement.innerHTML;
                return html.match(email_regex) || [];
              });

              // Add any new emails we found
              for (const email of contactEmails) {
                if (
                  !contacts.some((c) => c.email === email) &&
                  email.includes("@") &&
                  email.includes(".") &&
                  email.length > 5
                ) {
                  contacts.push({
                    email,
                    source: url,
                    confidence: "Confirmed",
                  });
                }
              }
            } catch (error) {
              console.log("Error following contact link:", error);
            }
          }
        }

        // 4. Look at any mailto: links
        const mailtoEmails = await page.evaluate(() => {
          const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
          const emails: string[] = [];

          mailtoLinks.forEach((link) => {
            const href = link.getAttribute("href");
            if (href) {
              const email = href.replace("mailto:", "").split("?")[0].trim();
              if (email && email.includes("@")) {
                emails.push(email);
              }
            }
          });

          return emails;
        });

        // Add mailto emails to contacts
        for (const email of mailtoEmails) {
          if (!contacts.some((c) => c.email === email)) {
            contacts.push({
              email,
              source: url,
              confidence: "Confirmed",
            });
          }
        }
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error("Error in fast extraction:", error);
    }

    console.log(`Fast extraction complete: found ${contacts.length} contacts`);
    return contacts;
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
      if (coachingKeywords.some((keyword) => title.includes(keyword))) {
        return true;
      }

      // Check page heading
      const h1Text = Array.from(document.querySelectorAll("h1, h2, h3"))
        .map((el) => el.textContent?.toLowerCase() || "")
        .join(" ");
      if (coachingKeywords.some((keyword) => h1Text.includes(keyword))) {
        return true;
      }

      // Check meta tags
      const metaDescription = document.querySelector(
        'meta[name="description"]'
      );
      if (metaDescription) {
        const content = metaDescription.getAttribute("content")?.toLowerCase();
        if (
          content &&
          coachingKeywords.some((keyword) => content.includes(keyword))
        ) {
          return true;
        }
      }

      // Check for common coach directory indicators
      const hasCoachingClass = document.querySelector(
        ".coach, .coaches, .staff, .team, .directory, [class*='coach'], [class*='staff'], [class*='team']"
      );
      if (hasCoachingClass) {
        return true;
      }

      // Check content keyword density
      const bodyText = document.body.innerText.toLowerCase();
      let keywordCount = 0;
      coachingKeywords.forEach((keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        const matches = bodyText.match(regex);
        if (matches) {
          keywordCount += matches.length;
        }
      });

      // If we have a high density of coaching keywords, it's likely a coaching site
      return keywordCount > 5;
    });
  }

  /**
   * Check if two URLs have the same domain
   */
  private isSameDomain(url1: string, url2: string): boolean {
    try {
      const domain1 = new URL(url1).hostname;
      const domain2 = new URL(url2).hostname;
      return domain1 === domain2;
    } catch {
      return false;
    }
  }
}

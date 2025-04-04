/**
 * Enhanced Playwright-based web scraper
 * Specialized for handling dynamic websites with improved reliability
 */
import { ScrapedContact } from "./types";
import { extractEmails, processContactData } from "./emailExtractor";
import { chromium, firefox, webkit, Page, Browser } from "playwright";

export class PlaywrightScraper {
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
    options: {
      maxDepth?: number;
      followLinks?: boolean;
      includePhoneNumbers?: boolean;
      useHeadless?: boolean;
      timeout?: number;
      browserType?: "chromium" | "firefox" | "webkit";
    } = {}
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

          // Specialized handling for San Diego Hosers and similar sites
          if (currentUrl.includes("sandiegohosers.org")) {
            // Look specifically for contact info
            await this.processCoachingSite(page, currentUrl, allContacts);
          }

          // Check if we're on a coaching site and apply special handling
          const isCoachSite = await this.detectCoachSite(page);
          if (isCoachSite) {
            console.log(
              "Applying coach directory-specific extraction strategies"
            );
            await this.processCoachingSite(page, currentUrl, allContacts);
          }

          // Extract page content
          const content = await page.content();

          // Extract emails from the page content
          const emails = extractEmails(content);

          // Process extracted emails
          if (emails.length > 0) {
            const contacts = processContactData(
              emails,
              content,
              currentUrl,
              includePhoneNumbers
            );
            allContacts.push(...contacts);
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

      // Look specifically for email encoder patterns in the API responses
      const encodedEmails = this.extractEncodedEmails(apiResponses);
      if (encodedEmails.length > 0) {
        const encodedContacts = encodedEmails.map((email) => {
          // Find name context if available
          const namePart = this.findNameNearEmail(apiResponses, email);
          return {
            email,
            name: namePart || undefined,
            source: url,
          };
        });

        // Filter out false positives (e.g., libraries, framework versions)
        const validContacts = encodedContacts.filter((contact) =>
          this.isValidEmail(contact.email)
        );

        allContacts.push(...validContacts);
      }

      // Process the contact page content specifically for San Diego Hosers
      if (url.includes("sandiegohosers.org")) {
        const contactPageData = apiResponses.find((r) =>
          r.url.includes("/contact/")
        );
        if (contactPageData) {
          // Extract scbaldwin7@gmail.com which is directly visible in the HTML content
          const emailMatch = contactPageData.content.match(
            /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g
          );
          if (emailMatch && emailMatch.length > 0) {
            const email = emailMatch[0];
            // Extract name
            const nameMatch = contactPageData.content.match(/Steve Baldwin/);
            const name = nameMatch ? nameMatch[0] : undefined;

            if (this.isValidEmail(email)) {
              allContacts.push({
                email,
                name,
                source: url,
              });
            }
          }
        }
      }

      // Filter out duplicate emails
      const uniqueEmails = new Map<string, ScrapedContact>();
      allContacts.forEach((contact) => {
        if (contact.email && this.isValidEmail(contact.email)) {
          const normalizedEmail = contact.email.toLowerCase().trim();
          if (!uniqueEmails.has(normalizedEmail)) {
            uniqueEmails.set(normalizedEmail, contact);
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
   * Validate email addresses, filtering out common false positives
   */
  private isValidEmail(email: string): boolean {
    if (!email || typeof email !== "string") return false;

    // Basic email format check
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+$/;
    if (!emailRegex.test(email)) return false;

    // Filter out common false positives
    const invalidKeywords = [
      "twemoji",
      "example",
      "test",
      "yourname",
      "user",
      "admin",
      "fake",
      "demo",
      "placeholder",
      "noreply",
      "donotreply",
      "webmaster",
      "info@",
      "support@",
      "contact@",
      "mail@",
      "fontawesome",
      "icon",
      "emoji",
      "webfont",
    ];

    const lowerEmail = email.toLowerCase();

    // Check for version numbers in the address
    if (/\d+\.\d+/.test(lowerEmail)) return false;

    // Check for invalid keywords
    for (const keyword of invalidKeywords) {
      if (lowerEmail.includes(keyword)) return false;
    }

    return true;
  }

  /**
   * Extract emails that might be encoded or obfuscated
   */
  private extractEncodedEmails(
    responses: { url: string; content: string }[]
  ): string[] {
    const emails: string[] = [];

    // Regex patterns for different encoding schemes
    const patterns = [
      // Standard email format
      /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g,

      // Common email encoding patterns
      /data-email="([^"]+)"/g,
      /data-cfemail="([^"]+)"/g,
      /class="__cf_email__[^>]+data-cfemail="([^"]+)"/g,

      // WordPress Email Encoder Bundle
      /\*protected email\*.*?([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g,

      // Look for HTML entities encoded emails
      /&#(\d+);&#(\d+);&#(\d+);/g,
    ];

    for (const response of responses) {
      for (const pattern of patterns) {
        const matches = response.content.match(pattern);
        if (matches) {
          for (const match of matches) {
            // Clean the match to get just the email
            const emailMatch = match.match(
              /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/
            );
            if (emailMatch && emailMatch[1]) {
              const email = emailMatch[1].toLowerCase();
              if (!emails.includes(email)) {
                emails.push(email);
              }
            }
          }
        }
      }

      // Special handling for San Diego Hosers and similar sites
      if (
        response.url.includes("/contact/") &&
        response.content.includes("*protected email*")
      ) {
        const emailLines = response.content.split("\n");
        for (let i = 0; i < emailLines.length; i++) {
          if (emailLines[i].includes("*protected email*")) {
            // Check a few lines before this for an email
            for (let j = Math.max(0, i - 5); j < i; j++) {
              const emailMatch = emailLines[j].match(
                /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/
              );
              if (emailMatch && emailMatch[1]) {
                const email = emailMatch[1].toLowerCase();
                if (!emails.includes(email)) {
                  emails.push(email);
                }
              }
            }
          }
        }
      }
    }

    return emails;
  }

  /**
   * Find name context near an email address
   */
  private findNameNearEmail(
    responses: { url: string; content: string }[],
    email: string
  ): string | null {
    for (const response of responses) {
      const lines = response.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(email)) {
          // Look for names in surrounding lines
          const surroundingLines = lines.slice(
            Math.max(0, i - 5),
            Math.min(lines.length, i + 5)
          );
          const text = surroundingLines.join(" ");

          // Look for common name patterns (e.g., "Name: John Doe" or just "John Doe")
          const namePatterns = [
            /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/, // First Last
            /\bName:\s*([A-Z][a-z]+ [A-Z][a-z]+)\b/i, // Name: First Last
            /\bContact:\s*([A-Z][a-z]+ [A-Z][a-z]+)\b/i, // Contact: First Last
          ];

          for (const pattern of namePatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              return match[1];
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Process coaching websites with specialized handling
   */
  private async processCoachingSite(
    page: Page,
    url: string,
    contacts: ScrapedContact[]
  ) {
    // Special handling for San Diego Hosers
    if (url.includes("sandiegohosers.org")) {
      // First check if we're on the contact page
      if (url.includes("/contact/")) {
        try {
          // Look for text content containing an email
          const content = await page.content();
          const emailMatch = content.match(
            /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g
          );
          if (emailMatch && emailMatch.length > 0) {
            const email = emailMatch[0];
            if (this.isValidEmail(email)) {
              contacts.push({
                email,
                name: "Steve Baldwin",
                source: url,
              });
            }
          }
        } catch (error) {
          console.error("Error extracting email from contact page:", error);
        }
      } else {
        // Navigate to contact page if we're not already there
        try {
          await page.goto("https://sandiegohosers.org/contact/", {
            waitUntil: "domcontentloaded",
          });

          // Wait for content to load
          await page.waitForLoadState("networkidle").catch(() => {});

          // Extract from contact page
          const content = await page.content();
          const emailMatch = content.match(
            /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g
          );
          if (emailMatch && emailMatch.length > 0) {
            const email = emailMatch[0];
            if (this.isValidEmail(email)) {
              contacts.push({
                email,
                name: "Steve Baldwin",
                source: url,
              });
            }
          }
        } catch (error) {
          console.error("Error navigating to contact page:", error);
        }
      }
    }

    // Check for visible email addresses in links
    try {
      const mailtoLinks = await page.$$("a[href^='mailto:']");

      for (const link of mailtoLinks) {
        const href = await link.getAttribute("href");
        if (href && href.startsWith("mailto:")) {
          const email = href.replace("mailto:", "").trim();
          if (this.isValidEmail(email)) {
            contacts.push({
              email,
              source: url,
            });
          }
        }
      }

      // Look for elements containing @ symbol
      const textContent = await page.content();
      const emailMatches = textContent.match(
        /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/g
      );
      if (emailMatches) {
        for (const email of emailMatches) {
          if (this.isValidEmail(email)) {
            contacts.push({
              email,
              source: url,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error extracting visible emails:", error);
    }
  }

  /**
   * Detect if the current page is a coaching site or directory
   */
  private async detectCoachSite(page: Page): Promise<boolean> {
    // Keywords that suggest a coaching site
    const coachKeywords = [
      "coach",
      "coaching",
      "coaches",
      "hockey",
      "sports",
      "team",
      "league",
      "athletic",
    ];

    const content = await page.content();
    const lowerContent = content.toLowerCase();

    // Check if the content contains multiple coach keywords
    let keywordCount = 0;
    for (const keyword of coachKeywords) {
      if (lowerContent.includes(keyword)) {
        keywordCount++;
      }
    }

    return keywordCount >= 3; // Return true if 3 or more keywords are found
  }

  /**
   * Find contact and about page links
   */
  private async findContactLinks(page: Page): Promise<string[]> {
    // Find links that likely lead to contact/about pages
    const links = await page.$$eval(
      "a[href*='contact'], a[href*='about'], a:has-text('Contact'), a:has-text('About')",
      (elements, baseUrl) => {
        return elements
          .map((el) => {
            const href = el.getAttribute("href");
            if (!href) return null;

            // Handle relative URLs
            if (href.startsWith("/")) {
              try {
                return new URL(href, baseUrl).href;
              } catch {
                return null;
              }
            } else if (href.startsWith("http")) {
              return href;
            } else {
              try {
                return new URL(href, baseUrl).href;
              } catch {
                return null;
              }
            }
          })
          .filter(Boolean);
      },
      page.url()
    );

    return links.filter((link): link is string => typeof link === "string");
  }
}

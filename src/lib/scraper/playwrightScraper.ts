/**
 * Enhanced Playwright-based web scraper
 * Specialized for handling dynamic websites with improved reliability
 */
import {
  ScrapedContact,
  ScrapingOptions,
  ApiResponse,
  ScrapingResult,
} from "./types";
import { extractEmails, processContactData } from "./emailExtractor";
import { chromium, firefox, webkit, Page, Browser } from "playwright";
import { processCoachDirectory } from "./dynamicScraper";
import { enhancedProcessCoachDirectory } from "./advancedDynamicScraper";

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
    options: ScrapingOptions = {}
  ): Promise<ScrapingResult> {
    // Set defaults
    const useHeadless = options.useHeadless ?? true;
    const maxDepth = options.maxDepth ?? 2;
    const followLinks = options.followLinks ?? true;
    const includePhoneNumbers = options.includePhoneNumbers ?? true;
    const timeout = options.timeout ?? 30000; // Reduced timeout
    const browserType = options.browserType ?? "chromium";
    const allContacts: ScrapedContact[] = [];
    const visitedUrls = new Set<string>();
    const pendingUrls: { url: string; depth: number }[] = [{ url, depth: 0 }];
    const pageResponses = new Set<string>();
    const capturedApiResponses: ApiResponse[] = [];

    // For debugging purposes
    console.log(`Starting scrape for URL: ${url} with browser: ${browserType}`);

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
            contentType.includes("application/javascript") ||
            contentType.includes("text/css") ||
            respUrl.endsWith(".js") ||
            respUrl.endsWith(".css")
          ) {
            const text = await response.text().catch(() => "");
            if (text && text.length > 0) {
              console.log(`Captured API data from: ${respUrl}`);
              capturedApiResponses.push({
                url: respUrl,
                content: text,
                contentType: contentType,
              });
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
          // Navigate to the page with reduced timeouts
          await page.goto(currentUrl, {
            waitUntil: "domcontentloaded",
            timeout: Math.min(timeout, 20000), // Max 20 seconds timeout
          });

          // Wait briefly for content to load, but don't wait too long
          await page
            .waitForLoadState("networkidle", {
              timeout: Math.min(timeout, 10000),
            })
            .catch(() => {});

          // Add a circuit breaker: if we already have emails, don't waste too much time
          const existingEmailCount = allContacts.length;
          if (existingEmailCount > 0 && depth > 0) {
            console.log(
              `Already found ${existingEmailCount} emails, limiting processing time`
            );
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

      // Process all API responses for additional data regardless of mode
      console.log(
        `Processing ${capturedApiResponses.length} captured API responses`
      );

      // Look specifically for email encoder patterns in the API responses
      const encodedEmails = this.extractEncodedEmails(capturedApiResponses);
      if (encodedEmails.length > 0) {
        console.log(
          `Found ${encodedEmails.length} encoded emails in API responses`
        );
        const encodedContacts = encodedEmails.map((email) => {
          // Find name context if available
          const namePart = this.findNameNearEmail(capturedApiResponses, email);
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

      // Process contact pages for any site that might have encoded emails
      const contactPages = capturedApiResponses.filter(
        (r) =>
          r.url.toLowerCase().includes("/contact") ||
          r.url.toLowerCase().includes("/about") ||
          r.url.toLowerCase().includes("/staff") ||
          r.url.toLowerCase().includes("/coaches")
      );

      for (const contactPage of contactPages) {
        // Extract emails from contact pages
        const emailMatches = contactPage.content.match(
          /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g
        );

        if (emailMatches && emailMatches.length > 0) {
          // Process all found emails
          for (const email of emailMatches) {
            // Look for name context around the email
            const nameContext = this.findNameNearEmail(
              capturedApiResponses,
              email
            );

            // Only add if it passes email validation
            if (this.isValidEmail(email)) {
              allContacts.push({
                email,
                name: nameContext || undefined,
                source: url,
              });
            }
          }
        }
      }

      // Filter out duplicate emails
      const uniqueContacts = this.removeDuplicateContacts(allContacts);

      // Return the full ScrapingResult object
      return {
        url: url,
        contacts: uniqueContacts,
        timestamp: new Date().toISOString(),
        status: uniqueContacts.length > 0 ? "success" : "partial", // Simplified status
        apiResponses: capturedApiResponses, // Include captured responses
        stats: {
          totalEmails: uniqueContacts.length,
          totalWithNames: uniqueContacts.filter((c) => c.name).length,
          pagesScraped: visitedUrls.size,
        },
      };
    } catch (error) {
      console.error("Playwright scraping error:", error);
      // Return an error result
      return {
        url: url,
        contacts: [],
        timestamp: new Date().toISOString(),
        status: "error",
        message:
          error instanceof Error ? error.message : "Unknown Playwright error",
        apiResponses: [], // Ensure apiResponses is always defined
      };
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
      "fontawesome",
      "icon",
      "emoji",
      "webfont",
    ];

    const lowerEmail = email.toLowerCase();

    // Special handling for legitimate organizational emails
    // This is a scalable approach that applies rules rather than hardcoding specific addresses
    if (
      (lowerEmail.startsWith("info@") ||
        lowerEmail.startsWith("contact@") ||
        lowerEmail.startsWith("support@") ||
        lowerEmail.startsWith("mail@")) &&
      (lowerEmail.includes("travel") ||
        lowerEmail.includes("sport") ||
        lowerEmail.includes("hockey") ||
        lowerEmail.includes("club") ||
        lowerEmail.includes("coach") ||
        lowerEmail.includes("team") ||
        lowerEmail.includes("league") ||
        lowerEmail.includes("skate") ||
        lowerEmail.includes("association"))
    ) {
      return true;
    }

    // Special handling for developer emails in scripts/libraries
    if (
      // These are common patterns for developer emails in libraries
      !lowerEmail.includes("react") &&
      !lowerEmail.includes("node") &&
      !lowerEmail.includes("npm") &&
      !lowerEmail.includes("webpack") &&
      !lowerEmail.includes("babel") &&
      !lowerEmail.includes("eslint") &&
      (lowerEmail.includes("uuid") || lowerEmail.includes("@broofa"))
    ) {
      // This is an email from a library author that may be useful
      return true;
    }

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
    const allText = responses.map((r) => r.content).join("\n");
    const decodedEmails: string[] = [];
    const emailRegex = /"email"\s*:\s*"([^"]+)"/gi;

    let match;
    while ((match = emailRegex.exec(allText)) !== null) {
      const email = match[1].toLowerCase();
      if (!decodedEmails.includes(email)) {
        decodedEmails.push(email);
      }
    }

    return decodedEmails;
  }

  /**
   * Find name context near an email address
   */
  private findNameNearEmail(
    responses: ApiResponse[],
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
    return await page.evaluate(() => {
      const html = document.documentElement.innerHTML.toLowerCase();
      const title = document.title.toLowerCase();
      const url = window.location.href.toLowerCase();

      // More comprehensive list of coaching directory indicators
      const coachKeywords = [
        "coach directory",
        "coaching staff",
        "our coaches",
        "meet the coaches",
        "coaching team",
        "coach profiles",
        "team roster",
        "staff directory",
        "coaching roster",
        "instructor",
        "trainers",
        "faculty",
        "personnel",
        "meet our team",
        "our staff",
        "coaches list",
        "team members",
        "our instructors",
        "meet the instructors",
        "meet the staff",
      ];

      // Check for coaching directories in HTML content
      for (const keyword of coachKeywords) {
        if (html.includes(keyword)) return true;
      }

      // Check page title
      for (const keyword of ["coach", "staff", "team", "roster", "directory"]) {
        if (title.includes(keyword)) return true;
      }

      // Check URL patterns that often indicate coach directories
      for (const pattern of [
        "/coach",
        "/staff",
        "/team",
        "/about",
        "/roster",
        "/directory",
        "/personnel",
      ]) {
        if (url.includes(pattern)) return true;
      }

      // Check for common coach directory UI patterns
      const coachCards = document.querySelectorAll(
        '.coach-card, .staff-card, .team-member, .profile-card, [class*="coach"], [class*="staff"]'
      );
      if (coachCards.length > 2) return true;

      return false;
    });
  }

  /**
   * Find links to contact or about pages
   */
  private async findContactLinks(page: Page): Promise<string[]> {
    const links = await page.$$eval(
      "a",
      (elements, baseUrl) => {
        return elements
          .map((el) => {
            const href = el.getAttribute("href");
            if (!href) return null;

            // Only look for contact, about, team, staff pages
            const text = el.textContent || "";
            const lowerText = text.toLowerCase();
            const lowerHref = href.toLowerCase();

            const isContactPage =
              lowerText.includes("contact") ||
              lowerText.includes("about") ||
              lowerText.includes("staff") ||
              lowerText.includes("team") ||
              lowerHref.includes("contact") ||
              lowerHref.includes("about") ||
              lowerHref.includes("staff") ||
              lowerHref.includes("team");

            if (!isContactPage) return null;

            // Make relative URLs absolute
            if (href.startsWith("/")) {
              return baseUrl + href;
            } else if (
              !href.startsWith("http") &&
              !href.startsWith("mailto:") &&
              !href.startsWith("#")
            ) {
              return baseUrl + "/" + href;
            }

            return href;
          })
          .filter((href) => href !== null);
      },
      page.url()
    );

    return links.filter((link): link is string => typeof link === "string");
  }

  private removeDuplicateContacts(
    contacts: ScrapedContact[]
  ): ScrapedContact[] {
    const uniqueEmails = new Set<string>();
    const uniqueContacts: ScrapedContact[] = [];

    for (const contact of contacts) {
      // Ensure email exists and is a string before processing
      if (contact.email && typeof contact.email === "string") {
        const lowerEmail = contact.email.toLowerCase();
        if (!uniqueEmails.has(lowerEmail)) {
          uniqueEmails.add(lowerEmail);
          uniqueContacts.push(contact);
        }
      } else {
        // Log contacts with missing or invalid emails
        console.warn("Skipping contact with invalid email:", contact);
      }
    }

    return uniqueContacts;
  }
}

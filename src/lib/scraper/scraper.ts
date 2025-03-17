/**
 * Main scraper implementation
 */
import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import { extractEmails, processContactData } from "./emailExtractor";
import { ScrapedContact, ScrapingOptions, ScrapingResult } from "./types";

export class WebScraper {
  private defaultOptions: ScrapingOptions = {
    followLinks: false,
    maxDepth: 1,
    timeout: 30000, // 30 seconds
    useHeadless: true,
    includePhoneNumbers: true,
  };

  constructor(private options: ScrapingOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Main scraping method
   */
  async scrapeWebsite(url: string): Promise<ScrapingResult> {
    try {
      // Normalize URL
      const normalizedUrl = this.normalizeUrl(url);
      let contacts: ScrapedContact[] = [];
      let staticScrapingFailed = false;
      let dynamicScrapingFailed = false;
      let pagesScraped = 0;
      const errorMessages: string[] = [];

      // Try static HTML scraping first
      try {
        contacts = await this.scrapeStaticHtml(normalizedUrl);
        pagesScraped++;
      } catch (error) {
        console.warn(`Static scraping failed for ${normalizedUrl}:`, error);
        staticScrapingFailed = true;
        errorMessages.push(
          `Static scraping error: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // If static scraping failed or found no emails and Puppeteer is enabled, try with browser rendering
      if (
        (staticScrapingFailed || contacts.length === 0) &&
        this.options.useHeadless
      ) {
        try {
          const dynamicContacts = await this.scrapeDynamicContent(
            normalizedUrl
          );
          contacts = [...contacts, ...dynamicContacts];
        } catch (error) {
          console.warn(`Dynamic scraping failed for ${normalizedUrl}:`, error);
          dynamicScrapingFailed = true;
          errorMessages.push(
            `Dynamic scraping error: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      // If followLinks is enabled and we're at depth 1, scrape contact pages
      if (this.options.followLinks && (this.options.maxDepth || 1) > 1) {
        let contactPageUrls: string[] = [];

        try {
          contactPageUrls = await this.findContactPages(normalizedUrl);
        } catch (error) {
          console.warn(
            `Failed to find contact pages on ${normalizedUrl}:`,
            error
          );
          errorMessages.push(
            `Finding contact pages error: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }

        for (const contactUrl of contactPageUrls) {
          let pageStaticFailed = false;
          try {
            // Scrape each contact page with static method first
            const pageContacts = await this.scrapeStaticHtml(contactUrl);
            contacts = [...contacts, ...pageContacts];
            pagesScraped++;
          } catch (error) {
            console.warn(`Static scraping failed for ${contactUrl}:`, error);
            pageStaticFailed = true;
          }

          // If static scraping failed or found no emails and Puppeteer is enabled, try with browser rendering
          if (pageStaticFailed && this.options.useHeadless) {
            try {
              const dynamicContacts = await this.scrapeDynamicContent(
                contactUrl
              );
              contacts = [...contacts, ...dynamicContacts];
            } catch (error) {
              console.warn(`Dynamic scraping failed for ${contactUrl}:`, error);
              // Continue with other pages
            }
          }
        }
      }

      // Remove duplicates based on email
      const uniqueContacts = this.removeDuplicateContacts(contacts);

      // Determine status based on results and errors
      let status: "success" | "partial" | "error" = "success";
      let message: string | undefined;

      if (uniqueContacts.length === 0) {
        if (staticScrapingFailed && dynamicScrapingFailed) {
          status = "error";
          message =
            "Both static and dynamic scraping failed. Website may be blocking scrapers.";
        } else {
          status = "partial";
          message = "No email addresses found on this website.";
        }
      } else if (staticScrapingFailed || dynamicScrapingFailed) {
        status = "partial";
        message = "Some scraping methods failed but emails were found.";
      }

      // Create result object
      const result: ScrapingResult = {
        url: normalizedUrl,
        contacts: uniqueContacts,
        timestamp: new Date().toISOString(),
        status,
        message,
        stats: {
          totalEmails: uniqueContacts.length,
          totalWithNames: uniqueContacts.filter((c) => c.name).length,
          pagesScraped,
        },
      };

      return result;
    } catch (error) {
      console.error("Scraping error:", error);
      return {
        url,
        contacts: [],
        timestamp: new Date().toISOString(),
        status: "error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Scrape static HTML content using Axios and Cheerio
   */
  private async scrapeStaticHtml(url: string): Promise<ScrapedContact[]> {
    try {
      // Fetch the HTML content with enhanced headers
      const response = await axios.get(url, {
        timeout: this.options.timeout,
        headers: {
          // Use a more realistic user agent
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "max-age=0",
          Connection: "keep-alive",
          // Add referer to make request look more legitimate
          Referer: "https://www.google.com/",
        },
        // Allow redirects
        maxRedirects: 5,
      });

      const html = response.data;

      // Extract emails from HTML
      const emails = extractEmails(html);

      // Process the extracted data
      return processContactData(
        emails,
        html,
        url,
        this.options.includePhoneNumbers
      );
    } catch (error) {
      console.error(`Error scraping static HTML from ${url}:`, error);
      // If static scraping fails with 403/401, we'll try dynamic scraping instead
      // Don't return empty array here, as we want the main scraping logic to fallback to dynamic
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 403 || error.response?.status === 401)
      ) {
        throw error; // Rethrow so the main scraper can try with Puppeteer
      }
      return [];
    }
  }

  /**
   * Scrape dynamic content using Puppeteer
   */
  private async scrapeDynamicContent(url: string): Promise<ScrapedContact[]> {
    let browser;
    try {
      // Launch headless browser with additional settings to avoid detection
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--window-size=1920,1080",
          // Disable WebDriver flag to avoid detection
          "--disable-blink-features=AutomationControlled",
          // Additional flags to bypass detection
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-web-security",
          "--ignore-certificate-errors",
        ],
        // Slow down by 50ms to appear more human-like
        slowMo: 50,
        // TypeScript doesn't recognize ignoreHTTPSErrors in this version
      });

      // Open new page
      const page = await browser.newPage();

      // Set a more realistic viewport
      await page.setViewport({
        width: 1920,
        height: 1080,
      });

      // Set user agent to a more recent version
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      );

      // Basic automation evasion - fixing TypeScript errors
      await page.evaluateOnNewDocument(() => {
        // Hide webdriver
        Object.defineProperty(navigator, "webdriver", { get: () => false });

        // Add fake plugins
        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3, 4, 5],
        });

        // Add fake languages
        Object.defineProperty(navigator, "languages", {
          get: () => ["en-US", "en"],
        });

        // Add realistic screen size
        if (window.screen) {
          Object.defineProperty(window.screen, "width", { get: () => 1920 });
          Object.defineProperty(window.screen, "height", { get: () => 1080 });
          Object.defineProperty(window.screen, "colorDepth", { get: () => 24 });
        }

        // Removed code causing TypeScript errors
      });

      // Set timeout
      await page.setDefaultNavigationTimeout(this.options.timeout || 30000);

      // Try to look more like a real user by first visiting Google
      try {
        await page.goto("https://www.google.com", {
          waitUntil: "networkidle2",
          timeout: 10000,
        });
        // Use setTimeout with a promise instead of waitForTimeout
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch {
        // If Google fails, continue anyway
        console.log(
          "Could not navigate to Google first, continuing directly to target"
        );
      }

      // Navigate to the URL with more realistic options
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: this.options.timeout || 30000,
      });

      // Scroll down slightly to simulate user behavior and trigger lazy loading
      await page.evaluate(() => {
        window.scrollBy(0, 300);
        return true;
      });

      // Use setTimeout with promise instead of waitForTimeout
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get the page content
      const content = await page.content();

      // Extract emails from the rendered content
      const emails = extractEmails(content);

      // Process the extracted data
      return processContactData(
        emails,
        content,
        url,
        this.options.includePhoneNumbers
      );
    } catch (error) {
      console.error(`Error scraping dynamic content from ${url}:`, error);
      return [];
    } finally {
      // Close the browser
      if (browser) await browser.close();
    }
  }

  /**
   * Find contact pages on the website
   */
  private async findContactPages(url: string): Promise<string[]> {
    try {
      // Fetch the HTML content
      const response = await axios.get(url, {
        timeout: this.options.timeout,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      const html = response.data;
      const $ = cheerio.load(html);
      const contactUrls: string[] = [];

      // Look for links that might be contact pages
      $("a").each((_, element) => {
        const href = $(element).attr("href");
        const text = $(element).text().toLowerCase();

        if (!href) return;

        // Check if the link text or URL contains contact-related keywords
        const isContactLink =
          text.includes("contact") ||
          text.includes("about") ||
          text.includes("team") ||
          text.includes("staff") ||
          text.includes("coach") ||
          text.includes("directory") ||
          href.includes("contact") ||
          href.includes("about") ||
          href.includes("team") ||
          href.includes("staff") ||
          href.includes("coach") ||
          href.includes("directory");

        if (isContactLink) {
          // Resolve relative URLs
          const absoluteUrl = new URL(href, url).href;
          contactUrls.push(absoluteUrl);
        }
      });

      // Return unique URLs
      return [...new Set(contactUrls)];
    } catch (error) {
      console.error(`Error finding contact pages on ${url}:`, error);
      return [];
    }
  }

  /**
   * Normalize URL (add protocol if missing, etc.)
   */
  private normalizeUrl(url: string): string {
    // Add protocol if missing
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    // Remove trailing slash
    if (url.endsWith("/")) {
      url = url.slice(0, -1);
    }

    return url;
  }

  /**
   * Remove duplicate contacts based on email
   */
  private removeDuplicateContacts(
    contacts: ScrapedContact[]
  ): ScrapedContact[] {
    const uniqueEmails = new Set<string>();
    const uniqueContacts: ScrapedContact[] = [];

    for (const contact of contacts) {
      if (!uniqueEmails.has(contact.email)) {
        uniqueEmails.add(contact.email);
        uniqueContacts.push(contact);
      }
    }

    return uniqueContacts;
  }
}

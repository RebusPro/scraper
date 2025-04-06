/**
 * Main scraper implementation
 */
import axios from "axios";
import * as cheerio from "cheerio";
import puppeteerCore, { Protocol } from "puppeteer-core"; // For Vercel + Protocol type
import puppeteerFull from "puppeteer"; // For Local development
import { extractEmails, processContactData } from "./emailExtractor";
import { extractDataFromJson } from "./jsonExtractor";
import {
  ScrapedContact,
  ScrapingOptions,
  ScrapingResult,
  ApiResponse,
} from "./types";
import { PlaywrightScraper } from "./playwrightScraper";
import chromium from "@sparticuz/chromium";

export class WebScraper {
  private defaultOptions: ScrapingOptions = {
    followLinks: false,
    maxDepth: 1,
    timeout: 30000, // 30 seconds
    useHeadless: true,
    includePhoneNumbers: true,
    formInteraction: {
      enabled: false,
      waitTime: 2000, // Default wait time after form submission
    },
    // Default to false, but can be enabled for complex sites
    usePlaywright: false,
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
      let allApiResponses: ApiResponse[] = [];
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

      // If static scraping failed or found no emails, try with dynamic browser rendering
      if (staticScrapingFailed || contacts.length === 0) {
        // First try with Playwright if enabled (better for complex dynamic sites)
        if (this.options.usePlaywright) {
          try {
            console.log(`Using Playwright for ${normalizedUrl}`);
            const playwrightScraper = new PlaywrightScraper();
            const {
              contacts: playwrightContacts,
              apiResponses: playwrightResponses,
            } = await playwrightScraper.scrapeWebsite(
              normalizedUrl,
              this.options
            );
            contacts = [...contacts, ...playwrightContacts];
            console.log(
              `Playwright found ${playwrightContacts.length} contacts`
            );
            allApiResponses = [
              ...allApiResponses,
              ...(playwrightResponses || []),
            ];
          } catch (error) {
            console.warn(
              `Playwright scraping failed for ${normalizedUrl}:`,
              error
            );
            dynamicScrapingFailed = true;
            errorMessages.push(
              `Playwright scraping error: ${
                error instanceof Error ? error.message : String(error)
              }`
            );

            // Fall back to Puppeteer if Playwright fails and Puppeteer is enabled
            if (this.options.useHeadless) {
              try {
                console.log(`Falling back to Puppeteer for ${normalizedUrl}`);
                const {
                  contacts: puppeteerContacts,
                  apiResponses: puppeteerResponses,
                } = await this.scrapeDynamicContent(normalizedUrl);
                contacts = [...contacts, ...puppeteerContacts];
                allApiResponses = [...allApiResponses, ...puppeteerResponses];
              } catch (puppeteerError) {
                console.warn(
                  `Puppeteer scraping failed for ${normalizedUrl}:`,
                  puppeteerError
                );
                errorMessages.push(
                  `Puppeteer scraping error: ${
                    puppeteerError instanceof Error
                      ? puppeteerError.message
                      : String(puppeteerError)
                  }`
                );
              }
            }
          }
        }
        // Otherwise use Puppeteer if enabled
        else if (this.options.useHeadless) {
          try {
            const {
              contacts: puppeteerContacts,
              apiResponses: puppeteerResponses,
            } = await this.scrapeDynamicContent(normalizedUrl);
            contacts = [...contacts, ...puppeteerContacts];
            allApiResponses = [...allApiResponses, ...puppeteerResponses];
          } catch (error) {
            console.warn(
              `Puppeteer scraping failed for ${normalizedUrl}:`,
              error
            );
            dynamicScrapingFailed = true;
            errorMessages.push(
              `Dynamic scraping error: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
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
              const {
                contacts: dynamicContacts,
                apiResponses: dynamicResponses,
              } = await this.scrapeDynamicContent(contactUrl);
              contacts = [...contacts, ...dynamicContacts];
              allApiResponses = [...allApiResponses, ...dynamicResponses];
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
        apiResponses: allApiResponses,
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
  private async scrapeDynamicContent(url: string): Promise<{
    contacts: ScrapedContact[];
    apiResponses: ApiResponse[];
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let browser: any; // Use any as pragmatic solution for type diffs
    try {
      // Check if running on Vercel
      if (process.env.VERCEL === "1") {
        console.log(
          "Vercel environment detected. Launching puppeteer-core with @sparticuz/chromium..."
        );
        const executablePath = await chromium.executablePath();

        if (!executablePath) {
          throw new Error(
            "Could not find Chromium executable via @sparticuz/chromium. Ensure it's correctly deployed on Vercel."
          );
        }

        const launchOptions = {
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: executablePath,
          headless: chromium.headless, // Use headless from sparticuz
        };
        browser = await puppeteerCore.launch(launchOptions);
      } else {
        console.log(
          "Local environment detected. Launching Puppeteer with default settings..."
        );
        // Use the full puppeteer package locally, which manages its own browser download
        const launchOptions = {
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu",
            "--window-size=1920,1080",
            "--disable-blink-features=AutomationControlled",
          ],
        };
        browser = await puppeteerFull.launch(launchOptions);
      }

      // Ensure browser was launched successfully
      if (!browser) {
        throw new Error("Browser instance could not be launched.");
      }

      // Open new page with DevTools opened (helps with capturing network requests)
      const page = await browser.newPage();

      // Explicitly create CDP session to monitor network
      const client = await page.target().createCDPSession();

      // Enable network monitoring
      await client.send("Network.enable");

      // Store captured network data
      const networkResponseData: ApiResponse[] = [];

      // Listen for API response data with proper event
      client.on(
        "Network.responseReceived",
        async (event: Protocol.Network.ResponseReceivedEvent) => {
          try {
            const response = event.response;
            const url = response.url;

            // Look for API endpoints by common patterns
            // This generic approach works for many sites that load data dynamically
            if (
              // Common API URL patterns
              url.includes("/api/") ||
              url.includes("/data/") ||
              url.includes("/search") ||
              url.includes("/find") ||
              url.includes("json") ||
              url.includes("list") ||
              // Content types that likely contain data
              response.mimeType.includes("json") ||
              response.mimeType.includes("application/javascript") ||
              // Any URL parameter that suggests data
              url.includes("query=") ||
              url.includes("q=") ||
              url.includes("filter=") ||
              url.includes("id=")
            ) {
              console.log(`Found potential API endpoint: ${url}`);

              // Get the response body
              const responseBody = await client.send(
                "Network.getResponseBody",
                {
                  requestId: event.requestId,
                }
              );

              // Store the response for later processing
              if (responseBody && responseBody.body) {
                networkResponseData.push({
                  url,
                  content: responseBody.body,
                  contentType: response.mimeType || "",
                });
                console.log(`Captured API data from: ${url}`);
              }
            }
          } catch (error) {
            console.warn("Error intercepting network response:", error);
          }
        }
      );

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

      // Handle form interactions if enabled
      if (this.options.formInteraction?.enabled) {
        console.log("Form interaction is enabled, processing form...");
        try {
          // Store reference to formInteraction to avoid TypeScript errors
          const formInteraction = this.options.formInteraction;

          // Fill form fields if provided
          if (formInteraction.fields && formInteraction.fields.length > 0) {
            for (const field of formInteraction.fields) {
              // Wait for the field to be available
              await page.waitForSelector(field.selector, { timeout: 5000 });

              // Handle different field types
              switch (field.type) {
                case "text":
                  await page.type(field.selector, field.value);
                  break;
                case "select":
                  await page.select(field.selector, field.value);
                  break;
                case "checkbox":
                  if (field.value === "true") {
                    await page.click(field.selector);
                  }
                  break;
                case "radio":
                  await page.click(field.selector);
                  break;
              }

              // Small delay between interactions to appear more human-like
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
          }

          // Click submit button if provided
          if (formInteraction.submitButtonSelector) {
            await page.waitForSelector(formInteraction.submitButtonSelector, {
              timeout: 5000,
            });
            await page.click(formInteraction.submitButtonSelector);

            // Wait for results to load
            if (formInteraction.waitForSelector) {
              // Wait for a specific element to appear
              await page.waitForSelector(formInteraction.waitForSelector, {
                timeout: this.options.timeout || 30000,
              });
            } else {
              // Default wait time after submission
              await new Promise((resolve) =>
                setTimeout(resolve, formInteraction.waitTime || 2000)
              );
            }

            console.log("Form submitted and waited for results");
          }
        } catch (error) {
          console.warn("Form interaction failed:", error);
        }
      }

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

      // Also extract emails from API responses
      let apiContent = "";
      console.log(
        `Processing ${networkResponseData.length} captured API responses`
      );

      for (const response of networkResponseData) {
        try {
          console.log(`Processing response from: ${response.url}`);

          // Only attempt to parse if content type suggests JSON
          if (
            response.contentType &&
            (response.contentType.includes("application/json") ||
              response.contentType.includes("text/javascript")) // Sometimes JSON is served as JS
          ) {
            try {
              // Try parsing as JSON, handling any potential format
              const jsonData = JSON.parse(response.content);
              console.log("API response parsed successfully as JSON");

              // For debugging
              console.log(
                "API response contains:",
                Object.keys(jsonData).join(", ")
              );

              // Enhanced generic processing of API responses to handle any JSON structure
              console.log("Processing API response using universal extractor");

              // Use our new method to extract data from any JSON structure
              const extractedData = extractDataFromJson(jsonData);

              // Add any found emails to our collection
              if (extractedData.emails.length > 0) {
                console.log(
                  `Found ${extractedData.emails.length} emails in API response`
                );
                emails.push(...extractedData.emails);
              }

              // Add context information from the JSON data
              apiContent += extractedData.contextText;

              // Also log phone numbers found, which will be included in the context
              if (extractedData.phoneNumbers.length > 0) {
                console.log(
                  `Found ${extractedData.phoneNumbers.length} phone numbers in API response`
                );
              }

              // Log discovered URLs which could be followed for additional information
              if (extractedData.urls.length > 0) {
                console.log(
                  `Found ${extractedData.urls.length} URLs in API response`
                );
              }
            } catch (parseError) {
              // Log if parsing fails even if content type looked like JSON
              console.warn(
                `Failed to parse response from ${response.url} as JSON, even though content type was ${response.contentType}:`,
                parseError
              );
            }
          } else {
            // Log skipping responses that are not JSON
            console.log(
              `Skipping non-JSON response from ${response.url} (Content-Type: ${response.contentType})`
            );
          }
        } catch (outerError) {
          // Catch any unexpected errors during the processing of a single response
          console.error(
            `Unexpected error processing response from ${response.url}:`,
            outerError
          );
        }
      }

      // Combine page content with API content for context extraction
      const combinedContent = content + "\n" + apiContent;

      // Process the extracted data (remove duplicates in processContactData)
      const contacts = processContactData(
        emails,
        combinedContent,
        url,
        this.options.includePhoneNumbers
      );

      // Return both contacts and the captured API responses
      return { contacts, apiResponses: networkResponseData };
    } catch (error) {
      console.error(`Error scraping dynamic content from ${url}:`, error);
      // Return empty results in case of error
      return { contacts: [], apiResponses: [] };
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

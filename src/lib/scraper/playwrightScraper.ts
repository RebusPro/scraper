/**
 * Playwright-based scraper for handling complex dynamic websites
 */
import { chromium, firefox, webkit, Browser, Page, Response } from "playwright";
import { extractEmails, processContactData } from "./emailExtractor";
import { extractDataFromJson } from "./jsonExtractor";
import { ScrapedContact, ScrapingOptions, FormInteraction } from "./types";

export class PlaywrightScraper {
  /**
   * Scrape a website using Playwright
   */
  async scrapeWebsite(
    url: string,
    options: ScrapingOptions
  ): Promise<ScrapedContact[]> {
    let browser: Browser | null = null;

    try {
      // Choose browser type (chromium, firefox, or webkit)
      const browserType = options.browserType || "chromium";
      const launchOptions = {
        headless: true,
        args: [
          "--disable-web-security",
          "--disable-features=IsolateOrigins,site-per-process",
        ],
      };

      // Launch browser based on type
      switch (browserType) {
        case "firefox":
          browser = await firefox.launch(launchOptions);
          break;
        case "webkit":
          browser = await webkit.launch(launchOptions);
          break;
        default:
          browser = await chromium.launch(launchOptions);
      }

      // Create a browser context with realistic settings
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
        locale: "en-US",
        deviceScaleFactor: 1,
        hasTouch: false,
        javaScriptEnabled: true,
        // Make fingerprinting more realistic
        bypassCSP: true,
      });

      // Enable request/response monitoring
      const apiResponses: {
        url: string;
        content: string;
        contentType: string;
      }[] = [];

      context.on("response", async (response: Response) => {
        const url = response.url();
        const contentType = response.headers()["content-type"] || "";

        // Similar to your Puppeteer implementation, capture API responses
        if (
          url.includes("/api/") ||
          url.includes("/data/") ||
          url.includes("/search") ||
          url.includes("/find") ||
          url.includes("json") ||
          url.includes("list") ||
          contentType.includes("json") ||
          contentType.includes("javascript") ||
          url.includes("query=") ||
          url.includes("q=") ||
          url.includes("filter=") ||
          url.includes("id=")
        ) {
          try {
            // Only try to get text for responses that are likely to have text content
            if (
              contentType.includes("json") ||
              contentType.includes("javascript") ||
              contentType.includes("text")
            ) {
              const text = await response.text().catch(() => "");
              if (text) {
                apiResponses.push({
                  url,
                  content: text,
                  contentType,
                });
                console.log(`Captured API data from: ${url}`);
              }
            }
          } catch (error) {
            console.warn(`Error processing response from ${url}:`, error);
          }
        }
      });

      // Create a new page
      const page = await context.newPage();

      // Set default timeout
      page.setDefaultTimeout(options.timeout || 30000);

      // Navigate to URL with more reliable wait strategy
      await page.goto(url, {
        waitUntil: "domcontentloaded", // Start with faster load state
        timeout: options.timeout || 30000,
      });

      // Wait for network to be mostly idle for better loading of dynamic content
      await page
        .waitForLoadState("networkidle", {
          timeout: options.timeout || 30000,
        })
        .catch(() => {
          console.log("Timed out waiting for network idle, continuing anyway");
        });

      // Special handling for specific site types
      if (url.includes("fandom.com") || url.includes("wiki")) {
        console.log("Wiki page detected - applying special handling");
        await this.handleWikiPage(page);
      }

      // Handle form interaction if enabled
      if (options.formInteraction?.enabled) {
        await this.handleFormInteraction(page, options.formInteraction);
      }

      // Scroll through the page to trigger lazy loading
      await this.scrollPage(page);

      // Get page content
      const content = await page.content();

      // Extract emails directly from page content
      const pageEmails = extractEmails(content);

      // Process API responses to extract additional data
      let apiContent = "";
      const apiEmails: string[] = [];

      console.log(`Processing ${apiResponses.length} captured API responses`);

      for (const response of apiResponses) {
        try {
          // Try parsing as JSON
          const jsonData = JSON.parse(response.content);

          // Extract data from JSON
          const extractedData = extractDataFromJson(jsonData);

          // Add emails and context
          apiEmails.push(...extractedData.emails);
          apiContent += extractedData.contextText;
        } catch {
          // If JSON parsing fails, just extract emails directly
          const responseEmails = extractEmails(response.content);
          apiEmails.push(...responseEmails);
        }
      }

      // Combine page and API emails
      const allEmails = [...new Set([...pageEmails, ...apiEmails])];

      // Combine content for context
      const combinedContent = content + "\n" + apiContent;

      // Process contact data
      return processContactData(
        allEmails,
        combinedContent,
        url,
        options.includePhoneNumbers
      );
    } catch (error) {
      console.error(`Error in Playwright scraper for ${url}:`, error);
      return [];
    } finally {
      // Clean up
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Handle form interactions with Playwright
   */
  private async handleFormInteraction(
    page: Page,
    formInteraction: FormInteraction
  ): Promise<void> {
    try {
      console.log("Handling form interaction with Playwright");

      // Fill form fields if provided
      if (formInteraction.fields && formInteraction.fields.length > 0) {
        for (const field of formInteraction.fields) {
          try {
            // Wait for the field to be visible - Playwright has better waiting
            await page.waitForSelector(field.selector, {
              state: "visible",
              timeout: 5000,
            });

            // Handle different field types
            switch (field.type) {
              case "text":
                // Clear field first for more reliable input
                await page.click(field.selector, { clickCount: 3 }); // Triple click to select all
                await page.keyboard.press("Backspace");
                await page.fill(field.selector, field.value);
                break;
              case "select":
                await page.selectOption(field.selector, field.value);
                break;
              case "checkbox":
                if (field.value === "true") {
                  // Check if already checked
                  const isChecked = await page
                    .$eval(field.selector, (el: HTMLInputElement) => el.checked)
                    .catch(() => false);

                  if (!isChecked) {
                    await page.click(field.selector);
                  }
                }
                break;
              case "radio":
                await page.click(field.selector);
                break;
            }

            // Small delay between field interactions
            await page.waitForTimeout(300);
          } catch (error) {
            console.warn(
              `Error interacting with field ${field.selector}:`,
              error
            );
          }
        }
      }

      // Click submit button if provided
      if (formInteraction.submitButtonSelector) {
        try {
          // Wait for the button with better strategy
          await page.waitForSelector(formInteraction.submitButtonSelector, {
            state: "visible",
            timeout: 5000,
          });

          // Click the button
          await page.click(formInteraction.submitButtonSelector);

          console.log("Form submitted, waiting for results...");

          // Wait for results to load with better strategies
          if (formInteraction.waitForSelector) {
            // First wait for navigation or network to settle a bit
            await Promise.race([
              page
                .waitForNavigation({ waitUntil: "networkidle" })
                .catch(() => {}),
              page.waitForTimeout(1000),
            ]);

            // Then wait for the specific selector
            await page.waitForSelector(formInteraction.waitForSelector, {
              state: "visible",
              timeout: formInteraction.waitTime || 10000,
            });

            console.log(
              `Successfully found result selector: ${formInteraction.waitForSelector}`
            );
          } else {
            // If no selector, wait for network to be quiet and then additional time
            await page
              .waitForLoadState("networkidle", {
                timeout: formInteraction.waitTime || 5000,
              })
              .catch(() => {});

            // Additional wait time after network idle
            await page.waitForTimeout(formInteraction.waitTime || 2000);
          }
        } catch (error) {
          console.warn("Error with form submission:", error);
        }
      }
    } catch (error) {
      console.error("Form interaction failed:", error);
    }
  }

  /**
   * Scroll through the page to load lazy content
   */
  private async scrollPage(page: Page): Promise<void> {
    try {
      // Get page height
      const pageHeight = await page.evaluate(() => document.body.scrollHeight);

      // Scroll in smaller increments
      const scrollStep = Math.floor(pageHeight / 10);

      for (let i = 0; i < 10; i++) {
        await page.evaluate((scrollY: number) => {
          window.scrollTo(0, scrollY);
        }, i * scrollStep);

        // Short pause between scrolls
        await page.waitForTimeout(200);
      }

      // Scroll back to top
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
    } catch (error) {
      console.warn("Error during page scrolling:", error);
    }
  }

  /**
   * Special handling for wiki pages (including Fandom wikis)
   */
  private async handleWikiPage(page: Page): Promise<void> {
    try {
      console.log("Applying wiki-specific extraction strategies");

      // Ensure all collapsible sections are expanded
      await page.evaluate(() => {
        // Expand any collapsed sections (common in wikis)
        document
          .querySelectorAll(".collapsible:not(.expanded)")
          .forEach((el) => {
            (el as HTMLElement).click();
          });

        // Expand any "show more" or "read more" buttons
        ["show more", "read more", "expand", "view"].forEach((text) => {
          document
            .querySelectorAll(
              `a, button, .${text}, #${text}, [aria-label*="${text}" i]`
            )
            .forEach((el) => {
              if (el.textContent?.toLowerCase().includes(text)) {
                (el as HTMLElement).click();
              }
            });
        });

        return true;
      });

      // Small delay to let expanded content load
      await page.waitForTimeout(1000);

      // Look specifically for tables which often contain contact info in wikis
      const tableSelector =
        "table.wikitable, table.infobox, .infobox, table.mw-datatable";
      const hasTables = await page.$(tableSelector).then(Boolean);

      if (hasTables) {
        console.log("Found tables in wiki - examining for contacts");
        // Click to expand any collapsed table rows
        await page.evaluate((selector) => {
          document
            .querySelectorAll(`${selector} .mw-collapsible:not(.mw-expanded)`)
            .forEach((el) => {
              (el as HTMLElement).click();
            });
        }, tableSelector);

        // Additional delay for table expansions
        await page.waitForTimeout(500);
      }

      // Check for reference sections which often contain contact links
      const hasReferences = await page
        .$(
          "#References, #references, .references, #External_links, #external-links"
        )
        .then(Boolean);

      if (hasReferences) {
        console.log("Found references section - examining for contact links");
        // Ensure reference content is loaded
        await page.evaluate(() => {
          document
            .querySelectorAll(
              ".reference, .reflist, .references, #References, #references"
            )
            .forEach((el) => {
              el.scrollIntoView();
            });
        });

        // Wait for any dynamically loaded reference content
        await page.waitForTimeout(500);
      }
    } catch (error) {
      console.warn("Error during wiki-specific handling:", error);
    }
  }
}

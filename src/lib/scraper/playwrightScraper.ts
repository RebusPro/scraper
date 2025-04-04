/**
 * Enhanced Playwright-based scraper for handling complex dynamic websites
 * and coach directories
 */
import { chromium, firefox, webkit, Browser, Page, Response } from "playwright";
import { extractEmails, processContactData } from "./emailExtractor";
import { extractDataFromJson } from "./jsonExtractor";
import { ScrapedContact, ScrapingOptions, FormInteraction } from "./types";

export class PlaywrightScraper {
  /**
   * Scrape a website using Playwright with enhanced handling
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
          // Additional flags to improve stability and bypass detection
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
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

        // Enhanced API response detection
        if (
          url.includes("/api/") ||
          url.includes("/data/") ||
          url.includes("/search") ||
          url.includes("/find") ||
          url.includes("json") ||
          url.includes("list") ||
          url.includes("coaches") ||
          url.includes("staff") ||
          url.includes("team") ||
          url.includes("directory") ||
          url.includes("people") ||
          url.includes("contacts") ||
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
              contentType.includes("text") ||
              !contentType // Sometimes API responses don't specify content type
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

      // Set default timeout (increased for complex pages)
      page.setDefaultTimeout(options.timeout || 60000);

      // Navigate to URL with more reliable wait strategy
      await page.goto(url, {
        waitUntil: "domcontentloaded", // Start with faster load state
        timeout: options.timeout || 60000,
      });

      // Wait for network to be mostly idle for better loading of dynamic content
      await page
        .waitForLoadState("networkidle", {
          timeout: options.timeout || 60000,
        })
        .catch(() => {
          console.log("Timed out waiting for network idle, continuing anyway");
        });

      // Enhanced site-specific handling
      if (this.isCoachDirectory(url)) {
        console.log("Coach directory detected - applying special handling");
        await this.handleCoachDirectory(page, url);
      } else if (url.includes("fandom.com") || url.includes("wiki")) {
        console.log("Wiki page detected - applying special handling");
        await this.handleWikiPage(page);
      }

      // Handle form interaction if enabled
      if (options.formInteraction?.enabled) {
        await this.handleFormInteraction(page, options.formInteraction);
      }

      // Enhanced scrolling and interaction for dynamic content
      await this.enhancedPageInteraction(page);

      // Get page content
      const content = await page.content();

      // Get any text that might be hidden in shadow DOM or iframes
      const hiddenContent = await this.extractHiddenContent(page);

      // Combined content including shadow DOM and iframe content
      const fullContent = content + "\n" + hiddenContent;

      // Extract emails directly from page content
      const pageEmails = extractEmails(fullContent);

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
      const combinedContent = fullContent + "\n" + apiContent;

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
   * Detect if the page is likely a coach directory
   */
  private isCoachDirectory(url: string): boolean {
    const directoryKeywords = [
      "coach",
      "coaches",
      "staff",
      "team",
      "directory",
      "skating",
      "hockey",
      "faculty",
      "personnel",
      "instructors",
      "trainers",
    ];

    const lowerUrl = url.toLowerCase();
    return directoryKeywords.some((keyword) => lowerUrl.includes(keyword));
  }

  /**
   * Special handling for coach directories
   */
  private async handleCoachDirectory(page: Page, url: string): Promise<void> {
    try {
      console.log("Applying coach directory-specific extraction strategies");

      // Check if this is the hockey.travelsports.com site
      if (url.includes("hockey.travelsports.com")) {
        await this.handleTravelSportsSite(page);
        return;
      }

      // Look for and click "Load More" or pagination buttons
      await page.evaluate(() => {
        // Common patterns for "load more" buttons
        const loadMorePatterns = [
          "load more",
          "show more",
          "view more",
          "more results",
          "next page",
          "see all",
          "show all",
          "view all",
        ];

        // Find and click load more buttons
        loadMorePatterns.forEach((pattern) => {
          document
            .querySelectorAll('button, a, .btn, [role="button"]')
            .forEach((el) => {
              if (el.textContent?.toLowerCase().includes(pattern)) {
                (el as HTMLElement).click();
              }
            });
        });

        // Expand collapsed sections
        document
          .querySelectorAll(
            '.collapse:not(.show), .collapsed, [aria-expanded="false"]'
          )
          .forEach((el) => {
            try {
              (el as HTMLElement).click();
            } catch (e) {
              // Ignore errors if element is not clickable
            }
          });
      });

      // Wait a moment for content to load
      await page.waitForTimeout(2000);

      // Specially handle common coach profile layouts
      await page.evaluate(() => {
        // Find and click coach profile cards that might reveal more details
        document
          .querySelectorAll(
            ".coach, .staff, .profile, .card, .member, .instructor"
          )
          .forEach((el) => {
            try {
              // Some sites show details on hover
              const event = new MouseEvent("mouseover", {
                view: window,
                bubbles: true,
                cancelable: true,
              });
              el.dispatchEvent(event);

              // Try to find and click any detail links
              const detailLinks = el.querySelectorAll("a");
              detailLinks.forEach((link) => {
                if (
                  link.textContent?.toLowerCase().includes("detail") ||
                  link.textContent?.toLowerCase().includes("profile") ||
                  link.textContent?.toLowerCase().includes("more") ||
                  link.textContent?.toLowerCase().includes("view")
                ) {
                  (link as HTMLElement).click();
                }
              });
            } catch (e) {
              // Ignore errors
            }
          });
      });

      // Wait for any modals or popups
      await page.waitForTimeout(1500);
    } catch (error) {
      console.warn("Error during coach directory handling:", error);
    }
  }

  /**
   * Special handling for Travel Sports Coach Directory
   */
  private async handleTravelSportsSite(page: Page): Promise<void> {
    try {
      console.log("Applying special handling for Travel Sports site");

      // First try to find and interact with any filter dropdowns
      await page.evaluate(() => {
        document
          .querySelectorAll('select, .dropdown, [role="combobox"]')
          .forEach((el) => {
            try {
              // Click to open dropdown
              (el as HTMLElement).click();
              // Wait briefly
              setTimeout(() => {
                // Select an option if available
                const options = el.querySelectorAll("option, .dropdown-item");
                if (options.length > 0) {
                  // Select a non-default option if available
                  const optionToSelect =
                    options.length > 1 ? options[1] : options[0];
                  (optionToSelect as HTMLElement).click();
                }
              }, 500);
            } catch (e) {
              // Ignore errors
            }
          });
      });

      // Wait for filters to apply
      await page.waitForTimeout(2000);

      // For hockey.travelsports.com specifically, extract emails from coach links
      if (await page.$('a[href*="coaches/"]')) {
        // Get all coach links
        const coachLinks = await page.$$eval(
          'a[href*="coaches/"]',
          (links) =>
            links.map((a) => a.getAttribute("href")).filter(Boolean) as string[]
        );

        console.log(`Found ${coachLinks.length} coach profile links`);

        // Visit first few coach profile pages
        const maxProfilesToVisit = Math.min(5, coachLinks.length);
        for (let i = 0; i < maxProfilesToVisit; i++) {
          try {
            const link = coachLinks[i];
            // Make sure it's a valid relative URL
            if (link && !link.startsWith("http")) {
              // Construct absolute URL
              const baseUrl = new URL(page.url()).origin;
              const absoluteUrl = new URL(link, baseUrl).href;

              console.log(`Visiting coach profile: ${absoluteUrl}`);

              // Open in a new page
              const coachPage = await page.context().newPage();
              await coachPage.goto(absoluteUrl, {
                waitUntil: "domcontentloaded",
              });
              await coachPage.waitForTimeout(2000);

              // Close the coach profile page
              await coachPage.close();
            }
          } catch (err) {
            console.warn(`Error visiting coach profile: ${err}`);
          }
        }
      }
    } catch (error) {
      console.warn("Error handling Travel Sports site:", error);
    }
  }

  /**
   * Extract content from shadow DOM and iframes
   */
  private async extractHiddenContent(page: Page): Promise<string> {
    try {
      // Extract text from shadow DOM elements
      const shadowContent = await page.evaluate(() => {
        let content = "";
        // Find all elements that might have shadow roots
        document.querySelectorAll("*").forEach((el) => {
          if (el.shadowRoot) {
            content += el.shadowRoot.textContent + " ";
          }
        });
        return content;
      });

      // Extract text from iframes
      let iframeContent = "";
      const frames = page.frames();
      for (const frame of frames) {
        if (frame !== page.mainFrame()) {
          try {
            // Get text content from iframe
            const frameText = await frame.evaluate(
              () => document.body.textContent || ""
            );
            iframeContent += frameText + " ";
          } catch (err) {
            // Ignore cross-origin iframe errors
          }
        }
      }

      return shadowContent + iframeContent;
    } catch (error) {
      console.warn("Error extracting hidden content:", error);
      return "";
    }
  }

  /**
   * Enhanced page interaction to better find hidden elements and dynamic content
   */
  private async enhancedPageInteraction(page: Page): Promise<void> {
    try {
      // First perform regular scrolling
      await this.scrollPage(page);

      // Check for and execute data-loading techniques
      await page.evaluate(() => {
        // Common patterns for dynamically revealing emails to protect from scrapers
        const revealSelectors = [
          ".email-hidden",
          ".protect-email",
          ".encrypted-email",
          ".obscured-email",
          "[data-email]",
          "[data-mail]",
          "[data-contact]",
          ".email-protection",
          ".email",
          ".js-email",
          ".mail",
        ];

        // Try to click on email reveal elements
        revealSelectors.forEach((selector) => {
          document.querySelectorAll(selector).forEach((el) => {
            try {
              (el as HTMLElement).click();
            } catch (e) {
              // Ignore errors
            }
          });
        });

        // Try to reveal anti-bot protected emails (common technique)
        document.querySelectorAll("a").forEach((link) => {
          try {
            // Look for "mailto:" links with obfuscation
            const href = link.getAttribute("href");
            if (
              href &&
              (href.includes("javascript:") ||
                href.includes("linkTo_UnCryptMailto"))
            ) {
              (link as HTMLElement).click();
            }

            // Check for data attributes that might hold email parts
            const dataEmail = link.getAttribute("data-email");
            if (dataEmail) {
              link.textContent = dataEmail;
            }
          } catch (e) {
            // Ignore errors
          }
        });

        // Try to trigger mouseover events (some sites reveal emails on hover)
        document
          .querySelectorAll(
            ".contact, .profile, .staff, .faculty, .coach, .team-member"
          )
          .forEach((el) => {
            try {
              const event = new MouseEvent("mouseover", {
                view: window,
                bubbles: true,
                cancelable: true,
              });
              el.dispatchEvent(event);
            } catch (e) {
              // Ignore errors
            }
          });
      });

      // Wait a bit for any triggered changes
      await page.waitForTimeout(1000);

      // Look for contact links and pages
      const contactLinks = await page.$$(
        'a[href*="contact"], a[href*="staff"], a[href*="about"], a[href*="team"]'
      );

      // Click on up to 2 contact-related links if found
      const maxLinksToClick = Math.min(2, contactLinks.length);
      for (let i = 0; i < maxLinksToClick; i++) {
        try {
          await contactLinks[i].click();
          await page.waitForTimeout(2000);
          // Go back to original page
          await page.goBack();
          await page.waitForTimeout(1000);
        } catch (err) {
          // Ignore navigation errors
        }
      }
    } catch (error) {
      console.warn("Error during enhanced page interaction:", error);
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

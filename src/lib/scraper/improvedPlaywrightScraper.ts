/**
 * Improved Playwright-based web scraper with enhanced email extraction
 * Integrates with the enhanced email extractor for better results
 */
import { ScrapedContact, ScrapingOptions } from "./types";
import { extractEmails, processContactData } from "./emailExtractor";
import {
  chromium as playwrightChromium,
  Browser,
  BrowserContext,
} from "playwright";
import { extractObfuscatedEmails } from "./enhancedEmailExtractor";
import chromium from "@sparticuz/chromium";

// --- Keyword Definitions for Prioritization (User Specified) ---
const COACH_KEYWORDS = [
  "coach",
  "staff",
  "directory",
  "instructor",
  "trainer",
  "team",
  "roster",
  "personnel",
  "faculty",
  "bios",
];
const CONTACT_KEYWORDS = [
  "contact",
  "kontakt",
  "contacto",
  "about",
  "info",
  "location",
  "connect",
  "reach",
  "touch",
];
const SKATING_KEYWORDS = [
  "skat", // skate, skating
  "lesson",
  "program",
  "class",
  "private",
  "training",
  "registration",
  "schedule",
  "level",
  "hockey",
  "figure", // figure skating
  "learn", // learn-to-skate
  "camp",
  "clinic",
];

// --- Priorities ---
const PRIORITY = {
  // Lower number = higher priority
  INITIAL: 0, // The starting URL itself
  COACH: 1,
  CONTACT: 2,
  SKATING: 3,
  OTHER: 4,
};

// --- Helper Function to Get Priority ---
const getLinkPriority = (url: string, text: string): number => {
  const lowerUrl = url.toLowerCase();
  const lowerText = text ? text.toLowerCase() : ""; // Handle potentially null text
  // Check in order of priority
  if (
    COACH_KEYWORDS.some((k) => lowerUrl.includes(k) || lowerText.includes(k))
  ) {
    return PRIORITY.COACH;
  }
  if (
    CONTACT_KEYWORDS.some((k) => lowerUrl.includes(k) || lowerText.includes(k))
  ) {
    return PRIORITY.CONTACT;
  }
  if (
    SKATING_KEYWORDS.some((k) => lowerUrl.includes(k) || lowerText.includes(k))
  ) {
    return PRIORITY.SKATING;
  }
  return PRIORITY.OTHER;
};

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
    const mode = options.mode ?? "standard";
    const timeout = options.timeout ?? 30000; // Default timeout

    // Set depth, pages and links based on mode
    let maxDepth, maxPages, followLinks;

    if (mode === "aggressive") {
      maxDepth = options.maxDepth ?? 3;
      maxPages = options.maxPages ?? 20; // Aggressive page limit
      followLinks = options.followLinks ?? true;
    } else if (mode === "standard") {
      maxDepth = options.maxDepth ?? 2;
      maxPages = options.maxPages ?? 10; // Changed standard limit from 5 to 10
      followLinks = options.followLinks ?? true;
    } else {
      // Gentle mode
      maxDepth = options.maxDepth ?? 0;
      maxPages = options.maxPages ?? 1;
      followLinks = options.followLinks ?? false;
    }

    // Check if we're in light mode for super fast extraction
    if (options.mode === "gentle") {
      console.log("Using super fast extraction for light mode");
      return await this.fastExtractEmails(url, timeout);
    }

    console.log(
      `Using standard extraction with maxDepth=${maxDepth}, maxPages=${maxPages}`
    );

    const allContacts: ScrapedContact[] = [];
    const visitedUrls = new Set<string>();
    const pendingUrls: { url: string; depth: number; priority: number }[] = [
      { url, depth: 0, priority: PRIORITY.INITIAL },
    ];
    let pagesVisited = 0;
    let context: BrowserContext | null = null;

    // <<< ADDED: Overall Job Timeout Logic >>>
    const jobStartTime = Date.now();
    // Use worker timeout if passed, default to slightly less than common queue message visibility timeouts (e.g., 5 mins)
    const jobTimeout = options.timeout ?? 600000; // Default 5 minutes (300,000 ms)
    console.log(
      `WORKER_BACKGROUND: Overall job timeout set to ${
        jobTimeout / 1000
      } seconds.`
    );
    // <<< END ADDED >>>

    try {
      // Create browser if not already created
      if (!this.browser) {
        let launchOptions: Parameters<typeof playwrightChromium.launch>[0] = {
          headless: options.useHeadless ?? true, // Respect option locally, default true
        };

        // Check if running on Vercel OR Google Cloud Run
        const isServerless =
          process.env.VERCEL === "1" || process.env.K_SERVICE;

        if (isServerless) {
          console.log(
            "SCRAPER_DEBUG: Serverless environment (Vercel or Cloud Run) detected. Preparing sparticuz launch options..."
          );

          // <<< Log before executablePath >>>
          console.log("SCRAPER_DEBUG: Calling chromium.executablePath()...");
          let executablePath: string | null = null; // Initialize as null
          try {
            executablePath = await chromium.executablePath();
            // <<< Log after executablePath success >>>
            console.log(
              `SCRAPER_DEBUG: chromium.executablePath() returned: ${executablePath}`
            );
          } catch (err) {
            console.error(
              "SCRAPER_ERROR: Failed to get executablePath from sparticuz:",
              err
            );
            throw err; // Rethrow
          }

          if (!executablePath) {
            throw new Error(
              "Could not find Chromium executable via @sparticuz/chromium. Check deployment."
            );
          }
          // Use sparticuz chromium options in serverless environments
          launchOptions = {
            args: chromium.args,
            executablePath: executablePath,
            headless: true, // Force headless in serverless
          };
          console.log(
            "SCRAPER_DEBUG: Serverless env - sparticuz launch options prepared:" +
              JSON.stringify(launchOptions)
          );
        } else {
          console.log(
            "SCRAPER_DEBUG: Local env - preparing default launch options..."
          );
          // No specific executablePath needed locally for default playwright install
        }

        console.log(
          "SCRAPER_DEBUG: Launching browser with options:",
          JSON.stringify(launchOptions)
        ); // Log options

        // <<< Log before launch >>>
        console.log("SCRAPER_DEBUG: Calling playwrightChromium.launch()...");
        try {
          this.browser = await playwrightChromium.launch(launchOptions);
          // <<< Log after launch success >>>
          console.log("SCRAPER_DEBUG: playwrightChromium.launch() successful.");
        } catch (launchError) {
          console.error(
            "SCRAPER_FATAL_ERROR: Failed to launch browser:",
            launchError
          );
          throw launchError; // Re-throw the error to be caught by the outer handler
        }
      }

      // Create context with default configuration
      console.log("SCRAPER_DEBUG: Creating browser context...");
      context = await this.browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
        viewport: { width: 1280, height: 800 },
        javaScriptEnabled: true,
      });
      console.log("SCRAPER_DEBUG: Browser context created.");

      // Create a new page
      console.log("SCRAPER_DEBUG: Creating new page...");
      const page = await context.newPage();
      console.log("SCRAPER_DEBUG: New page created.");

      // Process URLs in queue (with page limit)
      while (pendingUrls.length > 0 && pagesVisited < maxPages) {
        // <<< ADDED: Overall Job Timeout Check >>>
        const elapsedTime = Date.now() - jobStartTime;
        if (elapsedTime >= jobTimeout) {
          console.warn(
            `WORKER_BACKGROUND_WARN: Overall job timeout (${
              jobTimeout / 1000
            }s) exceeded. Stopping scrape. Pages visited: ${pagesVisited}. Queue size: ${
              pendingUrls.length
            }.`
          );
          break; // Exit the main processing loop
        }
        // <<< END ADDED >>>

        // ** SORT QUEUE BY PRIORITY **
        pendingUrls.sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority; // Lower priority number first
          }
          return a.depth - b.depth; // Then lower depth first
        });

        const { url: currentUrl, depth } = pendingUrls.shift()!;
        if (visitedUrls.has(currentUrl)) continue;

        console.log(
          `SCRAPER_DEBUG: Starting processing loop for URL: ${currentUrl} (Depth: ${depth}) (${
            pagesVisited + 1
          }/${maxPages})`
        );
        pagesVisited++;
        visitedUrls.add(currentUrl);

        // Skip non-http URLs and known file types that don't contain emails
        if (
          !currentUrl.startsWith("http") ||
          currentUrl.endsWith(".pdf") ||
          currentUrl.endsWith(".zip") ||
          currentUrl.endsWith(".jpg") ||
          currentUrl.endsWith(".png") ||
          currentUrl.endsWith(".gif") ||
          currentUrl.includes("?format=json") || // API requests
          currentUrl.includes("/api/") ||
          currentUrl.includes("/admin/")
        ) {
          continue;
        }

        // Skip URLs with more than 3 query parameters
        const queryParams = currentUrl.split("?")[1]?.split("&") || [];
        if (queryParams.length > 3) {
          continue;
        }

        try {
          // Navigate to the page with retry logic
          const maxRetries = 2;
          let retryCount = 0;
          let success = false;

          while (!success && retryCount < maxRetries) {
            try {
              console.log(
                `SCRAPER_DEBUG: Attempting page.goto for ${currentUrl} (Retry: ${retryCount})...`
              );
              await page.goto(currentUrl, {
                waitUntil: "load",
                timeout: 60000,
              });
              console.log(
                `SCRAPER_DEBUG: page.goto successful for ${currentUrl}.`
              );
              success = true;
            } catch (error) {
              console.log(
                `Retry ${
                  retryCount + 1
                }/${maxRetries} for ${currentUrl} failed: ${
                  error instanceof Error ? error.message.split("\n")[0] : error
                }`
              );
              retryCount++;
              if (retryCount >= maxRetries) {
                console.error(
                  `SCRAPER_ERROR: All navigation retries failed for ${currentUrl}. Skipping page.`
                );
                throw error;
              }
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * retryCount)
              );
            }
          }

          if (success) {
            console.log(
              `SCRAPER_DEBUG: Attempting short network idle wait (max 3s)...`
            );
            try {
              await page.waitForLoadState("networkidle", { timeout: 3000 });
              console.log(`SCRAPER_DEBUG: Network idle finished or timed out.`);
            } catch (idleError) {
              console.log(
                `SCRAPER_DEBUG: Network idle wait failed (expected sometimes): ${
                  idleError instanceof Error
                    ? idleError.message.split("\n")[0]
                    : idleError
                }`
              );
            }
          }

          // Check for obvious contact links if we're on the main page
          const isMainPage = (url: string): boolean => {
            const parsedUrl = new URL(url);
            return (
              parsedUrl.pathname === "/" ||
              parsedUrl.pathname === "" ||
              parsedUrl.pathname === "/index.html" ||
              parsedUrl.pathname === "/index.php" ||
              parsedUrl.pathname.endsWith("/home")
            );
          };

          if (isMainPage(currentUrl)) {
            // Try to find and visit contact pages
            try {
              console.log("Looking for contact page links...");

              // Look for contact page links
              const contactLinks = await page.evaluate(() => {
                const links: string[] = [];

                // Common contact page selectors
                const contactSelectors = [
                  // Direct contact page links
                  "a[href*='contact']",
                  "a[href*='kontakt']", // German
                  "a[href*='contacto']", // Spanish
                  "a[href*='get-in-touch']",
                  "a[href*='reach-us']",
                  "a[href*='connect']",
                  "a[href*='email']",
                  "a[href*='mail']",
                  // About pages that often contain contact info
                  "a[href*='about-us']",
                  "a[href*='about']",
                  "a[href*='team']",
                  "a[href*='staff']",
                  "a[href*='people']",
                  "a[href*='join']",
                  // Common specific paths
                  "a[href='/contact']",
                  "a[href='/about']",
                  "a[href='/contact-us']",
                  "a[href='/team']",
                  // Menu items that may contain contact links
                  ".menu a[href*='contact']",
                  ".navigation a[href*='contact']",
                  ".nav a[href*='contact']",
                  "nav a[href*='contact']",
                  "header a[href*='contact']",
                  "footer a[href*='contact']",
                ];

                // Find all potential contact links
                contactSelectors.forEach((selector) => {
                  document.querySelectorAll(selector).forEach((link) => {
                    const href = link.getAttribute("href");
                    if (href) links.push(href);
                  });
                });

                return [...new Set(links)]; // Remove duplicates
              });

              // Visit each contact page and extract emails
              if (contactLinks.length > 0) {
                console.log(
                  `Found ${contactLinks.length} potential contact page links`
                );

                for (const link of contactLinks.slice(0, 2)) {
                  // Limit to first 2 links for speed
                  try {
                    // Resolve relative URLs
                    const absoluteUrl = new URL(link, currentUrl).href;

                    // Skip if it's the current page
                    if (absoluteUrl === currentUrl) continue;

                    console.log(
                      `Visiting potential contact page: ${absoluteUrl}`
                    );

                    // Check if it's a mailto: link - we can't navigate to these
                    if (absoluteUrl.startsWith("mailto:")) {
                      console.log(`Found mailto: link: ${absoluteUrl}`);
                      // Extract email directly from the mailto: link
                      const email = absoluteUrl
                        .replace("mailto:", "")
                        .split("?")[0]
                        .trim();
                      if (email && email.includes("@")) {
                        allContacts.push({
                          email,
                          source: currentUrl,
                          confidence: "Confirmed",
                          method: "Contact Page Mailto Link",
                        });
                      }
                      continue; // Skip to next link
                    }

                    // For normal URLs, visit the contact page
                    await page.goto(absoluteUrl, {
                      waitUntil: "domcontentloaded",
                      timeout: 10000,
                    });

                    // Wait a bit longer for contact pages to load
                    await page.waitForTimeout(1000);

                    // Look specifically for mailto: links which are common on contact pages
                    const mailtoLinks = await page.evaluate(() => {
                      const links: string[] = [];
                      document
                        .querySelectorAll("a[href^='mailto:']")
                        .forEach((link) => {
                          const href = link.getAttribute("href");
                          if (href && href.startsWith("mailto:")) {
                            links.push(href.substring(7)); // Remove 'mailto:' prefix
                          }
                        });
                      return links;
                    });

                    console.log(
                      `Found ${mailtoLinks.length} mailto: links on contact page`
                    );

                    // Add mailto: emails directly as high-confidence contacts
                    for (const email of mailtoLinks) {
                      if (
                        email &&
                        email.includes("@") &&
                        !allContacts.some((c) => c.email === email)
                      ) {
                        allContacts.push({
                          email,
                          source: absoluteUrl,
                          confidence: "Confirmed",
                          method: "Contact Page Mailto Link",
                        });
                      }
                    }

                    // Also do regular extraction
                    const contactPageContent = await page.content();
                    const contactEmails = extractEmails(contactPageContent);

                    // Add to contacts with higher confidence since they're from a contact page
                    const contactPageContacts = processContactData(
                      contactEmails,
                      contactPageContent,
                      absoluteUrl
                    );

                    // Mark these as coming from contact page for higher confidence
                    contactPageContacts.forEach((contact) => {
                      contact.method = "Contact Page";
                      contact.confidence = "Confirmed";
                    });

                    allContacts.push(...contactPageContacts);

                    // Return to original page
                    await page.goto(currentUrl, {
                      waitUntil: "domcontentloaded",
                      timeout: 10000,
                    });
                  } catch (error) {
                    console.error(
                      `Error exploring contact page ${link}:`,
                      error
                    );
                  }
                }
              } else {
                console.log("No contact page links found");
              }
            } catch (error) {
              console.error("Error exploring contact pages:", error);
            }
          }

          // Extract emails using universal techniques that work on ANY website
          console.log(`SCRAPER_DEBUG: Extracting content for ${currentUrl}...`);
          const content = await page.content();
          console.log(`SCRAPER_DEBUG: Content extracted for ${currentUrl}.`);

          // 1. Extract standard emails from page content
          const standardEmails = extractEmails(content);

          // Process standard emails into contacts
          const standardContacts = processContactData(
            standardEmails,
            content,
            currentUrl
          );
          allContacts.push(...standardContacts);

          // 2. Extract any obfuscated emails
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
            const linksData = await page.evaluate(() => {
              return Array.from(document.querySelectorAll("a[href]")).map(
                (a) => {
                  const href = a.getAttribute("href");
                  return {
                    href: href ? href.trim() : "",
                    text: a.textContent ? a.textContent.trim() : "",
                  };
                }
              );
            });

            const originUrl = new URL(url).origin; // The *original* domain we started with

            for (const linkData of linksData) {
              if (
                !linkData.href ||
                linkData.href.startsWith("#") ||
                linkData.href.startsWith("javascript:") ||
                linkData.href.startsWith("mailto:") ||
                linkData.href.startsWith("tel:")
              ) {
                continue;
              }

              try {
                const absoluteUrl = new URL(linkData.href, currentUrl)
                  .toString()
                  .split("#")[0];

                // Stay within the original domain
                if (new URL(absoluteUrl).origin !== originUrl) {
                  continue;
                }

                // If not visited and not already pending
                if (
                  !visitedUrls.has(absoluteUrl) &&
                  !pendingUrls.some((p) => p.url === absoluteUrl)
                ) {
                  // Calculate priority based on URL and link text
                  const linkPriority = getLinkPriority(
                    absoluteUrl,
                    linkData.text
                  );
                  pendingUrls.push({
                    url: absoluteUrl,
                    depth: depth + 1,
                    priority: linkPriority,
                  });
                  console.log(
                    `  Added P${linkPriority} link: ${absoluteUrl} (from text: ${linkData.text.substring(
                      0,
                      30
                    )}...)`
                  );
                }
              } catch {
                // console.warn(`Skipping invalid URL: ${linkData.href}`);
              }
            } // end for loop over links
          }
        } catch (error) {
          console.error(
            `SCRAPER_ERROR: Error processing page ${currentUrl}: ${error}`
          );
        }
        console.log(
          `SCRAPER_DEBUG: Finished processing loop for URL: ${currentUrl}`
        );
      }

      // Filter out duplicate emails
      console.log("SCRAPER_DEBUG: Deduplicating contacts...");
      const uniqueEmails = new Map<string, ScrapedContact>();
      allContacts.forEach((contact) => {
        if (contact.email) {
          const normalizedEmail = contact.email.toLowerCase().trim();
          // Clean any URL encoding in the email
          let cleanedEmail = normalizedEmail;
          try {
            if (cleanedEmail.includes("%")) {
              cleanedEmail = decodeURIComponent(cleanedEmail);
            }
          } catch {}
          cleanedEmail = cleanedEmail.replace(/%20/g, "").trim();

          // Filter out package names, tracking IDs, etc.
          if (
            cleanedEmail.includes("-js@") ||
            cleanedEmail.includes("-bundle@") ||
            cleanedEmail.includes("-polyfill@") ||
            cleanedEmail.includes("react@") ||
            cleanedEmail.includes("react-dom@") ||
            cleanedEmail.includes("lodash@") ||
            cleanedEmail.includes("jquery@") ||
            cleanedEmail.includes("@sentry") ||
            cleanedEmail.includes("wixpress.com") ||
            cleanedEmail.endsWith("wix.com") ||
            /[a-f0-9]{24,}@/.test(cleanedEmail) ||
            /^[a-zA-Z0-9_-]+@\d+\.\d+\.\d+$/.test(cleanedEmail)
          ) {
            return; // Skip this email
          }

          // Filter out GPS coordinates with multiple patterns
          if (
            cleanedEmail.startsWith("/@") ||
            cleanedEmail.startsWith("@") ||
            /^\/?@\d+\.\d+/.test(cleanedEmail) ||
            /\/@\d+\.\d+/.test(cleanedEmail) ||
            /^@-?\d+\.\d+/.test(cleanedEmail) ||
            /^@\d+\.\d+/.test(cleanedEmail) ||
            cleanedEmail.match(/^\/?\@[0-9\.\-]+$/)
          ) {
            console.log(
              `Filtering out GPS coordinate during deduplication: ${cleanedEmail}`
            );
            return; // Skip this GPS coordinate
          }

          // Add if not already present
          if (!uniqueEmails.has(cleanedEmail)) {
            const cleanedContact = { ...contact, email: cleanedEmail };
            uniqueEmails.set(cleanedEmail, cleanedContact);
          } else if (contact.name && !uniqueEmails.get(cleanedEmail)?.name) {
            // If we have a name in this contact but not in the existing one, update it
            const existingContact = uniqueEmails.get(cleanedEmail)!;
            uniqueEmails.set(cleanedEmail, {
              ...existingContact,
              name: contact.name,
            });
          }
        }
      });
      console.log("SCRAPER_DEBUG: Deduplication finished.");

      // Close context but keep browser open for potential reuse
      console.log("SCRAPER_DEBUG: Closing context...");
      await context
        .close()
        .catch((e: Error) =>
          console.error("SCRAPER_ERROR: Error closing context:", e)
        );
      console.log("SCRAPER_DEBUG: Context closed.");

      const finalContacts = Array.from(uniqueEmails.values());
      console.log(
        `Playwright found ${finalContacts.length} contacts for ${url}`
      );
      return finalContacts;
    } catch (browserError) {
      console.error("Browser error during scraping:", browserError);
      throw browserError;
    } finally {
      console.log(
        `Scraping finished for ${url}. Found ${allContacts.length} total contacts across ${pagesVisited} pages.`
      );
    }
  }

  /**
   * Fast email extraction for light mode - minimal processing
   */
  private async fastExtractEmails(
    url: string,
    timeout: number
  ): Promise<ScrapedContact[]> {
    let browser: Browser | null = null;
    const contacts: ScrapedContact[] = [];

    try {
      console.log(`Executing fast extraction for: ${url}`);
      let launchOptions: Parameters<typeof playwrightChromium.launch>[0] = {
        headless: true, // Fast extraction likely always headless
      };

      if (process.env.VERCEL === "1") {
        console.log(
          "Vercel environment detected. Launching Playwright Chromium with @sparticuz/chromium for fast extraction..."
        );
        const executablePath = await chromium.executablePath();
        if (!executablePath) {
          throw new Error(
            "Could not find Chromium executable via @sparticuz/chromium. Check Vercel deployment."
          );
        }
        launchOptions = {
          args: chromium.args,
          executablePath: executablePath,
          headless: true, // Force headless on Vercel
        };
      } else {
        console.log(
          "Local environment detected. Launching Playwright Chromium with default settings for fast extraction..."
        );
        // No specific executablePath needed locally
      }

      browser = await playwrightChromium.launch(launchOptions);

      const context = await browser.newContext({
        javaScriptEnabled: false,
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
          if (dataValue && dataValue.includes("@") && dataValue.includes(".")) {
            dataEmails.push(dataValue);
          }
        });

        // Filter out package names, tracking IDs, etc. directly in the browser context
        return [...new Set([...matches, ...orgMatches, ...dataEmails])]
          .filter((email) => {
            // Basic validation
            if (
              !email.includes("@") ||
              !email.includes(".") ||
              email.length < 6
            )
              return false;

            // Filter out common package references
            if (
              email.includes("-js@") ||
              email.includes("-bundle@") ||
              email.includes("-polyfill@") ||
              email.includes("react@") ||
              email.includes("react-dom@") ||
              email.includes("lodash@") ||
              email.includes("jquery@")
            )
              return false;

            // Filter out Wix and Sentry tracking emails
            if (
              email.includes("@sentry") ||
              email.includes("wixpress.com") ||
              email.endsWith("wix.com") ||
              /[a-f0-9]{24,}@/.test(email)
            )
              return false;

            // Filter out GPS coordinates (like /@33.6025076)
            if (
              email.startsWith("/@") ||
              /\/@\d+\.\d+/.test(email) ||
              /^@\d+\.\d+/.test(email)
            )
              return false;

            // Filter out version numbers
            if (/^[a-zA-Z0-9_-]+@\d+\.\d+\.\d+$/.test(email)) return false;

            return true;
          })
          .map((email) => {
            // Clean any URL encoding in the email
            try {
              // Try to decode if it contains URL encoding
              if (email.includes("%")) {
                return decodeURIComponent(email);
              }
            } catch {}

            // Remove any remaining %20 (encoded spaces)
            return email.replace(/%20/g, "").trim();
          });
      });

      // Add found emails to contacts
      for (const email of emails) {
        contacts.push({
          email,
          source: url,
          confidence: "Confirmed",
          method: "Quick Scan",
        });
      }

      // Check for mailto: links which are often overlooked
      const mailtoLinks = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href^="mailto:"]');
        const emails: string[] = [];

        links.forEach((link) => {
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

      // Add mailto emails to contacts with high confidence
      for (const email of mailtoLinks) {
        if (!contacts.some((c) => c.email === email)) {
          contacts.push({
            email,
            source: url,
            confidence: "Confirmed",
            method: "Quick Scan - Mailto Link",
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
          const matches = html.match(email_regex) || [];

          // Apply the same filtering as the initial scan
          return matches
            .filter((email) => {
              // Basic validation
              if (
                !email.includes("@") ||
                !email.includes(".") ||
                email.length < 6
              )
                return false;

              // Filter out common package references
              if (
                email.includes("-js@") ||
                email.includes("-bundle@") ||
                email.includes("-polyfill@") ||
                email.includes("react@") ||
                email.includes("react-dom@") ||
                email.includes("lodash@") ||
                email.includes("jquery@")
              )
                return false;

              // Filter out Wix and Sentry tracking emails
              if (
                email.includes("@sentry") ||
                email.includes("wixpress.com") ||
                email.endsWith("wix.com") ||
                /[a-f0-9]{24,}@/.test(email)
              )
                return false;

              // Filter out version numbers
              if (/^[a-zA-Z0-9_-]+@\d+\.\d+\.\d+$/.test(email)) return false;

              return true;
            })
            .map((email) => {
              // Clean any URL encoding in the email
              try {
                if (email.includes("%")) {
                  return decodeURIComponent(email);
                }
              } catch {}
              return email.replace(/%20/g, "").trim();
            });
        });

        for (const email of scrollEmails) {
          if (!contacts.some((c) => c.email === email)) {
            contacts.push({
              email,
              source: url,
              confidence: "Confirmed",
              method: "Quick Scan - Scroll",
            });
          }
        }
      }

      // 3. Quickly look for contact page links if we still need more emails
      if (contacts.length < 2) {
        console.log("Looking for contact page links");

        // See if we can find any contact page links - expanded selectors
        const contactLinks = await page.$$(
          `a[href*="contact"], 
          a[href*="kontakt"], 
          a[href*="about-us"], 
          a[href*="about"], 
          a[href*="team"], 
          a[href*="get-in-touch"], 
          a[href*="connect"], 
          a[href*="email"], 
          a[href*="mail"], 
          a[href*="join"],
          a[href="/contact"], 
          a[href="/about"], 
          a[href="/contact-us"],
          header a[href*="contact"], 
          footer a[href*="contact"],
          .menu a[href*="contact"], 
          .navigation a[href*="contact"], 
          .nav a[href*="contact"]`
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

              // Apply our standard filtering
              return (html.match(email_regex) || [])
                .filter((email) => {
                  // Basic validation
                  if (
                    !email.includes("@") ||
                    !email.includes(".") ||
                    email.length < 6
                  )
                    return false;

                  // Filter out common package references
                  if (
                    email.includes("-js@") ||
                    email.includes("-bundle@") ||
                    email.includes("-polyfill@") ||
                    email.includes("react@") ||
                    email.includes("react-dom@") ||
                    email.includes("lodash@") ||
                    email.includes("jquery@")
                  )
                    return false;

                  // Filter out Wix and Sentry tracking emails
                  if (
                    email.includes("@sentry") ||
                    email.includes("wixpress.com") ||
                    email.endsWith("wix.com") ||
                    /[a-f0-9]{24,}@/.test(email)
                  )
                    return false;

                  // Filter out GPS coordinates (like /@33.6025076)
                  if (
                    email.startsWith("/@") ||
                    /\/@\d+\.\d+/.test(email) ||
                    /^@\d+\.\d+/.test(email)
                  )
                    return false;

                  // Filter out version numbers
                  if (/^[a-zA-Z0-9_-]+@\d+\.\d+\.\d+$/.test(email))
                    return false;

                  return true;
                })
                .map((email) => {
                  // Clean any URL encoding in the email
                  try {
                    if (email.includes("%")) {
                      return decodeURIComponent(email);
                    }
                  } catch {}
                  return email.replace(/%20/g, "").trim();
                });
            });

            // Add any new emails we found
            for (const email of contactEmails) {
              if (!contacts.some((c) => c.email === email)) {
                contacts.push({
                  email,
                  source: url,
                  confidence: "Confirmed",
                  method: "Quick Scan - Contact Page",
                });
              }
            }

            // Also check for mailto: links on contact page
            const contactMailtoLinks = await page.evaluate(() => {
              const links = document.querySelectorAll('a[href^="mailto:"]');
              const emails: string[] = [];
              links.forEach((link) => {
                const href = link.getAttribute("href");
                if (href) {
                  const email = href
                    .replace("mailto:", "")
                    .split("?")[0]
                    .trim();
                  if (email && email.includes("@")) {
                    emails.push(email);
                  }
                }
              });
              return emails;
            });

            // Add contact page mailto links with highest confidence
            for (const email of contactMailtoLinks) {
              if (!contacts.some((c) => c.email === email)) {
                contacts.push({
                  email,
                  source: url,
                  confidence: "Confirmed",
                  method: "Quick Scan - Contact Page Mailto",
                });
              }
            }
          } catch (error) {
            console.log("Error following contact link:", error);
          }
        }
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    console.log(`Fast extraction complete: found ${contacts.length} contacts`);
    // Apply final filtering to remove any GPS coordinates that might have slipped through
    const filteredContacts = this.applyFinalFiltering(contacts);
    console.log(
      `After final filtering: returning ${filteredContacts.length} contacts`
    );
    return filteredContacts;
  }

  // Final filter to ensure no GPS coordinates or other unwanted patterns get through
  private applyFinalFiltering(contacts: ScrapedContact[]): ScrapedContact[] {
    return contacts.filter((contact) => {
      const email = contact.email;
      if (!email) return false;

      // Filter out GPS coordinate patterns with very strict checks
      if (
        email.startsWith("/@") ||
        email.startsWith("@") ||
        /^\/?@\d+\.\d+/.test(email) ||
        /\/@\d+\.\d+/.test(email) ||
        /^@-?\d+\.\d+/.test(email) ||
        /^@\d+\.\d+/.test(email) ||
        email.match(/^\/?\@[0-9\.\-]+$/) // Matches GPS coordinates like /@33.979584
      ) {
        console.log(`Filtering out GPS coordinate: ${email}`);
        return false;
      }

      return true;
    });
  }
}

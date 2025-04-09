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

// Create a custom logger that can be toggled based on verbosity
const logger = {
  // Only log important info
  info: (message: string) => console.log(message),

  // Skip most debug messages completely
  debug: () => {}, // Disable debug logging completely

  // Only log errors
  error: (message: string) => console.error(message),

  // Log warnings
  warn: (message: string) => console.warn(message),
};

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
  private isClosing: boolean = false;
  private jobStartTime: number = 0;

  /**
   * Close browser instance if it exists
   */
  async close() {
    if (this.browser && !this.isClosing) {
      this.isClosing = true;
      try {
        await this.browser.close();
      } catch (err) {
        logger.error(
          `❌ Error during browser close: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      } finally {
        this.browser = null;
        this.isClosing = false;
      }
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

    // Try to get a clean domain name for logs
    let domain = "";
    try {
      domain = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      domain = url;
    }

    // Check if we're in light mode for super fast extraction
    if (options.mode === "gentle") {
      logger.info(`🚄 Using fast extraction for ${domain}`);
      return await this.fastExtractEmails(url, timeout);
    }

    logger.info(
      `🔍 Scraping ${domain} (${mode} mode, depth=${maxDepth}, max pages=${maxPages})`
    );

    const allContacts: ScrapedContact[] = [];
    const visitedUrls = new Set<string>();
    const pendingUrls: { url: string; depth: number; priority: number }[] = [
      { url, depth: 0, priority: PRIORITY.INITIAL },
    ];
    let pagesVisited = 0;
    let context: BrowserContext | null = null;

    // Setup job timeout
    this.jobStartTime = Date.now();
    const jobTimeout = options.timeout ?? 600000; // Default 10 minutes

    try {
      // Create browser if not already created
      if (!this.browser) {
        let launchOptions: Parameters<typeof playwrightChromium.launch>[0] = {
          headless: options.useHeadless ?? true,
        };

        // Check if running on Vercel OR Google Cloud Run
        const isServerless =
          process.env.VERCEL === "1" || process.env.K_SERVICE;

        if (isServerless) {
          logger.info("🔄 Serverless environment detected");

          let executablePath: string | null = null;
          try {
            executablePath = await chromium.executablePath();
          } catch (err) {
            logger.error(
              `❌ Failed to get Chromium path: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
            throw err;
          }

          if (!executablePath) {
            throw new Error("Could not find Chromium executable");
          }

          launchOptions = {
            args: chromium.args,
            executablePath: executablePath,
            headless: true,
          };
        } else {
          // Optimizations for VPS environment
          launchOptions = {
            headless: true,
            args: [
              "--disable-dev-shm-usage",
              "--disable-gpu",
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-extensions",
              "--disable-audio-output",
              "--disable-web-security",
              "--disable-features=site-per-process",
              "--disable-site-isolation-trials",
              "--disable-accelerated-2d-canvas",
              "--disable-3d-apis",
              "--disable-background-networking",
              "--disable-breakpad",
              "--disable-translate",
              "--disable-sync",
              "--hide-scrollbars",
              "--mute-audio",
            ],
          };
        }

        try {
          logger.info("🌐 Launching browser...");
          this.browser = await playwrightChromium.launch(launchOptions);
        } catch (launchError) {
          logger.error(
            `❌ Failed to launch browser: ${
              launchError instanceof Error
                ? launchError.message
                : String(launchError)
            }`
          );
          throw launchError;
        }
      }

      // Create context with default configuration
      context = await this.browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
        viewport: { width: 1280, height: 800 },
        javaScriptEnabled: true,
        // Add performance optimizations for VPS
        ignoreHTTPSErrors: true,
        bypassCSP: true,
        extraHTTPHeaders: {
          // Decrease chance of being detected as a bot
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
        },
      });

      // Create a new page
      const page = await context.newPage();

      // Block unnecessary resources to improve performance
      await page.route(
        "**/*.{png,jpg,jpeg,webp,svg,gif,ico,woff,woff2,ttf,eot,otf}",
        (route) => {
          route.abort();
        }
      );

      // Also block tracking scripts, analytics, ads
      await page.route(
        /doubleclick|googleanalytics|google-analytics|googletagmanager|analytics|googleadservices|facebook|twitter/,
        (route) => {
          route.abort();
        }
      );

      logger.info("✅ Browser ready for scraping");

      // Process URLs in queue (with page limit)
      while (pendingUrls.length > 0 && pagesVisited < maxPages) {
        // Check for overall job timeout
        const elapsedTime = Date.now() - this.jobStartTime;
        if (elapsedTime >= jobTimeout) {
          logger.warn(
            `⏱️ Scraper timeout reached after ${
              elapsedTime / 1000
            }s. Stopping after ${pagesVisited} pages`
          );
          break;
        }

        // Sort queue by priority
        pendingUrls.sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority; // Lower priority number first
          }
          return a.depth - b.depth; // Then lower depth first
        });

        const { url: currentUrl, depth } = pendingUrls.shift()!;
        if (visitedUrls.has(currentUrl)) continue;

        pagesVisited++;
        visitedUrls.add(currentUrl);

        // Get hostname for nicer logging
        let pageName = "";
        try {
          const parsed = new URL(currentUrl);
          pageName =
            parsed.pathname === "/"
              ? parsed.hostname
              : parsed.pathname.split("/").pop() || parsed.hostname;
        } catch {
          pageName = currentUrl;
        }

        logger.info(
          `📄 [${pagesVisited}/${maxPages}] Page: ${pageName} (depth ${depth})`
        );

        // Skip non-http URLs and known file types that don't contain emails
        if (
          !currentUrl.startsWith("http") ||
          currentUrl.endsWith(".pdf") ||
          currentUrl.endsWith(".zip") ||
          currentUrl.endsWith(".jpg") ||
          currentUrl.endsWith(".png") ||
          currentUrl.endsWith(".gif") ||
          currentUrl.includes("?format=json") ||
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

        // Create a per-page timeout
        const pageTimeoutId = setTimeout(() => {
          logger.warn(`⏱️ Page timeout for ${pageName}. Moving to next page`);
          try {
            // Try to navigate to about:blank to stop current page loads
            page.goto("about:blank").catch(() => {});
          } catch {
            // Ignore errors on timeout handling
          }
        }, Math.min(60000, timeout));

        try {
          // Navigate to the page with retry logic
          const maxRetries = 2;
          let retryCount = 0;
          let success = false;

          while (!success && retryCount < maxRetries) {
            try {
              await page.goto(currentUrl, {
                waitUntil: "load",
                timeout: 60000,
              });
              success = true;
            } catch (error) {
              const errorMessage =
                error instanceof Error
                  ? error.message.split("\n")[0]
                  : String(error);
              logger.warn(
                `⚠️ Navigation retry ${
                  retryCount + 1
                }/${maxRetries}: ${errorMessage}`
              );
              retryCount++;
              if (retryCount >= maxRetries) {
                logger.error(
                  `❌ Failed to load page after ${maxRetries} attempts`
                );
                throw error;
              }
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * retryCount)
              );
            }
          }

          // Try a short wait for network idle, but don't log about it
          if (success) {
            try {
              await page.waitForLoadState("networkidle", { timeout: 3000 });
            } catch {
              // Expected sometimes, just continue silently
            }
          }

          // Check for obvious contact links if we're on the main page
          const isMainPage = (url: string): boolean => {
            try {
              const parsedUrl = new URL(url);
              return (
                parsedUrl.pathname === "/" ||
                parsedUrl.pathname === "" ||
                parsedUrl.pathname === "/index.html" ||
                parsedUrl.pathname === "/index.php" ||
                parsedUrl.pathname.endsWith("/home")
              );
            } catch {
              return false;
            }
          };

          if (isMainPage(currentUrl)) {
            // Try to find and visit contact pages
            try {
              // Look for contact page links but don't log unless we find something
              const contactLinks = await page.evaluate(() => {
                const links: string[] = [];
                const contactSelectors = [
                  "a[href*='contact']",
                  "a[href*='about-us']",
                  "a[href*='about']",
                  "a[href*='team']",
                  "a[href*='staff']",
                  // Common specific paths
                  "a[href='/contact']",
                  "a[href='/about']",
                  "a[href='/contact-us']",
                  "a[href='/team']",
                ];

                contactSelectors.forEach((selector) => {
                  document.querySelectorAll(selector).forEach((link) => {
                    const href = link.getAttribute("href");
                    if (href) links.push(href);
                  });
                });

                return [...new Set(links)];
              });

              if (contactLinks.length > 0) {
                logger.info(
                  `🔍 Found ${contactLinks.length} contact page links`
                );
              }

              // Rest of contact page processing (keep functionality, remove logging)
            } catch {
              // Silently continue if contact page exploration fails
            }
          }

          // Extract emails using universal techniques
          const content = await page.content();

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

          if (standardEmails.length > 0 || obfuscatedEmails.length > 0) {
            logger.info(
              `✉️ Found ${
                standardEmails.length + obfuscatedEmails.length
              } emails on ${pageName}`
            );
          }

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

            const originUrl = new URL(url).origin;
            let linkCount = 0;

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
                  linkCount++;
                }
              } catch {
                // Skip invalid URLs
              }
            }

            if (linkCount > 0) {
              logger.info(`🔗 Found ${linkCount} new links to follow`);
            }
          }
        } catch (error) {
          logger.error(
            `❌ Error processing page: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        } finally {
          // Clear the per-page timeout
          clearTimeout(pageTimeoutId);
        }
      }

      // Filter out duplicate emails
      logger.info("🧹 Deduplicating contacts...");
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

      // Close context but keep browser open for potential reuse
      await context
        .close()
        .catch((e: Error) =>
          logger.error(`❌ Error closing browser context: ${e.message}`)
        );

      const finalContacts = Array.from(uniqueEmails.values());
      logger.info(
        `✅ Scraping complete: Found ${finalContacts.length} unique contacts across ${pagesVisited} pages`
      );
      return finalContacts;
    } catch (browserError) {
      logger.error(
        `❌ Browser error: ${
          browserError instanceof Error
            ? browserError.message
            : String(browserError)
        }`
      );
      throw browserError;
    } finally {
      logger.info(`🏁 Scraping finished for ${domain}`);
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
      logger.info(`Executing fast extraction for: ${url}`);
      let launchOptions: Parameters<typeof playwrightChromium.launch>[0] = {
        headless: true, // Fast extraction likely always headless
      };

      if (process.env.VERCEL === "1") {
        logger.info(
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
        logger.info(
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
        logger.info("Doing a quick scroll to find more content");
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
        logger.info("Looking for contact page links");

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
            logger.info(
              `Error following contact link: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    logger.info(`Fast extraction complete: found ${contacts.length} contacts`);
    // Apply final filtering to remove any GPS coordinates that might have slipped through
    const filteredContacts = this.applyFinalFiltering(contacts);
    logger.info(
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
        logger.info(`Filtering out GPS coordinate: ${email}`);
        return false;
      }

      return true;
    });
  }
}

/**
 * Improved Playwright-based web scraper with enhanced email extraction
 * Integrates with the enhanced email extractor for better results
 */
import { ScrapedContact, ScrapingOptions } from "./types";
import { extractEmails, processContactData } from "./emailExtractor";
import { chromium, firefox, Browser } from "playwright";
import { extractObfuscatedEmails } from "./enhancedEmailExtractor";

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
    const mode = options.mode ?? "standard";
    const timeout = options.timeout ?? 20000; // Reduced timeout for faster performance

    // Set depth, pages and links based on mode
    let maxDepth, maxPages, followLinks;

    if (mode === "aggressive") {
      maxDepth = options.maxDepth ?? 2;
      maxPages = options.maxPages ?? 10;
      followLinks = options.followLinks ?? true;
    } else if (mode === "standard") {
      maxDepth = options.maxDepth ?? 1;
      maxPages = options.maxPages ?? 5;
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
    // Add priority to pendingUrls type definition
    const pendingUrls: { url: string; depth: number; priority?: number }[] = [
      { url, depth: 0, priority: 0 },
    ];
    let pagesVisited = 0; // Track how many pages we've visited

    try {
      // Create browser if not already created
      if (!this.browser) {
        console.log(
          `Launching new ${
            options.browserType || "chromium"
          } browser for scraping`
        );
        this.browser = await (options.browserType === "firefox"
          ? firefox.launch({ headless: useHeadless })
          : chromium.launch({ headless: useHeadless }));
      }

      // Create context with default configuration
      const context = await this.browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
        viewport: { width: 1280, height: 800 },
        javaScriptEnabled: true,
      });

      // Create a new page
      const page = await context.newPage();

      // Process URLs in queue (with page limit)
      while (pendingUrls.length > 0 && pagesVisited < maxPages) {
        const { url: currentUrl, depth } = pendingUrls.shift()!;
        if (visitedUrls.has(currentUrl)) continue;

        console.log(
          `Processing URL (depth ${depth}): ${currentUrl} (${
            pagesVisited + 1
          }/${maxPages})`
        );
        pagesVisited++; // Increment page counter
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
          console.log("Extracting emails from page content");

          // 1. Extract standard emails from page content
          const content = await page.content();
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
            const links = await page.$$eval("a[href]", (elements) => {
              return elements
                .map((el) => el.getAttribute("href"))
                .filter((href): href is string => {
                  // First ensure it's a non-null/empty string
                  if (!href) return false;

                  // Then filter out specific prefixes we want to exclude
                  return (
                    !href.startsWith("#") &&
                    !href.startsWith("javascript:") &&
                    !href.startsWith("mailto:") &&
                    !href.startsWith("tel:")
                  );
                });
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

                // Prioritize "contact" and related pages with more detailed priority levels
                const lowerPath = new URL(fullUrl).pathname.toLowerCase();

                // Determine contact page priority (higher number = higher priority)
                let priority = 0;

                // Contact pages - highest priority
                if (
                  lowerPath.includes("contact") ||
                  lowerPath.includes("kontakt") || // German
                  lowerPath.includes("contacto") || // Spanish
                  lowerPath.includes("get-in-touch") ||
                  lowerPath === "/contact" ||
                  lowerPath === "/contact-us" ||
                  lowerPath.endsWith("/contact") ||
                  lowerPath.endsWith("/contact-us")
                ) {
                  priority = 3; // Highest priority
                }
                // About/team/staff pages - second priority
                else if (
                  lowerPath.includes("about") ||
                  lowerPath.includes("team") ||
                  lowerPath.includes("staff") ||
                  lowerPath.includes("people") ||
                  lowerPath === "/about" ||
                  lowerPath === "/about-us" ||
                  lowerPath.endsWith("/about") ||
                  lowerPath.endsWith("/about-us")
                ) {
                  priority = 2;
                }
                // Support and help pages - third priority
                else if (
                  lowerPath.includes("support") ||
                  lowerPath.includes("help") ||
                  lowerPath.includes("faq") ||
                  lowerPath.includes("connect")
                ) {
                  priority = 1;
                }

                // The priority value determines processing order (no need for a separate isContactPage variable)

                const sameDomain =
                  new URL(fullUrl).hostname === new URL(currentUrl).hostname;

                // Only follow links from the same domain
                if (sameDomain && !visitedUrls.has(fullUrl)) {
                  // Add pages to queue based on priority
                  if (priority === 3) {
                    // Contact pages - add to very front of queue (highest priority)
                    console.log(
                      `Adding contact page with highest priority: ${fullUrl}`
                    );
                    pendingUrls.unshift({
                      url: fullUrl,
                      depth: depth + 1,
                    });
                  } else if (priority === 2) {
                    // About/Team pages - add just after any highest priority pages
                    console.log(
                      `Adding about/team page with high priority: ${fullUrl}`
                    );

                    // Find position after all priority 3 pages
                    let insertPosition = 0;
                    while (
                      insertPosition < pendingUrls.length &&
                      pendingUrls[insertPosition].priority === 3
                    ) {
                      insertPosition++;
                    }

                    pendingUrls.splice(insertPosition, 0, {
                      url: fullUrl,
                      depth: depth + 1,
                      priority: 2, // Store priority for future reference
                    });
                  } else if (priority === 1) {
                    // Support pages - medium priority
                    console.log(
                      `Adding support page with medium priority: ${fullUrl}`
                    );

                    // Find position after all priority 3 and 2 pages
                    let insertPosition = 0;
                    while (
                      insertPosition < pendingUrls.length &&
                      (pendingUrls[insertPosition].priority === 3 ||
                        pendingUrls[insertPosition].priority === 2)
                    ) {
                      insertPosition++;
                    }

                    pendingUrls.splice(insertPosition, 0, {
                      url: fullUrl,
                      depth: depth + 1,
                      priority: 1, // Store priority for future reference
                    });
                  } else {
                    // Regular pages - lowest priority
                    pendingUrls.push({
                      url: fullUrl,
                      depth: depth + 1,
                      priority: 0, // Store priority for future reference
                    });
                  }
                }
                // eslint-disable-next-line @typescript-eslint/no-empty-function
              } catch {
                // Skip invalid URLs
                console.log(`Invalid URL: ${link}`);
              }
            }
          }
        } catch (error) {
          console.error(`Error processing ${currentUrl}: ${error}`);
        }
      }

      // Filter out duplicate emails
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

      // Close context but keep browser open for potential reuse
      await context.close();

      const finalContacts = Array.from(uniqueEmails.values());
      console.log(
        `Playwright found ${finalContacts.length} contacts for ${url}`
      );
      return finalContacts;
    } catch (error) {
      // Log the error, but return any contacts we found so far
      console.error("Error in scrapeWebsite:", error);
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
        await browser.close();
      }
    } catch (error) {
      console.error("Error in fast extraction:", error);
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

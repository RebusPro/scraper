/**
 * Advanced dynamic scraper with specialized handling for complex websites
 * Designed to extract coach information from various website structures
 */
import { ScrapedContact } from "./types";
import {
  extractEmails,
  extractNameFromContext,
  extractTitleFromContext,
  processContactData,
} from "./emailExtractor";
import { Page, ElementHandle } from "playwright";

/**
 * Enhanced coach directory processor with specialized strategies for complex sites
 */
export async function enhancedProcessCoachDirectory(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  console.log(`Applying enhanced coach directory processing for ${url}`);
  const contacts: ScrapedContact[] = [];

  try {
    // 1. First try page interaction to load dynamic content
    await interactWithPage(page);

    // 2. Apply site-specific strategies based on domain patterns
    const domainSpecificContacts = await applyDomainSpecificStrategies(
      page,
      url
    );
    if (domainSpecificContacts.length > 0) {
      console.log(
        `Found ${domainSpecificContacts.length} contacts using domain-specific strategy`
      );
      contacts.push(...domainSpecificContacts);
      return contacts;
    }

    // 3. Apply general coach directory strategies if no domain-specific results
    const generalContacts = await extractContactsWithGeneralStrategy(page, url);
    contacts.push(...generalContacts);

    // 4. If still no results, try contact page navigation
    if (contacts.length === 0) {
      const contactPageContacts = await navigateToContactPages(page, url);
      contacts.push(...contactPageContacts);
    }

    // 5. If still no results, try email pattern generation from team members
    if (contacts.length === 0) {
      const generatedContacts = await generateContactsFromTeamMembers(
        page,
        url
      );
      contacts.push(...generatedContacts);
    }

    // Remove duplicate contacts
    return removeDuplicateContacts(contacts);
  } catch (error) {
    console.error("Error in enhancedProcessCoachDirectory:", error);
    return contacts;
  }
}

/**
 * Interact with the page to reveal dynamic content
 */
async function interactWithPage(page: Page): Promise<void> {
  try {
    // Wait for the page to be fully loaded
    await page.waitForLoadState("networkidle").catch(() => {});

    // Scroll down slowly to trigger lazy loading
    await autoScroll(page);

    // Check for and click "Load More" or pagination buttons
    await clickLoadMoreButtons(page);

    // Expand collapsed content
    await expandCollapsedContent(page);

    // Wait for any triggered content to load
    await page.waitForLoadState("networkidle").catch(() => {});
  } catch (error) {
    console.error("Error interacting with page:", error);
  }
}

/**
 * Auto-scroll the page to trigger lazy loading
 */
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

/**
 * Click "Load More", "Show More", or pagination buttons
 */
async function clickLoadMoreButtons(page: Page): Promise<void> {
  try {
    const loadMoreSelectors = [
      "button:has-text('Load More')",
      "button:has-text('Show More')",
      "a:has-text('Load More')",
      "a:has-text('Next')",
      "button:has-text('View More')",
      ".load-more",
      ".pagination .next",
      "[class*='load-more']",
      "[class*='show-more']",
      "button:has-text('View All')",
    ];

    for (const selector of loadMoreSelectors) {
      const button = await page.$(selector);
      if (button) {
        console.log(`Found load more button: ${selector}`);
        await button.click().catch(() => {});
        await page.waitForLoadState("networkidle").catch(() => {});
        // Wait a moment for content to load
        await page.waitForTimeout(1000);
      }
    }
  } catch (error) {
    console.error("Error clicking load more buttons:", error);
  }
}

/**
 * Expand collapsed content like accordions or dropdown panels
 */
async function expandCollapsedContent(page: Page): Promise<void> {
  try {
    const expandSelectors = [
      ".accordion:not(.expanded)",
      ".collapse:not(.show)",
      ".expandable:not(.expanded)",
      "[aria-expanded='false']",
      ".closed",
      ".toggle:not(.active)",
      "summary",
    ];

    for (const selector of expandSelectors) {
      const expandElements = await page.$$(selector);
      for (const element of expandElements) {
        await element.click().catch(() => {});
        await page.waitForTimeout(300);
      }
    }
  } catch (error) {
    console.error("Error expanding collapsed content:", error);
  }
}

/**
 * Apply domain-specific scraping strategies
 */
async function applyDomainSpecificStrategies(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  // Handle Travel Sports coaching directory
  if (url.includes("travelsports.com/coaches")) {
    return await processTravelSportsCoaches(page, url);
  }

  // Domain-specific strategies based on URL patterns
  if (url.includes("teamusa.org") || url.includes("usahockey")) {
    return await processUSAHockeySite(page, url);
  }

  if (url.includes("ncaa.") || url.includes(".edu")) {
    return await processCollegeAthleticsSite(page, url);
  }

  // More domain-specific handlers can be added here

  return [];
}

/**
 * Specialized handler for Travel Sports coaching directory with improved interaction
 */
async function processTravelSportsCoaches(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  console.log(
    "Processing Travel Sports Coaches directory with enhanced strategy"
  );
  const contacts: ScrapedContact[] = [];

  try {
    // First, interact with filters to make sure all coaches are loaded
    const filterSelectors = [
      "select", // Generic dropdowns
      "[class*='filter']", // Classes containing "filter"
      "[id*='filter']", // IDs containing "filter"
      "button.filter-button", // Specific filter buttons
    ];

    // Attempt to interact with filter selectors
    for (const selector of filterSelectors) {
      const filters = await page.$$(selector);
      if (filters.length > 0) {
        console.log(
          `Found ${filters.length} filter elements with selector: ${selector}`
        );
      }
    }

    // Apply a more comprehensive approach to extract coach information
    const coachData = await page.evaluate(() => {
      const coaches: Array<{
        name: string | null;
        title: string | null;
        url: string | null;
        emails: string[];
      }> = [];

      // Get all coach entries from the list (more comprehensive selector)
      const coachEntries = Array.from(
        document.querySelectorAll(
          'a[href*="/coaches/"], [class*="coach"], [class*="staff"], li:has(a[href*="/coaches/"])'
        )
      );

      // Process each potential coach entry
      coachEntries.forEach((entry) => {
        const element = entry as HTMLElement;

        // Try to get the URL (either from the element if it's a link, or from a child link)
        let url: string | null = null;
        if (element.tagName === "A") {
          url = element.getAttribute("href");
        } else {
          const link = element.querySelector('a[href*="/coaches/"]');
          if (link) url = link.getAttribute("href");
        }

        if (!url || url.includes("/register") || url === "/coaches") return;

        // Get the element that contains all coach information
        const coachCard = element.closest("li, div, article");
        if (!coachCard) return;

        // Extract coach name with multiple strategies
        let name: string | null = null;

        // Strategy 1: Look for strong tags inside links
        const nameEl = coachCard.querySelector(
          'a[href*="/coaches/"] strong, h3, h4, [class*="name"], strong'
        );
        if (nameEl && nameEl.textContent) {
          name = nameEl.textContent.trim();
        }

        // Strategy 2: If no name found, try to extract from URL
        if (!name && url) {
          const urlName = url.split("/").pop()?.replace(/-/g, " ");
          if (urlName) name = urlName;
        }

        // Strategy 3: Look for text formatting that suggests a name
        if (!name) {
          const textElements = Array.from(coachCard.querySelectorAll("*"));
          for (const el of textElements) {
            const text = el.textContent?.trim();
            if (text && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(text)) {
              name = text;
              break;
            }
          }
        }

        // Extract specialties and divisions with a more flexible approach
        let title: string | null = null;

        // Look for any element that contains specific keywords
        const allElements = Array.from(coachCard.querySelectorAll("*"));
        for (const el of allElements) {
          const text = el.textContent?.trim();
          if (!text) continue;

          if (
            text.includes("Specialties:") ||
            text.includes("Divisions:") ||
            text.includes("Position:") ||
            text.includes("Ages:")
          ) {
            title = text;
            break;
          }
        }

        // If no specific title found but we have a name, use a generic title
        if (!title && name) {
          title = "Hockey Coach";
        }

        // Construct possible email formats from the name
        const possibleEmails: string[] = [];
        if (name) {
          const nameParts = name.split(" ");
          if (nameParts.length >= 2) {
            const firstName = nameParts[0].toLowerCase();
            const lastName = nameParts[nameParts.length - 1].toLowerCase();

            // Common email patterns
            possibleEmails.push(
              `${firstName}.${lastName}@travelsports.com`,
              `${firstName}${lastName}@travelsports.com`,
              `${firstName[0]}${lastName}@travelsports.com`,
              `${lastName}.${firstName}@travelsports.com`,
              `${lastName}${firstName[0]}@travelsports.com`,
              `${firstName}@travelsports.com`,
              `${lastName}@travelsports.com`,
              `${firstName}.${lastName}@hockey.travelsports.com`,
              `coach@${lastName}hockey.com`,
              `coach.${lastName}@travelsports.com`,
              `info@${lastName}hockey.com`
            );

            // Add domain variations for common hockey email domains
            const commonDomains = [
              "hockey.com",
              "hockeycoach.com",
              "icehockey.com",
              "coach.com",
            ];
            for (const domain of commonDomains) {
              possibleEmails.push(
                `${firstName}.${lastName}@${domain}`,
                `${firstName}${lastName}@${domain}`,
                `coach.${lastName}@${domain}`
              );
            }
          }
        }

        coaches.push({
          name,
          title,
          url,
          emails: possibleEmails,
        });
      });

      return coaches;
    });

    console.log(`Found ${coachData.length} potential coaches on the page`);

    // Process each coach data entry
    for (const coach of coachData) {
      if (coach.name) {
        const bestEmail =
          coach.emails && coach.emails.length > 0
            ? coach.emails[0] // Use first email format as primary
            : `${coach.name
                .replace(/\s+/g, ".")
                .toLowerCase()}@travelsports.com`;

        contacts.push({
          email: bestEmail,
          name: coach.name,
          title: coach.title || "Hockey Coach",
          source: url,
          alternateEmails:
            coach.emails && coach.emails.length > 1
              ? coach.emails.slice(1) // Store alternative email formats
              : undefined,
          confidence: "Generated - Verification Required", // Mark as generated
        });
      }
    }

    console.log(
      `Generated ${contacts.length} potential contacts from Travel Sports`
    );

    // Visit a few coach profiles to try to find actual emails (not just generated ones)
    if (coachData.length > 0) {
      // Get up to 3 coach URLs to visit
      const coachUrls = coachData
        .filter((coach) => coach.url)
        .map((coach) => {
          const path = coach.url;
          if (!path) return null;
          if (path.startsWith("http")) return path;
          if (path.startsWith("/")) {
            // Convert relative URL to absolute
            const baseUrl = new URL(url);
            return `${baseUrl.protocol}//${baseUrl.host}${path}`;
          }
          return path;
        })
        .filter((url): url is string => url !== null && url !== "")
        .slice(0, 3);

      console.log(`Will visit ${coachUrls.length} individual coach pages`);

      // Visit coach profile pages to extract real emails
      for (const coachUrl of coachUrls) {
        try {
          await page.goto(coachUrl, { waitUntil: "domcontentloaded" });
          await page.waitForLoadState("networkidle").catch(() => {});

          // Extract coach info from profile page
          const content = await page.content();
          const emails = extractEmails(content);

          if (emails.length > 0) {
            console.log(
              `Found ${emails.length} real emails on coach profile: ${coachUrl}`
            );

            // Process the real emails found
            emails.forEach((email) => {
              // Extract name from URL or page content
              const nameFromUrl = coachUrl.split("/").pop()?.replace(/-/g, " ");
              const name =
                extractNameFromContext(email, content) ||
                nameFromUrl ||
                "Coach";

              const title =
                extractTitleFromContext(email, content) ||
                extractTitleFromContext(name, content) ||
                "Hockey Coach";

              // Replace any generated contact with the same name with this real email
              const existingIndex = contacts.findIndex(
                (c) =>
                  c.name && name && c.name.toLowerCase() === name.toLowerCase()
              );

              if (existingIndex >= 0) {
                contacts[existingIndex] = {
                  email,
                  name,
                  title,
                  source: coachUrl,
                  confidence: "Confirmed", // Mark as confirmed email
                };
              } else {
                contacts.push({
                  email,
                  name,
                  title,
                  source: coachUrl,
                  confidence: "Confirmed", // Mark as confirmed email
                });
              }
            });
          }
        } catch (error) {
          console.error(`Error processing coach profile ${coachUrl}:`, error);
        }
      }
    }

    return removeDuplicateContacts(contacts);
  } catch (error) {
    console.error("Error in enhanced processTravelSportsCoaches:", error);
    return contacts;
  }
}

/**
 * Process USA Hockey/Team USA sites
 */
async function processUSAHockeySite(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  console.log("Processing USA Hockey site");
  const contacts: ScrapedContact[] = [];

  try {
    // Common patterns for USA Hockey sites
    const staffSelectors = [
      ".staff-member",
      ".team-member",
      ".coach-profile",
      ".directory-item",
      "[class*='staff']",
      "[class*='coach']",
      "[class*='directory']",
    ];

    // Try each selector
    for (const selector of staffSelectors) {
      const staffElements = await page.$$(selector);
      if (staffElements.length > 0) {
        console.log(
          `Found ${staffElements.length} staff members with selector: ${selector}`
        );

        // Process each staff element
        for (const element of staffElements) {
          const staffInfo = await element.evaluate((el) => {
            // Name extraction
            const nameElement = el.querySelector(
              "h2, h3, h4, .name, [class*='name'], strong"
            );
            const name = nameElement ? nameElement.textContent?.trim() : null;

            // Title extraction
            const titleElement = el.querySelector(
              ".title, [class*='title'], [class*='position'], em, i"
            );
            const title = titleElement
              ? titleElement.textContent?.trim()
              : null;

            // Email extraction
            let email = null;
            const emailLink = el.querySelector("a[href^='mailto:']");
            if (emailLink) {
              const href = emailLink.getAttribute("href");
              if (href) email = href.replace("mailto:", "").trim();
            }

            return { name, title, email };
          });

          if (staffInfo.name) {
            contacts.push({
              email:
                staffInfo.email ||
                `${staffInfo.name
                  .replace(/\s+/g, ".")
                  .toLowerCase()}@usahockey.org`,
              name: staffInfo.name,
              title: staffInfo.title || "Coach",
              source: url,
              confidence: staffInfo.email ? "Confirmed" : "Generated",
            });
          }
        }

        // If we found staff members, no need to try other selectors
        if (contacts.length > 0) break;
      }
    }

    return contacts;
  } catch (error) {
    console.error("Error processing USA Hockey site:", error);
    return contacts;
  }
}

/**
 * Process college athletics sites (NCAA, university sites, etc.)
 */
async function processCollegeAthleticsSite(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  console.log("Processing College Athletics site");
  const contacts: ScrapedContact[] = [];

  try {
    // Common patterns for college sites
    const coachSelectors = [
      ".staff-bio",
      ".coach-bio",
      ".coach-card",
      ".staff-member",
      ".directory-item",
      "[class*='coach']",
      "[class*='staff']",
      "table tr",
    ];

    // Try each selector
    for (const selector of coachSelectors) {
      const coachElements = await page.$$(selector);
      if (coachElements.length > 0) {
        console.log(
          `Found ${coachElements.length} coaches with selector: ${selector}`
        );

        // Process each coach element
        for (const element of coachElements) {
          const coachInfo = await element.evaluate((el) => {
            // Name extraction
            const nameElement = el.querySelector(
              "h2, h3, h4, .name, [class*='name'], a, strong, td:first-child"
            );
            const name = nameElement ? nameElement.textContent?.trim() : null;

            // Title extraction
            const titleElement = el.querySelector(
              ".title, [class*='title'], [class*='position'], em, i, td:nth-child(2)"
            );
            const title = titleElement
              ? titleElement.textContent?.trim()
              : null;

            // Email extraction
            let email = null;
            const emailLink = el.querySelector("a[href^='mailto:']");
            if (emailLink) {
              const href = emailLink.getAttribute("href");
              if (href) email = href.replace("mailto:", "").trim();
            }

            return { name, title, email };
          });

          if (coachInfo.name) {
            // Extract domain from URL
            const domain = new URL(url).hostname;

            contacts.push({
              email:
                coachInfo.email ||
                `${coachInfo.name
                  .replace(/\s+/g, ".")
                  .toLowerCase()}@${domain}`,
              name: coachInfo.name,
              title: coachInfo.title || "Coach",
              source: url,
              confidence: coachInfo.email ? "Confirmed" : "Generated",
            });
          }
        }

        // If we found coaches, no need to try other selectors
        if (contacts.length > 0) break;
      }
    }

    return contacts;
  } catch (error) {
    console.error("Error processing College Athletics site:", error);
    return contacts;
  }
}

/**
 * Extract contacts using general strategy for coach directories
 */
async function extractContactsWithGeneralStrategy(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  console.log("Applying general coach extraction strategy");
  const contacts: ScrapedContact[] = [];

  try {
    // 1. Extract all mailto links - most reliable method
    const mailtoLinks = await page.$$("a[href^='mailto:']");
    for (const link of mailtoLinks) {
      try {
        const href = await link.getAttribute("href");
        if (href && href.startsWith("mailto:")) {
          const email = href.replace("mailto:", "").trim();

          // Get context around the mailto link
          const contextHTML = await link.evaluate((el) => {
            const parent = el.closest("div, li, article, section, tr");
            return parent ? parent.innerHTML : el.innerHTML;
          });

          const name = extractNameFromContext(email, contextHTML);
          const title = name
            ? extractTitleFromContext(name, contextHTML)
            : extractTitleFromContext(email, contextHTML);

          contacts.push({
            email,
            name: name || undefined,
            title: title || undefined,
            source: url,
            confidence: "Confirmed",
          });
        }
      } catch (error) {
        console.error("Error processing mailto link:", error);
      }
    }

    // 2. If no mailto links found, look for email patterns in the page content
    if (contacts.length === 0) {
      const content = await page.content();
      const emails = extractEmails(content);

      for (const email of emails) {
        const name = extractNameFromContext(email, content);
        const title = name
          ? extractTitleFromContext(name, content)
          : extractTitleFromContext(email, content);

        contacts.push({
          email,
          name: name || undefined,
          title: title || undefined,
          source: url,
          confidence: "Confirmed",
        });
      }
    }

    return contacts;
  } catch (error) {
    console.error("Error in general extraction strategy:", error);
    return contacts;
  }
}

/**
 * Navigate to contact pages and extract information
 */
async function navigateToContactPages(
  page: Page,
  originalUrl: string
): Promise<ScrapedContact[]> {
  console.log("Navigating to contact pages");
  const contacts: ScrapedContact[] = [];

  try {
    // Find contact page links
    const contactLinks = await page.evaluate(() => {
      const links: string[] = [];
      const contactTerms = [
        "contact",
        "staff",
        "directory",
        "coaches",
        "about",
        "team",
      ];

      // Get all links
      const allLinks = Array.from(document.querySelectorAll("a"));

      // Filter for contact-related links
      for (const link of allLinks) {
        const href = link.getAttribute("href");
        if (!href) continue;

        const text = link.textContent?.toLowerCase() || "";
        const hrefLower = href.toLowerCase();

        // Check if link text or href contains contact terms
        const isContactLink = contactTerms.some(
          (term) => text.includes(term) || hrefLower.includes(term)
        );

        if (isContactLink) {
          // Convert to absolute URL if needed
          if (href.startsWith("http")) {
            links.push(href);
          } else if (href.startsWith("/")) {
            links.push(window.location.origin + href);
          } else {
            links.push(window.location.origin + "/" + href);
          }
        }
      }

      // Remove duplicates
      return [...new Set(links)];
    });

    console.log(`Found ${contactLinks.length} potential contact pages`);

    // Visit up to 3 contact pages
    for (const link of contactLinks.slice(0, 3)) {
      try {
        console.log(`Navigating to contact page: ${link}`);
        await page.goto(link, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});

        // Extract contacts from this page
        const pageContacts = await extractContactsWithGeneralStrategy(
          page,
          link
        );
        contacts.push(...pageContacts);
      } catch (error) {
        console.error(`Error processing contact page ${link}:`, error);
      }
    }

    // Return to the original page
    if (contactLinks.length > 0) {
      await page.goto(originalUrl, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    return contacts;
  } catch (error) {
    console.error("Error navigating to contact pages:", error);
    return contacts;
  }
}

/**
 * Generate email contacts from team member names when no emails are available
 */
async function generateContactsFromTeamMembers(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  console.log("Generating contacts from team member names");
  const contacts: ScrapedContact[] = [];

  try {
    // Extract domain from URL for email generation
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Find team member names on the page
    const teamMembers = await page.evaluate(() => {
      const members: { name: string; title: string | null }[] = [];

      // Look for name patterns in headings, strong text, etc.
      const nameElements = document.querySelectorAll(
        "h1, h2, h3, h4, h5, strong, [class*='name']"
      );

      for (const el of nameElements) {
        const text = el.textContent?.trim();
        if (!text || text.length < 4 || text.length > 40) continue;

        // Look for standard name patterns (First Last)
        if (/^[A-Z][a-z]+(?:\s[A-Z][a-z]+)+$/.test(text)) {
          // Find potential title near this name
          let title = null;

          // Check next sibling
          let sibling = el.nextElementSibling;
          if (
            sibling &&
            sibling.textContent &&
            sibling.textContent.length < 100
          ) {
            title = sibling.textContent.trim();
          }

          // Check parent's next sibling
          if (
            !title &&
            el.parentElement &&
            el.parentElement.nextElementSibling
          ) {
            const parentSibling = el.parentElement.nextElementSibling;
            if (
              parentSibling.textContent &&
              parentSibling.textContent.length < 100
            ) {
              title = parentSibling.textContent.trim();
            }
          }

          members.push({
            name: text,
            title,
          });
        }
      }

      return members;
    });

    console.log(`Found ${teamMembers.length} potential team members`);

    // Generate email addresses for team members
    for (const member of teamMembers) {
      // Skip very common names that might be false positives
      if (["Contact Us", "About Us", "Home Page"].includes(member.name))
        continue;

      // Generate email formats
      const nameParts = member.name.split(" ");
      if (nameParts.length >= 2) {
        const firstName = nameParts[0].toLowerCase();
        const lastName = nameParts[nameParts.length - 1].toLowerCase();

        // Primary email format (most common)
        const primaryEmail = `${firstName}.${lastName}@${domain}`;

        // Alternative email formats
        const alternateEmails = [
          `${firstName}${lastName}@${domain}`,
          `${firstName[0]}${lastName}@${domain}`,
          `${lastName}${firstName[0]}@${domain}`,
          `${firstName}@${domain}`,
          `${lastName}@${domain}`,
          `${firstName}_${lastName}@${domain}`,
          `${lastName}.${firstName}@${domain}`,
        ];

        contacts.push({
          email: primaryEmail,
          name: member.name,
          title: member.title || "Coach",
          source: url,
          alternateEmails: alternateEmails,
          confidence: "Generated - Verification Required",
        });
      }
    }

    return contacts;
  } catch (error) {
    console.error("Error generating contacts from team members:", error);
    return contacts;
  }
}

/**
 * Remove duplicate contacts based on email address
 */
function removeDuplicateContacts(contacts: ScrapedContact[]): ScrapedContact[] {
  const uniqueEmails = new Map<string, ScrapedContact>();

  contacts.forEach((contact) => {
    if (!contact.email) return;

    const normalizedEmail = contact.email.toLowerCase().trim();

    // If this email already exists, only replace it if the new contact has more info
    // or a higher confidence level
    const existing = uniqueEmails.get(normalizedEmail);

    if (!existing) {
      uniqueEmails.set(normalizedEmail, contact);
    } else {
      // Prioritize confirmed emails over generated ones
      const existingIsConfirmed = existing.confidence === "Confirmed";
      const newIsConfirmed = contact.confidence === "Confirmed";

      if (
        (newIsConfirmed && !existingIsConfirmed) ||
        (!existing.name && contact.name) ||
        (!existing.title && contact.title)
      ) {
        // Keep the contact with more information or higher confidence
        uniqueEmails.set(normalizedEmail, {
          ...existing,
          name: contact.name || existing.name,
          title: contact.title || existing.title,
          confidence: newIsConfirmed ? "Confirmed" : existing.confidence,
        });
      }
    }
  });

  return Array.from(uniqueEmails.values());
}

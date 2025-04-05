/**
 * Specialized scraper utilities for handling dynamic content websites
 * This module helps extract data from websites that load content via JavaScript
 * or have special content structures like coaching directories
 */
import { ScrapedContact } from "./types";
import {
  extractEmails,
  extractNameFromEmailContext as extractNameFromContext,
  extractTitleFromEmailContext as extractTitleFromContext,
} from "./emailExtractor";
import { Page, ElementHandle } from "playwright";
import { getNameFromText, getTitleFromText } from "./utils";

// Type definitions
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface CoachData {
  email: string | null;
  name: string | null;
  position: string | null;
}

interface EmailNamePair {
  email: string;
  name?: string;
}

interface CoachSelectors {
  COACH_CARD: string[];
  EMAIL: string[];
  NAME: string[];
  POSITION: string[];
}

// Common selectors for coaching websites
const COACH_SELECTORS: CoachSelectors = {
  // Coach cards/profiles
  COACH_CARD: [
    ".coach-card",
    ".staff-member",
    ".coach-profile",
    ".team-member",
    ".card",
    ".profile",
    "[class*='coach']",
    "[class*='staff']",
    "article",
  ],

  // Contact information
  EMAIL: [
    "a[href^='mailto:']",
    ".email",
    ".contact-email",
    "[class*='email']",
    "[data-email]",
    "[class*='contact']",
  ],

  // Name selectors
  NAME: [
    "h1",
    "h2",
    "h3",
    "h4",
    ".name",
    ".coach-name",
    ".staff-name",
    ".title",
    "strong",
    ".profile-name",
  ],

  // Title/position selectors
  POSITION: [
    ".position",
    ".title",
    ".coach-title",
    ".role",
    ".job-title",
    ".designation",
    "[class*='position']",
    "[class*='title']",
    "[class*='role']",
    "em",
    "i",
  ],
};

/**
 * Process coaching directory websites with specialized selectors and strategies
 */
export async function processCoachDirectory(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  console.log(`Applying specialized coach directory processing for ${url}`);
  const contacts: ScrapedContact[] = [];

  try {
    // Make sure the page is fully loaded
    await page.waitForLoadState("networkidle").catch(() => {});

    // Handle travel sports coaching directory specifically
    if (url.includes("travelsports.com/coaches")) {
      return await processTravelSportsCoaches(page, url);
    }

    // 1. First try to find coach cards/profiles on the page
    const foundCoachElements = await findCoachElements(page);

    if (foundCoachElements && foundCoachElements.length > 0) {
      console.log(`Found ${foundCoachElements.length} coach elements`);

      // Process each coach element
      for (const element of foundCoachElements) {
        const contact = await extractCoachInfo(page, element, url);
        if (contact && contact.email) {
          contacts.push(contact);
        }
      }
    } else {
      // 2. If no coach cards found, look for general email and contact information
      console.log("No coach cards found, looking for general contact info");
      const generalContacts = await extractPageContacts(page, url);
      contacts.push(...generalContacts);

      // 3. Check "Contact", "Staff", "About" or "Coaches" pages if available
      const contactLinks = await findContactAndStaffLinks(page);
      if (contactLinks.length > 0) {
        for (const link of contactLinks.slice(0, 3)) {
          // Limit to 3 links to avoid too much processing
          try {
            console.log(`Navigating to contact page: ${link}`);
            await page.goto(link, { waitUntil: "domcontentloaded" });
            await page.waitForLoadState("networkidle").catch(() => {});

            const pageContacts = await extractPageContacts(page, link);
            contacts.push(...pageContacts);
          } catch (error) {
            console.error(`Error processing contact page ${link}:`, error);
          }
        }
      }
    }

    // 4. Special handling for websites with email protection or encoding
    const hasProtection = await checkForEmailProtection(page);
    if (hasProtection) {
      console.log("Detected email protection, applying specialized techniques");
      const protectedEmails = await extractProtectedEmails(page, url);
      contacts.push(...protectedEmails);
    }

    // Remove duplicate contacts
    return removeDuplicateContacts(contacts);
  } catch (error) {
    console.error("Error in processCoachDirectory:", error);
    return contacts;
  }
}

/**
 * Specialized handler for Travel Sports coaching directory
 */
async function processTravelSportsCoaches(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  console.log("Processing Travel Sports Coaches directory");
  const contacts: ScrapedContact[] = [];

  try {
    // Extract coach information directly from the main coaches page
    console.log("Extracting coach information from coaches list page");

    // Get real emails directly from the page content
    const content = await page.content();
    const emails = extractEmails(content);

    if (emails.length > 0) {
      console.log(`Found ${emails.length} emails directly on the page`);

      for (const email of emails) {
        // Look for surrounding context to extract name and title
        const name = extractNameFromContext(content, email) || "";
        const title = extractTitleFromContext(content, email) || "Coach";

        contacts.push({
          email,
          name,
          title,
          source: url,
          confidence: "Confirmed",
        });
      }
    } else {
      console.log("No emails found directly, extracting coach details");

      // Extract coach names and titles without guessing emails
      const coachData = await page.evaluate(() => {
        const coaches: Array<{
          name: string | null;
          title: string | null;
          url: string | null;
        }> = [];

        // Get all coach entries from the list
        const coachEntries = document.querySelectorAll('*[href*="/coaches/"]');

        coachEntries.forEach((entry) => {
          const url = entry.getAttribute("href");
          if (!url || url.includes("/register") || url === "/coaches") return;

          // Get the parent element that contains the coach information
          const coachCard = entry.closest("li");
          if (!coachCard) return;

          // Extract coach name from the link
          const nameEl = coachCard.querySelector('a[href*="/coaches/"] strong');
          const name =
            nameEl && nameEl.textContent ? nameEl.textContent.trim() : null;

          // If we don't have a name, try to extract it from the URL
          const urlName = url.split("/").pop()?.replace(/-/g, " ");
          const coachName = name || urlName || null;

          // Extract specialties and divisions
          const divs = Array.from(coachCard.querySelectorAll("div"));
          const specialtiesDiv = divs.find((d) =>
            d.textContent?.includes("Specialties:")
          );
          const specialtiesText =
            specialtiesDiv && specialtiesDiv.textContent
              ? specialtiesDiv.textContent.trim()
              : null;

          const divisionsDiv = divs.find((d) =>
            d.textContent?.includes("Divisions:")
          );
          const divisionsText =
            divisionsDiv && divisionsDiv.textContent
              ? divisionsDiv.textContent.trim()
              : null;

          coaches.push({
            name: coachName,
            title: (specialtiesText || divisionsText || "Hockey Coach")
              .replace("Specialties:", "")
              .replace("Divisions:", "")
              .trim(),
            url: url,
          });
        });

        return coaches;
      });

      // Visit coach profile pages to find real emails
      const coachUrls = coachData
        .filter((coach) => coach.url)
        .map((coach) => {
          const path = coach.url;
          if (path?.startsWith("http")) return path;
          if (path?.startsWith("/")) {
            // Convert relative URL to absolute
            const baseUrl = new URL(url);
            return `${baseUrl.protocol}//${baseUrl.host}${path}`;
          }
          return path;
        })
        .filter((url): url is string => url !== null && url !== "");

      // Visit coach pages to find actual emails
      for (const coachUrl of coachUrls.slice(0, 5)) {
        try {
          await page.goto(coachUrl, { waitUntil: "domcontentloaded" });
          await page.waitForLoadState("networkidle").catch(() => {});

          // Extract coach info from profile page
          const content = await page.content();
          const emails = extractEmails(content);

          if (emails.length > 0) {
            emails.forEach((email) => {
              // Extract name from URL or page content
              const nameFromUrl = coachUrl.split("/").pop()?.replace(/-/g, " ");
              const name =
                extractNameFromContext(content, email) ||
                nameFromUrl ||
                "Coach";

              const title =
                extractTitleFromContext(content, email) ||
                extractTitleFromContext(content, name) ||
                "Coach";

              contacts.push({
                email,
                name,
                title,
                source: coachUrl,
                confidence: "Confirmed",
              });
            });
          }
        } catch (error) {
          console.error(`Error processing coach profile ${coachUrl}:`, error);
        }
      }
    }

    return removeDuplicateContacts(contacts);
  } catch (error) {
    console.error("Error in processTravelSportsCoaches:", error);
    return contacts;
  }
}

/**
 * Find elements on the page that look like coach cards or profiles
 */
async function findCoachElements(page: Page): Promise<ElementHandle[]> {
  try {
    // Try each selector in order of specificity
    for (const selector of COACH_SELECTORS.COACH_CARD) {
      const elements = await page.$$(selector).catch(() => []);
      if (elements.length > 0) {
        return elements;
      }
    }

    // If no specific coach elements found, try finding containers with person details
    const personContainers = await page.evaluate(() => {
      // Look for elements that might contain person info
      const containers: Element[] = [];
      const elements = document.querySelectorAll("div, section, article, li");

      for (const el of elements) {
        // Check if element contains any name, position, or email indicator
        const text = el.textContent?.toLowerCase() || "";
        const html = (el as HTMLElement).innerHTML?.toLowerCase() || "";

        // Look for common indicators of a person/coach card
        const hasName =
          /(^|[^a-z])coach|director|manager|instructor|trainer($|[^a-z])/i.test(
            text
          );
        const hasPosition = /position|title|role/i.test(html);
        const hasEmail = /email|contact|mailto/i.test(html);
        const hasPersonIndicator = hasName || hasPosition || hasEmail;

        // Make sure it's not too large (likely a content section) or too small (likely just a label)
        const size = el.getBoundingClientRect();
        const isReasonableSize =
          size.width > 100 &&
          size.width < 600 &&
          size.height > 80 &&
          size.height < 500;

        if (hasPersonIndicator && isReasonableSize) {
          containers.push(el);
        }
      }

      return containers.map((c) => (c as HTMLElement).outerHTML);
    });

    if (personContainers.length > 0) {
      // Convert HTML strings back to elements
      const elements: ElementHandle[] = [];
      for (const html of personContainers) {
        try {
          // Create a new element in the DOM and evaluate to get its handle
          const el = await page.$eval(
            "body",
            (body, htmlContent: string) => {
              const container = document.createElement("div");
              container.innerHTML = htmlContent;
              const element = container.firstElementChild;
              if (element) {
                // Append to body temporarily to get a handle, will remove after
                body.appendChild(element);
                return element;
              }
              return null;
            },
            html
          );

          if (el) {
            // Now get an element handle to the appended element
            const handle = await page.$("body > :last-child");
            if (handle) {
              elements.push(handle);
              // Clean up - remove the element we added
              await page.evaluate(() => {
                const lastChild = document.body.lastElementChild;
                if (lastChild) lastChild.remove();
              });
            }
          }
        } catch (err) {
          console.error("Error creating element handle:", err);
        }
      }
      return elements;
    }

    return [];
  } catch (error) {
    console.error("Error finding coach elements:", error);
    return [];
  }
}

/**
 * Extract coach information from a specific element
 */
async function extractCoachInfo(
  page: Page,
  element: ElementHandle,
  sourceUrl: string
): Promise<ScrapedContact | null> {
  try {
    // Extract information from the element
    const data = await element.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el: any, selectorsJson: string) => {
        // Parse the JSON string back to an object
        const selectors = JSON.parse(selectorsJson);

        const getTextContent = (
          element: Element,
          selector: string
        ): string | null => {
          const child = element.querySelector(selector);
          return child ? child.textContent?.trim() || null : null;
        };

        // Ensure el is treated as an Element
        const element = el as Element;

        // Check for email in href attributes
        let email = null;
        const mailtoLink = element.querySelector('a[href^="mailto:"]');
        if (mailtoLink) {
          const href = mailtoLink.getAttribute("href");
          if (href) {
            email = href.replace("mailto:", "").trim();
          }
        }

        // Try each email selector
        if (!email) {
          for (const selector of selectors.EMAIL) {
            const emailEl = element.querySelector(selector);
            if (emailEl) {
              // Check for data-email attribute
              if (emailEl.hasAttribute("data-email")) {
                email = emailEl.getAttribute("data-email");
                break;
              }

              // Check if this is a mailto link
              if (emailEl.tagName === "A") {
                const href = emailEl.getAttribute("href");
                if (href && href.startsWith("mailto:")) {
                  email = href.replace("mailto:", "").trim();
                  break;
                }
              }

              // Check text content for email pattern
              const text = emailEl.textContent?.trim();
              if (
                text &&
                /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)
              ) {
                const matches = text.match(
                  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
                );
                email = matches ? matches[0] : null;
                break;
              }
            }
          }
        }

        // Try to find name - check each name selector
        let name = null;
        for (const selector of selectors.NAME) {
          const nameText = getTextContent(element, selector);
          if (nameText) {
            // Skip if it looks like an email or contains "mailto"
            if (
              nameText.includes("@") ||
              nameText.toLowerCase().includes("mailto")
            ) {
              continue;
            }
            name = nameText;
            break;
          }
        }

        // Try to find title/position - check each position selector
        let title = null;
        for (const selector of selectors.POSITION) {
          const titleText = getTextContent(element, selector);
          if (titleText) {
            // Skip if it looks like an email or contains "mailto"
            if (
              titleText.includes("@") ||
              titleText.toLowerCase().includes("mailto")
            ) {
              continue;
            }
            // Skip if it's likely the name again
            if (name && titleText === name) {
              continue;
            }
            title = titleText;
            break;
          }
        }

        // Use best available data
        return {
          email,
          name,
          title,
        };
      },
      JSON.stringify(COACH_SELECTORS)
    );

    // If no email found, don't create a contact
    if (!data.email) {
      return null;
    }

    // Create contact object
    return {
      email: data.email,
      name: data.name || undefined,
      title: data.title || undefined,
      source: sourceUrl,
      confidence: "Confirmed",
    };
  } catch (error) {
    console.error("Error extracting coach info:", error);
    return null;
  }
}

/**
 * Extract email and contact information from a full page
 */
async function extractPageContacts(
  page: Page,
  sourceUrl: string
): Promise<ScrapedContact[]> {
  const contacts: ScrapedContact[] = [];

  try {
    // 1. Check for mailto links on the page
    const mailtoLinks = await page.$$eval(
      "a[href^='mailto:']",
      (links: Element[]) => {
        return links
          .map((link) => {
            const href = link.getAttribute("href");
            const email = href ? href.replace("mailto:", "").trim() : null;
            if (!email) return null;

            // Try to get name from surrounding elements
            let name = null;
            let parentNode = link.parentElement;
            for (let i = 0; i < 3 && parentNode; i++) {
              // Check if there's a name in the parent's text
              const parentText = parentNode.textContent || "";
              const nameMatch = parentText.match(
                /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/
              );
              if (nameMatch && nameMatch[1] !== email) {
                name = nameMatch[1];
                break;
              }
              parentNode = parentNode.parentElement;
            }

            return {
              email,
              name: name || null,
            };
          })
          .filter(
            (item): item is { email: string; name: string | null } =>
              item !== null
          );
      }
    );

    // Convert to contacts
    for (const link of mailtoLinks) {
      contacts.push({
        email: link.email,
        name: link.name || undefined,
        source: sourceUrl,
        confidence: "Confirmed",
      });
    }

    // 2. Check page content for embedded emails
    const content = await page.content();
    const extractedEmails = extractEmails(content);

    // Process each email
    for (const email of extractedEmails) {
      // Skip if we already have this email
      if (contacts.some((c) => c.email === email)) {
        continue;
      }

      const name = extractNameFromContext(content, email);
      const title = extractTitleFromContext(content, email);

      contacts.push({
        email,
        name: name || undefined,
        title: title || undefined,
        source: sourceUrl,
        confidence: "Confirmed",
      });
    }

    return contacts;
  } catch (error) {
    console.error("Error extracting page contacts:", error);
    return contacts;
  }
}

/**
 * Find contact and staff/about links to check for contact information
 */
async function findContactAndStaffLinks(page: Page): Promise<string[]> {
  try {
    return await page.evaluate(() => {
      const baseUrl = window.location.origin;
      const currentPath = window.location.pathname;

      // Look for links with relevant keywords
      return Array.from(document.querySelectorAll("a"))
        .filter((link) => {
          const href = link.getAttribute("href");
          const text = link.textContent?.toLowerCase() || "";

          if (!href) return false;

          // Check if it's a relevant link based on text or href
          const isContactLink =
            text.includes("contact") ||
            text.includes("staff") ||
            text.includes("coaches") ||
            text.includes("team") ||
            text.includes("about") ||
            href.includes("contact") ||
            href.includes("staff") ||
            href.includes("coaches") ||
            href.includes("team") ||
            href.includes("about");

          // Ignore links to the current page
          if (href === currentPath || href === "#") return false;

          return isContactLink;
        })
        .map((link) => {
          const href = link.getAttribute("href");
          if (!href) return "";

          // Convert relative to absolute URL
          if (href.startsWith("http")) return href;
          if (href.startsWith("/")) return baseUrl + href;
          return baseUrl + "/" + href;
        })
        .filter((url) => url !== "");
    });
  } catch (error) {
    console.error("Error finding contact links:", error);
    return [];
  }
}

/**
 * Check if the website uses email protection methods
 */
async function checkForEmailProtection(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      // Check for CloudFlare email protection
      const hasCloudflareProtection =
        document.querySelector("[data-cfemail]") !== null;

      // Check for email protection scripts
      const hasProtectionScript =
        document.querySelector("script[data-cfasync]") !== null ||
        document.querySelector("script[data-email-protection]") !== null;

      return hasCloudflareProtection || hasProtectionScript;
    });
  } catch (error) {
    console.error("Error checking for email protection:", error);
    return false;
  }
}

/**
 * Extract emails from protected content
 */
async function extractProtectedEmails(
  page: Page,
  sourceUrl: string
): Promise<ScrapedContact[]> {
  try {
    // Try to extract CloudFlare protected emails
    const cloudflareEmails = await page.evaluate(() => {
      const results: EmailNamePair[] = [];

      // Function to decode CloudFlare email
      const decodeCloudflareEmail = (encoded: string): string => {
        let r = "";
        const a = parseInt(encoded.substring(0, 2), 16);
        for (let i = 2; i < encoded.length; i += 2) {
          const c = parseInt(encoded.substring(i, i + 2), 16) ^ a;
          r += String.fromCharCode(c);
        }
        return r;
      };

      // Process elements with data-cfemail attribute
      document.querySelectorAll("[data-cfemail]").forEach((el) => {
        const encodedEmail = el.getAttribute("data-cfemail");
        if (encodedEmail) {
          const email = decodeCloudflareEmail(encodedEmail);
          results.push({ email });
        }
      });

      // Process elements with data-email attribute
      document.querySelectorAll("[data-email]").forEach((el) => {
        const email = el.getAttribute("data-email");
        if (email) {
          results.push({ email });
        }
      });

      return results;
    });

    // Convert to contact format
    const contacts: ScrapedContact[] = cloudflareEmails.map(
      (item: EmailNamePair) => ({
        email: item.email,
        name: item.name,
        source: sourceUrl,
        confidence: "Confirmed",
      })
    );

    return contacts;
  } catch (error) {
    console.error("Error extracting protected emails:", error);
    return [];
  }
}

/**
 * Remove duplicate contacts from the results
 */
function removeDuplicateContacts(contacts: ScrapedContact[]): ScrapedContact[] {
  const uniqueEmails = new Map<string, ScrapedContact>();

  contacts.forEach((contact) => {
    const email = contact.email.toLowerCase();
    if (!uniqueEmails.has(email)) {
      uniqueEmails.set(email, contact);
    } else {
      // If we already have this email, use the contact with more information
      const existing = uniqueEmails.get(email)!;
      if (!existing.name && contact.name) {
        existing.name = contact.name;
      }
      if (!existing.title && contact.title) {
        existing.title = contact.title;
      }
    }
  });

  return Array.from(uniqueEmails.values());
}

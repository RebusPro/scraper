/**
 * Specialized scraper utilities for handling dynamic content websites
 * This module helps extract data from websites that load content via JavaScript
 * or have special content structures like coaching directories
 */
import { ScrapedContact } from "./types";
import {
  extractEmails,
  extractNameFromContext,
  extractTitleFromContext,
} from "./emailExtractor";
import { Page, ElementHandle } from "playwright";

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
    // instead of visiting individual coach pages for better performance
    console.log(
      "Extracting coach information directly from the coaches list page"
    );

    const coachData = await page.evaluate(() => {
      const coaches: Array<{
        name: string | null;
        title: string | null;
        url: string | null;
        emails: string[];
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

        // Construct possible email formats from the name
        const possibleEmails: string[] = [];
        if (coachName) {
          const nameParts = coachName.split(" ");
          if (nameParts.length >= 2) {
            const firstName = nameParts[0].toLowerCase();
            const lastName = nameParts[nameParts.length - 1].toLowerCase();

            possibleEmails.push(
              `${firstName}.${lastName}@travelsports.com`,
              `${firstName}${lastName}@travelsports.com`,
              `${firstName[0]}${lastName}@travelsports.com`,
              `${lastName}${firstName[0]}@travelsports.com`,
              `coach@${lastName}hockey.com`
            );
          }
        }

        coaches.push({
          name: coachName,
          title: (specialtiesText || divisionsText || "Hockey Coach")
            .replace("Specialties:", "")
            .replace("Divisions:", "")
            .trim(),
          url: url,
          emails: possibleEmails,
        });
      });

      return coaches;
    });

    // Convert the coach data to contact format
    coachData.forEach((coach) => {
      if (coach.name && coach.emails && coach.emails.length > 0) {
        contacts.push({
          email: coach.emails[0], // Use the first email format
          name: coach.name,
          title: coach.title || undefined,
          source: url,
          alternateEmails: coach.emails.slice(1), // Store alternate emails
        });
      }
    });

    console.log(
      `Extracted ${contacts.length} potential contacts from Travel Sports`
    );

    // If we don't have many contacts, try scraping a few individual pages as a fallback
    if (contacts.length < 3) {
      console.log("Falling back to individual coach page scraping");
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

      // Visit only 3 coach pages at most for performance
      for (const coachUrl of coachUrls.slice(0, 3)) {
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
                extractNameFromContext(email, content) ||
                nameFromUrl ||
                "Coach";

              const title =
                extractTitleFromContext(email, content) ||
                extractTitleFromContext(name, content) ||
                "Coach";

              contacts.push({
                email,
                name,
                title,
                source: coachUrl,
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

        // Extract name
        let name = null;
        for (const selector of selectors.NAME) {
          const nameText = getTextContent(element, selector);
          if (nameText && nameText.length > 2 && nameText.length < 50) {
            name = nameText;
            break;
          }
        }

        // Extract position/title
        let position = null;
        for (const selector of selectors.POSITION) {
          const positionText = getTextContent(element, selector);
          if (
            positionText &&
            positionText !== name &&
            positionText.length < 100
          ) {
            position = positionText;
            break;
          }
        }

        // If we still don't have a position, look for text that might be a position
        if (!position && element.textContent) {
          const allText = element.textContent;
          const lines = allText
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line);

          // Look for text following the name that could be a position
          if (name && lines.length > 1) {
            const nameIndex = lines.findIndex((line) => line.includes(name));
            if (nameIndex >= 0 && nameIndex < lines.length - 1) {
              const nextLine = lines[nameIndex + 1];
              if (nextLine !== email && nextLine.length < 100) {
                position = nextLine;
              }
            }
          }
        }

        return { email, name, position };
      },
      JSON.stringify({
        EMAIL: COACH_SELECTORS.EMAIL,
        NAME: COACH_SELECTORS.NAME,
        POSITION: COACH_SELECTORS.POSITION,
      })
    );

    if (data.email) {
      return {
        email: data.email,
        name: data.name || undefined,
        title: data.position || undefined,
        source: sourceUrl,
      };
    }

    return null;
  } catch (error) {
    console.error("Error extracting coach info:", error);
    return null;
  }
}

/**
 * Extract contact information directly from the page content
 */
async function extractPageContacts(
  page: Page,
  sourceUrl: string
): Promise<ScrapedContact[]> {
  const contacts: ScrapedContact[] = [];

  try {
    // Extract all mailto links - this is the most reliable method
    const mailtoLinks = await page.$$eval(
      "a[href^='mailto:']",
      (links: Element[]) => {
        return links
          .map((link) => {
            const href = link.getAttribute("href");
            if (!href) return null;

            const email = href.replace("mailto:", "").trim();
            if (!email) return null;

            // Try to find the name and position near the email link
            let name = null;
            let position = null;

            // Check for parent or nearby headings
            const parentElement = link.parentElement;
            if (parentElement) {
              // Search for headings or strong/b elements that might contain a name
              const heading = parentElement.querySelector(
                "h1, h2, h3, h4, strong, b"
              );
              if (heading && heading.textContent) {
                name = heading.textContent.trim();
              }

              // Look for position in the parent element text
              const paragraphs = parentElement.querySelectorAll("p");
              for (const p of paragraphs) {
                const text = p.textContent?.trim();
                if (
                  text &&
                  text !== name &&
                  !text.includes("@") &&
                  text.length < 100
                ) {
                  position = text;
                  break;
                }
              }
            }

            return { email, name, position };
          })
          .filter(
            (
              item
            ): item is {
              email: string;
              name: string | null;
              position: string | null;
            } => item !== null
          );
      }
    );

    // Convert to contacts
    for (const link of mailtoLinks) {
      contacts.push({
        email: link.email,
        name: link.name || undefined,
        title: link.position || undefined,
        source: sourceUrl,
      });
    }

    // If no mailto links, try to extract emails from text
    if (contacts.length === 0) {
      const content = await page.content();
      const emails = extractEmails(content);

      for (const email of emails) {
        const name = extractNameFromContext(email, content);
        const title = extractTitleFromContext(email, content);

        contacts.push({
          email,
          name: name || undefined,
          title: title || undefined,
          source: sourceUrl,
        });
      }
    }

    return contacts;
  } catch (error) {
    console.error("Error extracting page contacts:", error);
    return contacts;
  }
}

/**
 * Find links to Contact, Staff, About or Coaches pages
 */
async function findContactAndStaffLinks(page: Page): Promise<string[]> {
  try {
    return await page.evaluate(() => {
      const baseUrl = window.location.origin;
      const currentUrl = window.location.href;

      return (
        Array.from(document.querySelectorAll("a"))
          .filter((link) => {
            if (!link.href || link.href === currentUrl) return false;

            const text = link.textContent?.toLowerCase() || "";
            const href = link.href.toLowerCase();

            return (
              text.includes("contact") ||
              text.includes("staff") ||
              text.includes("about") ||
              text.includes("team") ||
              text.includes("coach") ||
              href.includes("contact") ||
              href.includes("staff") ||
              href.includes("about") ||
              href.includes("team") ||
              href.includes("coach")
            );
          })
          .map((link) => {
            // Ensure absolute URLs
            if (link.href.startsWith("http")) return link.href;
            return new URL(link.href, baseUrl).href;
          })
          // Remove duplicates
          .filter((href, i, arr) => arr.indexOf(href) === i)
      );
    });
  } catch (error) {
    console.error("Error finding contact links:", error);
    return [];
  }
}

/**
 * Check if the website uses email protection/encoding
 */
async function checkForEmailProtection(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      // Check for CloudFlare email protection
      const hasCFScript = !!document.querySelector("script[data-cf-email]");
      const hasCFEmails = !!document.querySelector("[data-cfemail]");

      // Check for other email protection mechanisms
      const hasDataEmail = !!document.querySelector("[data-email]");
      const hasProtectedClass = !!document.querySelector(".protected-email");

      return hasCFScript || hasCFEmails || hasDataEmail || hasProtectedClass;
    });
  } catch (error) {
    console.error("Error checking for email protection:", error);
    return false;
  }
}

/**
 * Extract emails that are protected or encoded
 */
async function extractProtectedEmails(
  page: Page,
  sourceUrl: string
): Promise<ScrapedContact[]> {
  try {
    // Handle CloudFlare protected emails
    const cloudflareEmails = await page.evaluate(() => {
      const emailPairs: EmailNamePair[] = [];

      // CloudFlare email decoding function
      const decodeCloudflareEmail = (encoded: string): string => {
        let email = "";
        const r = parseInt(encoded.substring(0, 2), 16);
        let n;
        let i;

        for (n = 2; encoded.length - n; n += 2) {
          i = parseInt(encoded.substring(n, n + 2), 16) ^ r;
          email += String.fromCharCode(i);
        }
        return email;
      };

      // Find CloudFlare encoded emails
      document.querySelectorAll("[data-cfemail]").forEach((el) => {
        const encoded = el.getAttribute("data-cfemail");
        if (!encoded) return;

        const email = decodeCloudflareEmail(encoded);
        const nameElement = el
          .closest("div, li, article")
          ?.querySelector("h1, h2, h3, h4, strong, b");
        const name = nameElement?.textContent?.trim();

        emailPairs.push({ email, name });
      });

      // Find other encoded emails
      document.querySelectorAll("[data-email]").forEach((el) => {
        const email = el.getAttribute("data-email");
        if (!email) return;

        const nameElement = el
          .closest("div, li, article")
          ?.querySelector("h1, h2, h3, h4, strong, b");
        const name = nameElement?.textContent?.trim();

        emailPairs.push({ email, name });
      });

      return emailPairs;
    });

    // Convert to ScrapedContact format
    const contacts: ScrapedContact[] = cloudflareEmails.map(
      (item: EmailNamePair) => ({
        email: item.email,
        name: item.name,
        source: sourceUrl,
      })
    );

    return contacts;
  } catch (error) {
    console.error("Error extracting protected emails:", error);
    return [];
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
    const existing = uniqueEmails.get(normalizedEmail);
    if (!existing) {
      uniqueEmails.set(normalizedEmail, contact);
    } else if (
      (!existing.name && contact.name) ||
      (!existing.title && contact.title)
    ) {
      // Keep the contact with more information
      uniqueEmails.set(normalizedEmail, {
        ...existing,
        name: contact.name || existing.name,
        title: contact.title || existing.title,
      });
    }
  });

  return Array.from(uniqueEmails.values());
}

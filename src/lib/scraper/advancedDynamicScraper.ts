/**
 * Enhanced Dynamic Scraper - Specialized for coach websites with dynamic content
 * Focuses on extracting real emails only, no guessing
 */

import { Page } from "playwright";
import { ScrapedContact } from "./types";
import { extractEmails, extractObfuscatedEmails } from "./emailExtractor";
import { getNameFromText, getTitleFromText } from "./utils";

/**
 * Main entry point for enhanced coach directory processing
 */
export async function enhancedProcessCoachDirectory(
  page: Page,
  url: string
): Promise<ScrapedContact[]> {
  console.log(`Enhanced processing for ${url} with improved email extraction`);
  const contacts: ScrapedContact[] = [];

  try {
    // Make sure the page is loaded (with reduced timeout)
    await page
      .waitForLoadState("networkidle", { timeout: 8000 })
      .catch(() => {});

    // Fast extraction approach - get emails directly from DOM
    const quickEmails = await page.evaluate(() => {
      // This runs in the browser context
      const email_regex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
      const html = document.documentElement.innerHTML;
      return html.match(email_regex) || [];
    });

    // Determine full content extraction strategy
    let content = "";
    let emails: string[] = [];

    if (quickEmails.length > 0) {
      console.log(`Found ${quickEmails.length} emails with fast extraction`);
      // We already have emails, use lighter extraction for context

      // Get minimal page content for context
      content = await page.evaluate(() => {
        // Only get text from visible elements for performance
        const nodes = document.querySelectorAll(
          "p, h1, h2, h3, h4, h5, span, a, div"
        );
        let text = "";
        nodes.forEach((node) => {
          if (
            node.textContent &&
            window.getComputedStyle(node).display !== "none"
          ) {
            text += node.textContent + " ";
          }
        });
        return text;
      });

      // Combine fast found emails with any others in text content
      const contentEmails = extractEmails(content);
      emails = [...new Set([...quickEmails, ...contentEmails])];
    } else {
      // No emails found with fast approach, use full extraction
      console.log(
        "No emails found with fast extraction, using full page analysis"
      );
      content = await page.content();
      emails = extractEmails(content);
    }

    console.log(`Total emails found: ${emails.length}`);

    // Also look for obfuscated emails
    const obfuscatedEmails = extractObfuscatedEmails(content);
    if (obfuscatedEmails.length > 0) {
      console.log(`Found ${obfuscatedEmails.length} obfuscated emails`);
      // Add unique obfuscated emails to our email list
      for (const email of obfuscatedEmails) {
        if (!emails.includes(email)) {
          emails.push(email);
        }
      }
    }

    // Process all found emails
    for (const email of emails) {
      // Skip if already added
      if (contacts.some((c) => c.email === email)) continue;

      // Find name and title context around the email
      const emailContext = getContextAroundEmail(content, email);
      const name = getNameFromText(emailContext) || "";
      const title = getTitleFromText(emailContext) || "";

      contacts.push({
        email,
        name,
        title,
        source: url,
        confidence: "Confirmed",
      });
    }

    // Find all email links for any we might have missed
    const emailLinks = await page.$$('a[href^="mailto:"]');

    for (const link of emailLinks) {
      try {
        const hrefValue = await link.getAttribute("href");
        if (hrefValue) {
          const email = hrefValue.replace("mailto:", "").split("?")[0].trim();

          // Skip if already added
          if (contacts.some((c) => c.email === email)) continue;

          // Try to get name from link text or parent text
          let name = "";
          const linkText = await link.textContent();
          if (linkText && !linkText.includes("@")) {
            name = linkText.trim();
          }

          contacts.push({
            email,
            name,
            source: url,
            confidence: "Confirmed",
          });
        }
      } catch (err) {
        console.error("Error processing email link:", err);
      }
    }

    // Return unique contacts
    return removeDuplicateContacts(contacts);
  } catch (error) {
    console.error("Error in enhancedProcessCoachDirectory:", error);
    return contacts;
  }
}

/**
 * Helper function to get text context around an email
 */
function getContextAroundEmail(content: string, email: string): string {
  const emailIndex = content.indexOf(email);
  if (emailIndex === -1) return "";

  // Get 200 characters before and after the email
  const startIndex = Math.max(0, emailIndex - 200);
  const endIndex = Math.min(content.length, emailIndex + email.length + 200);

  return content.substring(startIndex, endIndex);
}

/**
 * Helper function to remove duplicate contacts
 */
function removeDuplicateContacts(contacts: ScrapedContact[]): ScrapedContact[] {
  const uniqueEmails = new Map<string, ScrapedContact>();

  contacts.forEach((contact) => {
    if (contact.email) {
      const normalizedEmail = contact.email.toLowerCase().trim();
      if (!uniqueEmails.has(normalizedEmail)) {
        uniqueEmails.set(normalizedEmail, contact);
      } else if (contact.name && !uniqueEmails.get(normalizedEmail)?.name) {
        // If we have a name in this contact but not in the existing one, update it
        const existingContact = uniqueEmails.get(normalizedEmail)!;
        uniqueEmails.set(normalizedEmail, {
          ...existingContact,
          name: contact.name,
        });
      }
    }
  });

  return Array.from(uniqueEmails.values());
}

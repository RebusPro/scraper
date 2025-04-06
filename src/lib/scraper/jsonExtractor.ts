/**
 * Utility for extracting data from complex JSON structures
 * This helps handle various API response formats from different websites
 */

import { extractEmails } from "./emailExtractor";

interface ExtractedData {
  emails: string[];
  phoneNumbers: string[];
  names: string[];
  urls: string[];
  contextText: string;
}

/**
 * Recursively extracts data from JSON objects and arrays
 * Works with any JSON structure, regardless of nesting level or field names
 */
export function extractDataFromJson(
  data: unknown,
  depth: number = 0,
  maxDepth: number = 5
): ExtractedData {
  if (depth > maxDepth) {
    return {
      emails: [],
      phoneNumbers: [],
      names: [],
      urls: [],
      contextText: "",
    };
  }

  // Initialize result
  const result: ExtractedData = {
    emails: [],
    phoneNumbers: [],
    names: [],
    urls: [],
    contextText: "",
  };

  // Handle null or undefined
  if (data === null || data === undefined) {
    return result;
  }

  // Handle primitive values (string, number, boolean)
  if (typeof data !== "object") {
    // Check if the primitive value is an email
    if (typeof data === "string") {
      const possibleEmails = extractEmails(data);
      if (possibleEmails.length > 0) {
        result.emails.push(...possibleEmails);
      }

      // Check if it's a URL
      if (isUrl(data)) {
        result.urls.push(data);
      }

      // Check if it looks like a phone number
      if (isPhoneNumber(data)) {
        result.phoneNumbers.push(data);
      }
    }
    return result;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    for (const item of data) {
      const extracted = extractDataFromJson(item, depth + 1, maxDepth);
      result.emails.push(...extracted.emails);
      result.phoneNumbers.push(...extracted.phoneNumbers);
      result.names.push(...extracted.names);
      result.urls.push(...extracted.urls);
      result.contextText += extracted.contextText;
    }
    return result;
  }

  // Handle objects (non-array)
  for (const [key, value] of Object.entries(data)) {
    // Check if the key suggests this might be an email field
    const keyLower = key.toLowerCase();

    // Direct email field
    if (keyLower.includes("email") && typeof value === "string" && value) {
      result.emails.push(value);
      result.contextText += `Email: ${value}\n`;
    }

    // Name field
    else if (
      (keyLower.includes("name") ||
        keyLower.includes("title") ||
        keyLower.includes("organization") ||
        keyLower.includes("company")) &&
      typeof value === "string" &&
      value
    ) {
      result.names.push(value);
      result.contextText += `Name/Organization: ${value}\n`;
    }

    // Phone field
    else if (
      (keyLower.includes("phone") ||
        keyLower.includes("tel") ||
        keyLower.includes("mobile") ||
        keyLower.includes("contact")) &&
      typeof value === "string" &&
      value
    ) {
      result.phoneNumbers.push(value);
      result.contextText += `Phone: ${value}\n`;
    }

    // URL/Website field
    else if (
      (keyLower.includes("website") ||
        keyLower.includes("url") ||
        keyLower.includes("site") ||
        keyLower.includes("web") ||
        keyLower.includes("link")) &&
      typeof value === "string" &&
      value
    ) {
      result.urls.push(value);
      result.contextText += `Website: ${value}\n`;
    }

    // Address related fields
    else if (
      (keyLower.includes("address") ||
        keyLower.includes("street") ||
        keyLower.includes("city") ||
        keyLower.includes("state") ||
        keyLower.includes("zip") ||
        keyLower.includes("postal")) &&
      typeof value === "string" &&
      value
    ) {
      result.contextText += `Address (${key}): ${value}\n`;
    }

    // Recursively process nested objects and arrays
    const extracted = extractDataFromJson(value, depth + 1, maxDepth);
    result.emails.push(...extracted.emails);
    result.phoneNumbers.push(...extracted.phoneNumbers);
    result.names.push(...extracted.names);
    result.urls.push(...extracted.urls);
    result.contextText += extracted.contextText;
  }

  // Extra newline for readability between objects
  if (Object.keys(data).length > 0) {
    result.contextText += "\n";
  }

  // Remove duplicate values
  result.emails = [...new Set(result.emails)];
  result.phoneNumbers = [...new Set(result.phoneNumbers)];
  result.names = [...new Set(result.names)];
  result.urls = [...new Set(result.urls)];

  return result;
}

/**
 * Check if a string looks like a URL
 */
function isUrl(str: string): boolean {
  try {
    // Simple regex to check if string looks like a URL
    return /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/.test(
      str
    );
  } catch {
    return false;
  }
}

/**
 * Check if a string looks like a phone number
 */
function isPhoneNumber(str: string): boolean {
  // Remove all non-digit characters
  const digitsOnly = str.replace(/\D/g, "");

  // Check if we have a plausible number of digits (7-15)
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

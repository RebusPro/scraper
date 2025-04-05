/**
 * Types for the scraper module
 */

export interface ScrapedContact {
  email: string;
  name?: string;
  title?: string;
  phone?: string;
  url?: string;
  source?: string;
  scrapeTime?: string; // Added for export functionality
  alternateEmails?: string[]; // Added for storing alternative email formats
  confidence?: "Confirmed" | "Generated" | "Generated - Verification Required"; // Confidence level in the email address
  method?: string; // Method used to find this email (e.g., "Contact Page", "Main Page", "Contact Page Mailto Link")
}

export interface ScrapingResult {
  url: string;
  contacts: ScrapedContact[];
  timestamp: string;
  status: "success" | "partial" | "error";
  message?: string;
  stats?: {
    totalEmails: number;
    totalWithNames: number;
    pagesScraped: number;
  };
}

export interface FormField {
  selector: string;
  value: string;
  type: "text" | "select" | "checkbox" | "radio";
}

export interface FormInteraction {
  enabled: boolean;
  fields?: FormField[];
  submitButtonSelector?: string;
  waitForSelector?: string;
  waitTime?: number;
}

// Program information from APIs like Learn to Skate USA
export interface Program {
  // Standard fields
  ProgramId?: string;
  OrganizationName?: string;
  OrganizationType?: string;
  OrganizationEmail?: string;
  OrganizationPhoneNumber?: string;
  Website?: string;
  StreetOne?: string;
  City?: string;
  StateCode?: string;
  PostalCode?: string;

  // Alternative field names that might be used
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;

  // For nested data structures
  data?: unknown;
  results?: unknown;

  // Generic index signature for other potential fields
  [key: string]: string | number | boolean | null | undefined | unknown;
}

// Generic data item for handling various API response formats
export interface GenericDataItem {
  [key: string]: string | number | boolean | null | undefined | unknown;
}

export interface ScrapingOptions {
  followLinks?: boolean;
  maxDepth?: number;
  timeout?: number;
  useHeadless?: boolean;
  includePhoneNumbers?: boolean;
  formInteraction?: FormInteraction;
  browserType?: "chromium" | "firefox" | "webkit"; // For Playwright browser selection
  usePlaywright?: boolean; // Whether to use Playwright instead of Puppeteer for dynamic scraping
  mode?: "standard" | "aggressive" | "gentle"; // The scraping mode intensity
}

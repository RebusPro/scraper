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

export interface ScrapingOptions {
  followLinks?: boolean;
  maxDepth?: number;
  timeout?: number;
  useHeadless?: boolean;
  includePhoneNumbers?: boolean;
}

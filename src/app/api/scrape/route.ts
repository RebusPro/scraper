/**
 * API route for scraping websites
 */
import { NextRequest, NextResponse } from "next/server";
import { WebScraper } from "@/lib/scraper/scraper";
import { ScrapingOptions, ScrapingResult } from "@/lib/scraper/types";

export async function POST(request: NextRequest) {
  try {
    // Get URL and options from request body
    const { url, options = {} } = await request.json();

    // Validate URL
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Ensure URL has a protocol
    let normalizedUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      normalizedUrl = `https://${url}`;
    }

    // Default options with smart settings for non-technical users
    const defaultOptions: ScrapingOptions = {
      followLinks: true,
      maxDepth: 2,
      useHeadless: true,
      usePlaywright: true,
      includePhoneNumbers: true,
      timeout: 60000,
    };

    // Create scraper with merged options (user options override defaults)
    const scraper = new WebScraper({
      ...defaultOptions,
      ...options,
    });

    // Perform scraping
    const result: ScrapingResult = await scraper.scrapeWebsite(normalizedUrl);

    // Return results
    return NextResponse.json(result);
  } catch (error) {
    console.error("Scraping API error:", error);
    return NextResponse.json(
      {
        error: "Scraping failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

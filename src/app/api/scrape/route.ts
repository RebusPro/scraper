import { NextRequest, NextResponse } from "next/server";
import { PlaywrightScraper } from "@/lib/scraper/playwrightScraper";
import { ScrapedContact, ScrapingResult } from "@/lib/scraper/types";

// Track active scraping sessions to enable cancellation
const activeScrapingSessions: Map<
  string,
  {
    scraper: PlaywrightScraper;
    cancelled: boolean;
  }
> = new Map();

// Generate a unique session ID
function generateSessionId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

// Handler for cancellation requests
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId || !activeScrapingSessions.has(sessionId)) {
    return NextResponse.json(
      { error: "Invalid or expired session ID" },
      { status: 400 }
    );
  }

  const session = activeScrapingSessions.get(sessionId);
  if (session) {
    session.cancelled = true;
    try {
      // Close the browser
      await session.scraper.close();
      // Remove from active sessions
      activeScrapingSessions.delete(sessionId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error cancelling scrape:", error);
      return NextResponse.json(
        { error: "Failed to cancel scraping" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Session not found" }, { status: 404 });
}

// Main scraping handler
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();

    // Handle different input formats - both url and urls properties, and handle single URL strings
    let urlsToScrape: string[] = [];

    if (body.urls) {
      // Handle urls property
      urlsToScrape = Array.isArray(body.urls) ? body.urls : [body.urls];
    } else if (body.url) {
      // Handle url property (singular)
      urlsToScrape = [body.url];
    }

    // Validate we have URLs to process
    if (urlsToScrape.length === 0) {
      return NextResponse.json({ error: "No URLs provided" }, { status: 400 });
    }

    // Create a new session
    const sessionId = generateSessionId();
    const scraper = new PlaywrightScraper();

    // Register the session
    activeScrapingSessions.set(sessionId, {
      scraper,
      cancelled: false,
    });

    // Process URLs
    const results: ScrapingResult[] = [];
    const errors: { url: string; error: string }[] = [];

    // Process each URL
    for (const url of urlsToScrape) {
      try {
        console.log(`Using Playwright for ${url}`);

        // Run the scraper with enhanced options
        const contacts: ScrapedContact[] = await scraper.scrapeWebsite(url, {
          maxDepth: 3, // Search deeper in the site structure
          followLinks: true, // Follow links to find more emails
          includePhoneNumbers: true,
          useHeadless: true,
          timeout: 60000,
          browserType: "chromium",
        });

        // Add to results
        results.push({
          url,
          contacts: contacts || [],
          timestamp: new Date().toISOString(),
          status: "success",
        });
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        errors.push({
          url,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        // Add an error result
        results.push({
          url,
          contacts: [],
          timestamp: new Date().toISOString(),
          status: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Clean up
    try {
      await scraper.close();
    } catch (error) {
      console.error("Error closing browser:", error);
    }

    // Remove from active sessions
    activeScrapingSessions.delete(sessionId);

    // Return the results
    return NextResponse.json(
      {
        done: true,
        processed: urlsToScrape.length,
        total: urlsToScrape.length,
        results,
        errors,
      },
      {
        headers: {
          "X-Scraping-Session-Id": sessionId,
        },
      }
    );
  } catch (error) {
    console.error("Error processing scrape request:", error);
    return NextResponse.json(
      { error: "Failed to process scraping request" },
      { status: 500 }
    );
  }
}

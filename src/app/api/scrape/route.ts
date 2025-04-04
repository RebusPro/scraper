import { NextRequest, NextResponse } from "next/server";
import { PlaywrightScraper } from "@/lib/scraper/playwrightScraper";
import { ScrapedContact, ScrapingResult } from "@/lib/scraper/types";

// Define a settings input type
type ScraperSettingsInput = {
  mode?: "standard" | "aggressive" | "gentle";
  maxDepth?: number;
  followLinks?: boolean;
  includePhoneNumbers?: boolean;
  browserType?: "chromium" | "firefox";
  timeout?: number;
};

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

    // Handle URL extraction
    if (body.urls) {
      // Handle urls property
      urlsToScrape = Array.isArray(body.urls) ? body.urls : [body.urls];
    } else if (body.url) {
      // Handle url property (singular)
      urlsToScrape = [body.url];
    }

    // Extract settings if provided
    const settings = body.settings || {};

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

    // Create a streaming response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start processing in the background
    processScraping(urlsToScrape, sessionId, writer, settings).catch(
      (error) => {
        console.error("Scraping process error:", error);
      }
    );

    // Return the streaming response with the session ID
    return new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "application/json",
        "X-Scraping-Session-Id": sessionId,
      },
    });
  } catch (error) {
    console.error("Error starting scrape:", error);
    return NextResponse.json(
      { error: "Failed to start scraping" },
      { status: 500 }
    );
  }
}

// Process URLs in the background and stream results
async function processScraping(
  urls: string[],
  sessionId: string,
  writer: WritableStreamDefaultWriter,
  settings: ScraperSettingsInput = {}
) {
  const results: ScrapingResult[] = [];
  const errors: { url: string; error: string }[] = [];
  const processedUrls: string[] = [];

  // Get the session
  const session = activeScrapingSessions.get(sessionId);
  if (!session) {
    await writer.write(
      JSON.stringify({
        done: true,
        error: "Session not found",
      })
    );
    await writer.close();
    return;
  }

  const { scraper } = session;

  // Send initial update
  await writer.write(
    JSON.stringify({
      done: false,
      processed: 0,
      total: urls.length,
      results: [],
      errors: [],
      remainingUrls: [...urls],
    })
  );

  // Process each URL
  for (let i = 0; i < urls.length; i++) {
    // Check if scraping was cancelled
    if (activeScrapingSessions.get(sessionId)?.cancelled) {
      console.log(`Scraping cancelled for session ${sessionId}`);
      break;
    }

    const url = urls[i];
    const remainingUrls = urls.slice(i);

    try {
      console.log(`Using Playwright for ${url}`);

      // Apply user-provided settings with fallbacks for each value
      let maxDepth = 2;
      let followLinks = true;
      let timeout = 30000;
      let browserType: "chromium" | "firefox" = "chromium";
      let includePhoneNumbers = true;

      // Apply settings based on mode if specified
      if (settings.mode === "aggressive") {
        console.log("Using aggressive mode settings");
        maxDepth = 3;
        timeout = 45000;
      } else if (settings.mode === "gentle") {
        console.log("Using gentle mode settings");
        maxDepth = 1;
        followLinks = false;
        timeout = 20000;
      } else {
        console.log("Using standard mode settings");
      }

      // Override with specific settings if provided
      if (settings.maxDepth !== undefined) maxDepth = settings.maxDepth;
      if (settings.followLinks !== undefined)
        followLinks = settings.followLinks;
      if (settings.timeout !== undefined) timeout = settings.timeout;
      if (settings.browserType) browserType = settings.browserType;
      if (settings.includePhoneNumbers !== undefined)
        includePhoneNumbers = settings.includePhoneNumbers;

      console.log(
        `Using settings: mode=${
          settings.mode || "standard"
        }, maxDepth=${maxDepth}, followLinks=${followLinks}, timeout=${timeout}ms, browser=${browserType}`
      );

      const contacts: ScrapedContact[] = await scraper.scrapeWebsite(url, {
        maxDepth,
        followLinks,
        includePhoneNumbers,
        useHeadless: true,
        timeout,
        browserType,
      });

      // Add to results
      const result: ScrapingResult = {
        url,
        contacts: contacts || [],
        timestamp: new Date().toISOString(),
        status: "success",
      };

      results.push(result);
      processedUrls.push(url);
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

      processedUrls.push(url);
    }

    // Update progress
    await writer.write(
      JSON.stringify({
        done: false,
        processed: processedUrls.length,
        total: urls.length,
        results,
        errors,
        remainingUrls,
      })
    );
  }

  // Clean up after completion or cancellation
  try {
    // Close the browser
    await scraper.close();
  } catch (error) {
    console.error("Error closing browser:", error);
  }

  // Remove from active sessions
  activeScrapingSessions.delete(sessionId);

  // Send final update with a meaningful message if no results were found
  const finalResults = results.filter(
    (r) => r.contacts && r.contacts.length > 0
  );
  const noResultsUrls = results
    .filter((r) => !r.contacts || r.contacts.length === 0)
    .map((r) => r.url);

  await writer.write(
    JSON.stringify({
      done: true,
      processed: processedUrls.length,
      total: urls.length,
      results: finalResults,
      errors: [
        ...errors,
        ...noResultsUrls.map((url) => ({
          url,
          error: "No contact information found on this website",
        })),
      ],
      remainingUrls: [],
    })
  );

  await writer.close();
}

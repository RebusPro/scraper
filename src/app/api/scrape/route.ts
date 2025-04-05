import { NextRequest, NextResponse } from "next/server";
import { PlaywrightScraper } from "@/lib/scraper/playwrightScraper";
import { ImprovedPlaywrightScraper } from "@/lib/scraper/improvedPlaywrightScraper";
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
    scraper: PlaywrightScraper | ImprovedPlaywrightScraper;
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
    console.log(`Marked session ${sessionId} as cancelled`);

    try {
      // Close the browser but DON'T remove the session
      // This allows the processing loop to detect the cancellation
      await session.scraper.close();

      // Note: We intentionally keep the session in the map with cancelled=true
      // so that ongoing processing can detect it and abort gracefully
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

    // Filter out empty URLs and trim whitespace
    urlsToScrape = urlsToScrape
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    // Add protocol if missing
    urlsToScrape = urlsToScrape.map((url) => {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return `https://${url}`;
      }
      return url;
    });

    // Extract settings if provided
    const settings = body.settings || {};

    // Validate we have URLs to process
    if (urlsToScrape.length === 0) {
      return NextResponse.json({ error: "No URLs provided" }, { status: 400 });
    }

    // Create a new session
    const sessionId = generateSessionId();
    // Always use the improved scraper with our enhancements
    const scraper = new ImprovedPlaywrightScraper();

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
  const encoder = new TextEncoder();

  // Get the session
  const session = activeScrapingSessions.get(sessionId);
  if (!session) {
    await writer.write(
      encoder.encode(
        JSON.stringify({
          done: true,
          error: "Session not found",
        })
      )
    );
    await writer.close();
    return;
  }

  const { scraper } = session;

  // Send initial update
  await writer.write(
    encoder.encode(
      JSON.stringify({
        done: false,
        processed: 0,
        total: urls.length,
        results: [],
        errors: [],
        remainingUrls: [...urls],
      })
    )
  );

  // Process each URL
  for (let i = 0; i < urls.length; i++) {
    // Check if scraping was cancelled - immediately terminate and notify client
    if (activeScrapingSessions.get(sessionId)?.cancelled) {
      console.log(`Scraping cancelled for session ${sessionId}`);

      // Send final cancellation update to client before closing
      await writer.write(
        encoder.encode(
          JSON.stringify({
            done: true,
            cancelled: true,
            processed: processedUrls.length,
            total: urls.length,
            results: results, // Send the results we've gathered so far
            errors: [...errors],
            remainingUrls: urls.slice(i),
          })
        )
      );

      await writer.close();
      return; // Exit the function immediately
    }

    const url = urls[i];
    const remainingUrls = urls.slice(i);

    try {
      console.log(`Processing URL: ${url}`);

      // Configure mode-based settings with fast circuit breakers
      const modeSettings = applyModeSettings(url, settings);

      // Enhanced logging for debugging
      console.log(
        `Using settings: mode=${modeSettings.mode}, maxDepth=${modeSettings.maxDepth}, followLinks=${modeSettings.followLinks}, timeout=${modeSettings.timeout}ms, browser=${modeSettings.browserType}, headless=${modeSettings.useHeadless}`
      );

      // Determine scraping strategy based on URL and mode
      let contacts: ScrapedContact[] = [];
      const pagesScraped = 1;

      // Use the scraper's scrapeWebsite method which handles everything
      contacts = await scraper.scrapeWebsite(url, modeSettings);

      // Add to results
      const result: ScrapingResult = {
        url,
        contacts: contacts || [],
        timestamp: new Date().toISOString(),
        status: "success",
        stats: {
          totalEmails: contacts.length,
          totalWithNames: contacts.filter((c) => !!c.name).length,
          pagesScraped,
        },
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

    // Update progress - add detailed logging for debugging
    const progressUpdate = {
      done: false,
      processed: processedUrls.length,
      total: urls.length,
      results,
      errors,
      remainingUrls,
    };

    // Log email counts to help debug UI issues
    const emailCount = results.reduce(
      (sum, r) => sum + (r.contacts ? r.contacts.length : 0),
      0
    );
    console.log(
      `Progress update: ${processedUrls.length}/${urls.length} processed. Found ${emailCount} emails so far.`
    );

    await writer.write(encoder.encode(JSON.stringify(progressUpdate)));
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

  // Send final update with all results, making sure no emails are lost
  // Important: Include ALL results, even if they have just one contact
  const finalResults = results.filter(
    (r) => r.contacts && r.contacts.length > 0
  );

  // Debug log to ensure results are being sent correctly
  console.log(
    `Sending ${
      finalResults.length
    } results with emails to client. Total contact count: ${finalResults.reduce(
      (sum, r) => sum + r.contacts.length,
      0
    )}`
  );
  const noResultsUrls = results
    .filter((r) => !r.contacts || r.contacts.length === 0)
    .map((r) => r.url);

  await writer.write(
    encoder.encode(
      JSON.stringify({
        done: true,
        processed: processedUrls.length,
        total: urls.length,
        results: results, // Send ALL results, not just filtered ones
        errors: [
          ...errors,
          ...noResultsUrls.map((url) => ({
            url,
            error: "No contact information found on this website",
          })),
        ],
        remainingUrls: [],
      })
    )
  );

  await writer.close();
}

// Configure scraper settings based on mode and URL
function applyModeSettings(url: string, settings: ScraperSettingsInput) {
  // Default settings
  let maxDepth = 2;
  let followLinks = true;
  let timeout = 15000; // Reduced timeout for faster results
  let browserType: "chromium" | "firefox" = "chromium";
  let includePhoneNumbers = true;
  let useHeadless = true;
  const mode = settings.mode || "standard";

  // Apply settings based on mode
  if (mode === "aggressive") {
    maxDepth = 3;
    followLinks = true;
    timeout = 30000; // Reduced from 60000, but still allows for complex sites
    browserType = "chromium";
    includePhoneNumbers = true;

    // Check for sites that might need headed browser
    const dynamicSitePatterns = [
      "travelsports.com",
      "hockey",
      "dynamic",
      "sports",
      "coaches",
      "directory",
    ];

    const needsHeadlessFalse = dynamicSitePatterns.some((pattern) =>
      url.toLowerCase().includes(pattern)
    );

    if (needsHeadlessFalse) {
      console.log("Using headed browser for potentially dynamic content site");
      useHeadless = false;
    }
  } else if (mode === "gentle") {
    // Super fast extraction for light mode
    maxDepth = 0; // Do not follow any links
    followLinks = false;
    timeout = 5000; // Extremely reduced timeout
    browserType = "chromium"; // Chromium tends to be faster
    includePhoneNumbers = false; // Skip phone extraction to save time
    useHeadless = true;
  } else {
    // Standard mode
    maxDepth = 2;
    followLinks = true;
    timeout = 15000; // Reduced for faster processing
    browserType = "chromium";
    includePhoneNumbers = true;
    useHeadless = true;
  }

  // Override with specific settings if provided
  if (settings.maxDepth !== undefined) maxDepth = settings.maxDepth;
  if (settings.followLinks !== undefined) followLinks = settings.followLinks;
  if (settings.timeout !== undefined) timeout = settings.timeout;
  if (settings.browserType) browserType = settings.browserType;
  if (settings.includePhoneNumbers !== undefined)
    includePhoneNumbers = settings.includePhoneNumbers;

  return {
    mode,
    maxDepth,
    followLinks,
    includePhoneNumbers,
    useHeadless,
    timeout,
    browserType,
  };
}

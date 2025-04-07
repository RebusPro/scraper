import { NextResponse } from "next/server";
// Go back to using Receiver
import { Receiver } from "@upstash/qstash";
import { ImprovedPlaywrightScraper } from "@/lib/scraper/improvedPlaywrightScraper";
import { ScrapedContact } from "@/lib/scraper/types";
import { createClient } from "@supabase/supabase-js";

// Set the maximum duration for this worker function
export const maxDuration = 180;

// Define the expected job payload structure (must match submit-batch)
interface JobPayload {
  batchId: string;
  url: string;
  settings: {
    mode?: "standard" | "aggressive" | "gentle";
    maxDepth?: number;
    followLinks?: boolean;
    includePhoneNumbers?: boolean;
    browserType?: "chromium" | "firefox";
    timeout?: number;
  };
}

// Re-initialize QStash Receiver for manual verification
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// Initialize Supabase client (use service role key for backend operations)
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error(
    "Supabase environment variables (URL or Service Role Key) are not set."
  );
  // Avoid throwing here during initialization, handle potential client errors during request
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Define the actual scraping logic as a separate async function
async function runScrapingJob(jobPayload: JobPayload) {
  const { batchId, url, settings } = jobPayload;
  let scrapeResult: ScrapedContact[] | null = null;
  let errorMessage: string | null = null;
  let status: "success" | "error" = "success";
  let scraper: ImprovedPlaywrightScraper | null = null;

  try {
    console.log(
      `BACKGROUND: Processing job for URL: ${url}, Batch ID: ${batchId}`
    );
    scraper = new ImprovedPlaywrightScraper();

    // --- Actual Scraping Logic ---
    try {
      console.log(
        `BACKGROUND: Starting scrape for ${url} with settings: ${JSON.stringify(
          settings
        )}`
      );
      scrapeResult = await scraper.scrapeWebsite(url, settings);
      console.log(
        `BACKGROUND: Scraping finished for ${url}. Found ${
          scrapeResult?.length ?? 0
        } contacts.`
      );
    } catch (scrapeError: unknown) {
      console.error(
        `BACKGROUND: Error scraping ${url} for batch ${batchId}:`,
        scrapeError
      );
      errorMessage =
        scrapeError instanceof Error
          ? scrapeError.message
          : "Unknown scraping error";
      status = "error";
      scrapeResult = null;
    }
    // --- End Scraping Logic ---

    // --- Database Logic ---
    try {
      console.log(
        `BACKGROUND: Attempting to save result for ${url} (Batch ID: ${batchId}) to database...`
      );
      const { data, error: dbError } = await supabase
        .from("scraping_results")
        .insert([
          {
            batch_id: batchId,
            url,
            status,
            contacts: scrapeResult ? JSON.stringify(scrapeResult) : null,
            error_message: errorMessage,
          },
        ])
        .select();

      if (dbError) {
        throw dbError;
      }
      console.log(
        `BACKGROUND: Successfully saved result for ${url} (Batch ID: ${batchId})`,
        data
      );
    } catch (dbError: unknown) {
      console.error(
        `BACKGROUND: DATABASE ERROR saving result for ${url} (Batch ID: ${batchId}):`,
        dbError
      );
      // Log DB error - the job is already considered successful by QStash
    }
    // --- End Database Logic ---
  } catch (jobProcessingError: unknown) {
    console.error(
      "BACKGROUND: Unhandled error during job processing:",
      jobProcessingError
    );
    // Log unhandled errors - QStash won't retry based on this
  } finally {
    // Ensure the browser instance is closed
    if (scraper) {
      console.log(`BACKGROUND: Closing browser instance for ${url}`);
      await scraper.close().catch((closeErr: Error) => {
        console.error(
          `BACKGROUND: Error closing scraper for ${url}:`,
          closeErr
        );
      });
    }
    console.log(
      `BACKGROUND: Job processing finished for ${url}, Batch ID: ${batchId}`
    );
  }
}

// The main exported handler
export async function POST(request: Request) {
  // Verify signature first
  const bodyText = await request.text();
  try {
    await receiver.verify({
      signature: request.headers.get("upstash-signature")!,
      body: bodyText,
    });
  } catch (error) {
    console.error("Signature verification failed:", error);
    return new Response("Invalid signature", { status: 401 });
  }

  // Try parsing the body *before* acknowledging, to catch bad requests early
  let jobPayload: JobPayload;
  try {
    jobPayload = JSON.parse(bodyText);
  } catch (parseError: unknown) {
    console.error(
      "Error parsing job payload before acknowledgment:",
      parseError
    );
    // Return a 400 Bad Request - QStash might retry this depending on settings
    return NextResponse.json(
      { success: false, error: "Failed to parse job payload" },
      { status: 400 }
    );
  }

  // Signature and basic parsing are valid. Acknowledge QStash immediately.
  console.log(
    `Acknowledging QStash for job: ${jobPayload.url}, Batch: ${jobPayload.batchId}`
  );

  // Start the actual job processing asynchronously *without* awaiting it.
  runScrapingJob(jobPayload).catch((err) => {
    console.error("Error running background scraping job (uncaught):", err);
    // This error handling is for the async function itself, separate from the response to QStash
  });

  // Return 202 Accepted immediately
  return NextResponse.json({ message: "Accepted" }, { status: 202 });
}

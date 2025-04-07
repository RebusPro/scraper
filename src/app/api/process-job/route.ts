import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { ImprovedPlaywrightScraper } from "@/lib/scraper/improvedPlaywrightScraper"; // Use the scraper
import { ScrapedContact } from "@/lib/scraper/types";
import { createClient } from "@supabase/supabase-js"; // Import Supabase client

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

// Initialize QStash Receiver for signature verification
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

// The main POST handler
async function handler(request: NextRequest) {
  // Verify signature
  const signature = request.headers.get("upstash-signature");
  if (!signature) {
    console.warn("Missing Upstash signature");
    return new Response("Signature required", { status: 401 });
  }

  const bodyText = await request.text(); // Read body text once

  const isValid = await receiver
    .verify({
      signature: signature,
      body: bodyText,
    })
    .catch((err) => {
      console.error("Signature verification error:", err);
      return false;
    });

  if (!isValid) {
    console.warn("Invalid QStash signature received");
    return new Response("Invalid signature", { status: 401 });
  }

  // Parse the validated body
  let jobPayload: JobPayload;
  try {
    jobPayload = JSON.parse(bodyText);
  } catch (parseError: unknown) {
    console.error("Error parsing job payload after verification:", parseError);
    return NextResponse.json(
      { error: "Failed to parse job payload" },
      { status: 400 }
    );
  }

  // --- Main job processing logic ---
  const { batchId, url, settings } = jobPayload;
  let scrapeResult: ScrapedContact[] | null = null;
  let errorMessage: string | null = null;
  let status: "success" | "error" = "success"; // Default to success
  let scraper: ImprovedPlaywrightScraper | null = null; // Declare scraper instance variable

  try {
    console.log(`Processing job for URL: ${url}, Batch ID: ${batchId}`);

    // Instantiate the scraper
    // TODO: Optimize - investigate reusing browser instances if possible
    scraper = new ImprovedPlaywrightScraper();

    // --- Actual Scraping Logic ---
    try {
      console.log(
        `Starting scrape for ${url} with settings: ${JSON.stringify(settings)}`
      );
      // Use the ImprovedPlaywrightScraper as it's generally more advanced
      // Ensure scrapeWebsite returns ScrapedContact[] as expected by its definition
      scrapeResult = await scraper.scrapeWebsite(url, settings);
      console.log(
        `Scraping finished for ${url}. Found ${
          scrapeResult?.length ?? 0
        } contacts.`
      );
    } catch (scrapeError: unknown) {
      console.error(`Error scraping ${url} for batch ${batchId}:`, scrapeError);
      errorMessage =
        scrapeError instanceof Error
          ? scrapeError.message
          : "Unknown scraping error";
      status = "error"; // Mark status as error if scraping fails
      scrapeResult = null; // Ensure result is null on error
    }
    // --- End Scraping Logic ---

    // --- Database Logic ---
    try {
      console.log(
        `Attempting to save result for ${url} (Batch ID: ${batchId}) to database...`
      );
      const { data, error: dbError } = await supabase
        .from("scraping_results") // Use your actual table name
        .insert([
          {
            batch_id: batchId,
            url: url,
            status: status,
            // Ensure contacts is null if scrapeResult is null, otherwise stringify
            contacts: scrapeResult ? JSON.stringify(scrapeResult) : null,
            error_message: errorMessage,
            // created_at should be handled by DB default
          },
        ])
        .select(); // Optionally select to confirm insert

      if (dbError) {
        throw dbError; // Throw error to be caught by outer catch block
      }
      console.log(
        `Successfully saved result for ${url} (Batch ID: ${batchId})`,
        data
      );
    } catch (dbError: unknown) {
      console.error(
        `DATABASE ERROR saving result for ${url} (Batch ID: ${batchId}):`,
        dbError
      );
      // If DB write fails, QStash might retry the job unless we return success
      // It's often better to return success to QStash here and rely on logging/monitoring
      // to catch DB errors, preventing potential infinite retries if the DB issue persists.
      // However, you *could* return status 500 here to force a retry if preferred.
      // For now, we log the error but still return success below.
      errorMessage = `Failed to save result to DB: ${
        dbError instanceof Error ? dbError.message : String(dbError)
      }`;
      // Optionally update status if DB write fails, though the scrape itself might have succeeded
      // status = 'error';
    }
    // --- End Database Logic ---

    // Respond to QStash that the job was handled.
    // QStash mainly cares that we received and attempted the job.
    // Internal errors (like DB write failure) are logged above.
    return NextResponse.json({
      success: true,
      processedUrl: url,
      dbErrorMessage: errorMessage,
    });
  } catch (jobProcessingError: unknown) {
    console.error("Unhandled error during job processing:", jobProcessingError);
    // Return an error status code so QStash knows the job failed definitively
    return NextResponse.json(
      { error: "Failed during job processing" },
      { status: 500 }
    );
  } finally {
    // Ensure the browser instance is closed even if errors occurred
    if (scraper) {
      console.log(`Closing browser instance for ${url}`);
      await scraper.close().catch((closeErr) => {
        console.error(`Error closing scraper for ${url}:`, closeErr);
      });
    }
  }
}

// Export the handler
export { handler as POST };

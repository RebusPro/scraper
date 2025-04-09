import { NextResponse } from "next/server";
// Go back to using Receiver
import { Receiver } from "@upstash/qstash";
import { ImprovedPlaywrightScraper } from "@/lib/scraper/improvedPlaywrightScraper";
import { ScrapedContact } from "@/lib/scraper/types";
import { createClient } from "@supabase/supabase-js";
import PQueue from "p-queue";

// Set the maximum duration for this worker function
export const maxDuration = 180;

// Configure concurrency based on VPS resources - adjust based on your VPS capabilities
// Usually 2-3 is a good number for a standard VPS
const CONCURRENT_JOBS = 2;

// Create a job queue with limited concurrency
const jobQueue = new PQueue({ concurrency: CONCURRENT_JOBS });

// Track active jobs for monitoring
const activeJobs = new Map<string, { url: string; startTime: number }>();

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
    "⚠️ Supabase environment variables (URL or Service Role Key) are not set."
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
  const jobId = `${batchId}-${url}`;
  let scrapeResult: ScrapedContact[] | null = null;
  let errorMessage: string | null = null;
  let status: "success" | "error" = "success";
  let scraper: ImprovedPlaywrightScraper | null = null;

  // Add to active jobs for monitoring
  activeJobs.set(jobId, { url, startTime: Date.now() });

  console.log(
    `🚀 Starting job for: ${url} (Mode: ${
      settings.mode || "standard"
    }) - Queue status: ${activeJobs.size}/${CONCURRENT_JOBS} active`
  );

  try {
    scraper = new ImprovedPlaywrightScraper();

    // --- Actual Scraping Logic ---
    try {
      // Add timeout protection around the scrape operation
      const timeoutPromise = new Promise<ScrapedContact[]>((_, reject) => {
        const maxTimeout = settings.timeout || 600000; // 10 minutes default or use settings value
        setTimeout(() => {
          reject(
            new Error(`⏱️ Scraping timeout after ${maxTimeout / 1000} seconds`)
          );
        }, maxTimeout);
      });

      console.log(`🔍 Scraping website: ${url} (${getHostname(url)})`);

      scrapeResult = await Promise.race([
        scraper.scrapeWebsite(url, settings),
        timeoutPromise,
      ]);

      console.log(
        `✅ Scraping completed for ${getHostname(url)}. Found ${
          scrapeResult?.length ?? 0
        } contacts.`
      );
    } catch (scrapeError: unknown) {
      console.error(
        `❌ Error scraping ${getHostname(url)}: ${
          scrapeError instanceof Error ? scrapeError.message : "Unknown error"
        }`
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
      console.log(`💾 Saving results for ${getHostname(url)} to database...`);
      const { error: dbError } = await supabase
        .from("scraping_results")
        .insert([
          {
            batch_id: batchId,
            url: url,
            status: status,
            contacts: scrapeResult ? JSON.stringify(scrapeResult) : null,
            error_message: errorMessage,
          },
        ])
        .select();

      if (dbError) {
        throw dbError; // Throw to be caught by the outer catch block
      }
    } catch (dbError: unknown) {
      console.error(
        `❌ Database error for ${getHostname(url)}: ${
          dbError instanceof Error ? dbError.message : "Unknown error"
        }`
      );
    }
    // --- End Database Logic ---
  } catch (jobProcessingError: unknown) {
    console.error(
      `❌ Unhandled job error for ${getHostname(url)}: ${
        jobProcessingError instanceof Error
          ? jobProcessingError.message
          : "Unknown error"
      }`
    );
  } finally {
    // Ensure the browser instance is closed
    if (scraper) {
      await scraper.close().catch((closeErr: Error) => {
        console.error(
          `⚠️ Browser close error for ${getHostname(url)}: ${closeErr.message}`
        );
      });
    }

    // Calculate job duration before removing from active jobs
    const startTime = activeJobs.get(jobId)?.startTime || Date.now();
    const duration = (Date.now() - startTime) / 1000;

    // Remove from active jobs map
    activeJobs.delete(jobId);

    console.log(
      `🏁 Job completed: ${getHostname(url)} (${duration.toFixed(
        2
      )}s) - Queue status: ${activeJobs.size}/${CONCURRENT_JOBS} active, ${
        jobQueue.size
      } pending`
    );
  }
}

// Helper to get readable hostname from URL
function getHostname(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    return urlString;
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
    console.error("❌ Signature verification failed:", error);
    return new Response("Invalid signature", { status: 401 });
  }

  // Try parsing the body *before* acknowledging, to catch bad requests early
  let jobPayload: JobPayload;
  try {
    jobPayload = JSON.parse(bodyText);
  } catch (parseError: unknown) {
    console.error("❌ Error parsing job payload:", parseError);
    // Return a 400 Bad Request - QStash might retry this depending on settings
    return NextResponse.json(
      { success: false, error: "Failed to parse job payload" },
      { status: 400 }
    );
  }

  // Signature and basic parsing are valid. Acknowledge QStash immediately.
  console.log(
    `📬 Received job for: ${getHostname(jobPayload.url)} | Queue status: ${
      jobQueue.size
    } waiting, ${jobQueue.pending} running`
  );

  // Add the job to the queue instead of running it immediately
  jobQueue
    .add(() => runScrapingJob(jobPayload))
    .catch((err) => {
      console.error(
        `❌ Queue error for ${getHostname(jobPayload.url)}: ${err.message}`
      );
    });

  // Return 202 Accepted immediately
  return NextResponse.json({ message: "Accepted" }, { status: 202 });
}

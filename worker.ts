// worker.ts
import "dotenv/config"; // This is the ES module way to load dotenv
import express, { Request, Response } from "express";
import { Receiver } from "@upstash/qstash";
import { ImprovedPlaywrightScraper } from "./src/lib/scraper/improvedPlaywrightScraper";
import { ScrapedContact } from "./src/lib/scraper/types"; // Import ScrapedContact
import { createClient } from "@supabase/supabase-js";

// Define scraper settings structure
interface ScraperSettings {
  mode?: "standard" | "aggressive" | "gentle";
  maxDepth?: number;
  followLinks?: boolean;
  includePhoneNumbers?: boolean;
  browserType?: "chromium" | "firefox";
  timeout?: number;
  useHeadless?: boolean;
}

// Define the structure of the job payload
interface JobPayload {
  batchId: string;
  url: string;
  settings: ScraperSettings; // Use the defined interface
}

const app = express();
// Cloud Run provides the PORT environment variable automatically
const PORT = process.env.PORT || 3001; // Default to 3001 if not set by Cloud Run

// --- Validate Environment Variables ---
const requiredEnv = [
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(
    `FATAL ERROR: Missing required environment variables: ${missingEnv.join(
      ", "
    )}`
  );
  process.exit(1); // Exit if critical env vars are missing
}

// --- QStash Receiver Initialization ---
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// --- Supabase Client Initialization ---
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- runScrapingJob Function (Copied & adapted from your Vercel route) ---
async function runScrapingJob(jobPayload: JobPayload) {
  // Add type check for safety
  if (!jobPayload || typeof jobPayload !== "object") {
    console.error(
      "WORKER_BACKGROUND_ERROR: Invalid jobPayload received",
      jobPayload
    );
    return;
  }
  const { batchId, url, settings } = jobPayload;
  if (!batchId || !url || !settings) {
    console.error(
      "WORKER_BACKGROUND_ERROR: Missing batchId, url, or settings in jobPayload",
      jobPayload
    );
    return;
  }

  let scrapeResult: ScrapedContact[] | null = null; // Explicit type
  let errorMessage: string | null = null; // Explicit type
  let status = "success";
  let scraper: ImprovedPlaywrightScraper | null = null; // Explicit type

  console.log(
    `WORKER_BACKGROUND_DEBUG: Entered runScrapingJob for ${url}, Batch: ${batchId}`
  );

  try {
    console.log(
      `WORKER_BACKGROUND: Processing job for URL: ${url}, Batch ID: ${batchId}`
    );
    scraper = new ImprovedPlaywrightScraper(); // Ensure this class is correctly required above

    // --- Actual Scraping Logic ---
    try {
      console.log(
        `WORKER_BACKGROUND: Starting scrape for ${url} with settings: ${JSON.stringify(
          settings
        )}`
      );
      console.log(`WORKER_BACKGROUND_DEBUG: Calling scraper.scrapeWebsite...`);
      // --- Playwright Operation ---
      if (scraper) {
        // Null check added
        scrapeResult = await scraper.scrapeWebsite(url, settings);
      } else {
        throw new Error("Scraper instance was not initialized");
      }
      // ---------------------------
      console.log(`WORKER_BACKGROUND_DEBUG: scraper.scrapeWebsite finished.`);
      console.log(
        `WORKER_BACKGROUND: Scraping finished for ${url}. Found ${
          scrapeResult?.length ?? 0 // Use optional chaining
        } contacts.`
      );
    } catch (scrapeError) {
      console.error(
        `WORKER_BACKGROUND_ERROR: Error during scraper.scrapeWebsite for ${url}:`,
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
        `WORKER_BACKGROUND: Attempting to save result for ${url} (Batch ID: ${batchId}) to database...`
      );
      const { data, error: dbError } = await supabase
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
        // Log the DB error but don't crash the whole worker if saving fails
        console.error(
          `WORKER_BACKGROUND_ERROR: DATABASE insert failed for ${url} (Batch ID: ${batchId}):`,
          dbError
        );
        // Optionally, update the existing record if possible, or log for retry
      } else {
        console.log(
          `WORKER_BACKGROUND: Successfully saved result for ${url} (Batch ID: ${batchId})`,
          data
        );
      }
    } catch (dbErrorOuter) {
      console.error(
        `WORKER_BACKGROUND_ERROR: DATABASE CATCH BLOCK for ${url} (Batch ID: ${batchId}):`,
        dbErrorOuter
      );
    }
    // --- End Database Logic ---
    console.log(
      `WORKER_BACKGROUND_DEBUG: Reached end of try block for ${url}.`
    );
  } catch (jobProcessingError) {
    console.error(
      "WORKER_BACKGROUND_ERROR: Unhandled error during job processing:",
      jobProcessingError
    );
    // Attempt to update DB with error status if possible
    try {
      await supabase.from("scraping_results").insert([
        {
          batch_id: batchId,
          url: url,
          status: "error",
          contacts: null,
          error_message:
            jobProcessingError instanceof Error
              ? jobProcessingError.message
              : "Unhandled worker error",
        },
      ]);
    } catch (finalDbError) {
      console.error(
        "WORKER_BACKGROUND_ERROR: Failed to save final error status to DB:",
        finalDbError
      );
    }
  } finally {
    console.log(`WORKER_BACKGROUND_DEBUG: Entering finally block for ${url}.`);
    if (scraper) {
      // Null check added
      console.log(`WORKER_BACKGROUND: Closing browser instance for ${url}`);
      await scraper.close().catch((closeErr) => {
        console.error(
          `WORKER_BACKGROUND_ERROR: Error closing scraper for ${url}:`,
          closeErr
        );
      });
    }
    console.log(
      `WORKER_BACKGROUND: Job processing FINISHED for ${url}, Batch ID: ${batchId}`
    );
  }
}

// --- API Endpoint Definition ---
// Middleware to get the raw body buffer for QStash verification
app.post(
  "/api/process-job",
  express.raw({ type: "application/json", limit: "5mb" }),
  async (req: Request, res: Response) => {
    // Check if body exists and has length
    if (!req.body || req.body.length === 0) {
      console.error("WORKER: Received empty request body.");
      res.status(400).send("Empty request body");
      return;
    }

    let signature = req.headers["upstash-signature"];
    if (!signature) {
      console.error("WORKER: Missing 'upstash-signature' header.");
      res.status(401).send("Missing signature");
      return;
    }
    // Ensure signature is a string if it's an array
    if (Array.isArray(signature)) {
      signature = signature[0];
    }

    let rawBodyString;
    try {
      rawBodyString = req.body.toString("utf-8"); // Ensure correct encoding
      if (!rawBodyString) {
        throw new Error("Raw body converted to empty string");
      }
    } catch (bufferErr) {
      console.error(
        "WORKER: Error converting raw body buffer to string:",
        bufferErr
      );
      res.status(400).send("Invalid body encoding");
      return;
    }

    try {
      console.log(
        `WORKER_DEBUG: Verifying signature: ${signature.substring(
          0,
          10
        )}... Body preview: ${rawBodyString.substring(0, 50)}...`
      );
      const isValid = await receiver.verify({
        signature: signature,
        body: rawBodyString,
      });
      if (!isValid) {
        console.error("WORKER: Invalid QStash signature.");
        res.status(401).send("Invalid signature");
        return;
      }
      console.log("WORKER_DEBUG: Signature verified successfully.");
    } catch (error) {
      console.error(
        "WORKER_ERROR: QStash signature verification threw an error:",
        error
      );
      res.status(401).send("Signature verification failed");
      return;
    }

    // Try parsing the body *after* verification
    let jobPayload: JobPayload;
    try {
      jobPayload = JSON.parse(rawBodyString);
    } catch (parseError) {
      console.error(
        "WORKER_ERROR: Error parsing job payload JSON:",
        parseError,
        "Raw body was:",
        rawBodyString
      );
      res
        .status(400)
        .json({ success: false, error: "Failed to parse job payload" });
      return;
    }

    // Signature and parsing are valid. Acknowledge QStash immediately.
    console.log(
      `WORKER: Acknowledging QStash for job: ${jobPayload?.url}, Batch: ${jobPayload?.batchId}`
    );
    res.status(202).json({ message: "Accepted" });

    // Start the actual job processing asynchronously
    console.log("WORKER_DEBUG: Scheduling runScrapingJob execution (async).");
    runScrapingJob(jobPayload).catch((err) => {
      // This catch is for promise rejections *not* caught inside runScrapingJob
      console.error(
        "WORKER_ERROR: Uncaught error/rejection from runScrapingJob:",
        err
      );
    });
  }
);

// --- Health Check Endpoint (Good Practice) ---
app.get("/health", (req: Request, res: Response) => {
  res.status(200).send("OK");
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`✅ Scraper worker listening on port ${PORT}`);
  console.log(`🕒 Node Env: ${process.env.NODE_ENV}`);
});

// Add this export at the very end if not already present for TS module compatibility
export default app;

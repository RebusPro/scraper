import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
// import { ImprovedPlaywrightScraper } from "@/lib/scraper/improvedPlaywrightScraper"; // Comment out until used
// import { WebScraper } from "@/lib/scraper"; // Assuming index exports WebScraper // Already removed
import { ScrapedContact } from "@/lib/scraper/types";

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

// The main POST handler, wrapped for signature verification
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

  let jobPayload: JobPayload;
  try {
    jobPayload = JSON.parse(bodyText); // Parse the text we already read
  } catch (parseError: unknown) {
    console.error("Error parsing job payload after verification:", parseError);
    return NextResponse.json(
      { error: "Failed to parse job payload" },
      { status: 400 } // Bad Request due to parsing error
    );
  }

  try {
    const { batchId, url, settings } = jobPayload;

    console.log(`Processing job for URL: ${url}, Batch ID: ${batchId}`);

    // --- Placeholder for Scraping Logic ---
    let scrapeResult: ScrapedContact[] | null = null;
    let errorMessage: string | null = null;
    try {
      // TODO: Implement actual scraping call using jobPayload.url and jobPayload.settings
      // const scraper = await getScraperInstance();
      // scrapeResult = await scraper.scrapeWebsite(url, settings);
      console.log(`[Placeholder] Scraping logic for ${url} would run here.`);
      console.log(`[Placeholder] Using settings: ${JSON.stringify(settings)}`);
      // Simulate finding some contacts for now
      scrapeResult = [{ email: `test@${new URL(url).hostname}`, source: url }];
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate work
      console.log(`[Placeholder] Scraping logic finished for ${url}.`);
    } catch (error) {
      console.error(`Error scraping ${url} for batch ${batchId}:`, error);
      errorMessage =
        error instanceof Error ? error.message : "Unknown scraping error";
    }
    // --- End Placeholder ---

    // --- Placeholder for Database Logic ---
    try {
      // TODO: Implement database write logic here
      // await saveResultToDatabase(batchId, url, scrapeResult, errorMessage);
      console.log(
        `[Placeholder] Database write for ${url} (Batch ID: ${batchId}) would happen here.`
      );
      console.log(
        `   Result: ${
          scrapeResult ? JSON.stringify(scrapeResult) : "null"
        }, Error: ${errorMessage}`
      );
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate DB write
    } catch (dbError) {
      console.error(
        `Error saving result for ${url} (Batch ID: ${batchId}) to database:`,
        dbError
      );
      // If DB write fails, QStash might retry the job unless we return success
      // Depending on requirements, might want to return an error status here
      // to force a retry, or log and return success to avoid infinite loops.
      // For now, log and continue to return success to QStash.
    }
    // --- End Placeholder ---

    // Respond to QStash that the job was processed (even if scraping/DB write had issues within)
    return NextResponse.json({ success: true, processedUrl: url });
  } catch (jobProcessingError: unknown) {
    console.error("Error processing job payload:", jobProcessingError);
    // Return an error status code so QStash knows the job failed and might retry
    return NextResponse.json(
      { error: "Failed to process job payload" },
      { status: 500 }
    );
  }
}

// Export the raw handler - verification is now inside
export { handler as POST };

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/qstash";
import { randomUUID } from "crypto";

// Define the expected input structure
interface SubmitBatchInput {
  urls: string[];
  settings: {
    mode?: "standard" | "aggressive" | "gentle";
    maxDepth?: number;
    followLinks?: boolean;
    includePhoneNumbers?: boolean;
    browserType?: "chromium" | "firefox";
    timeout?: number;
  };
}

// Define the structure of the job payload sent to the queue
interface JobPayload {
  batchId: string;
  url: string;
  settings: SubmitBatchInput["settings"];
}

// Initialize QStash client
if (!process.env.QSTASH_URL || !process.env.QSTASH_TOKEN) {
  throw new Error("QStash URL or Token environment variable is not defined.");
}

const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN,
});

// Define the target URL for the worker function
const productionUrl = process.env.PRODUCTION_URL; //  https://scraper-five-xi.vercel.app (Set in Vercel env vars)
const localUrl = "http://localhost:3000";
// Prioritize Production URL for the callback, otherwise use localhost for local dev
const WORKER_URL = productionUrl
  ? `${productionUrl}/api/process-job`
  : `${localUrl}/api/process-job`;

// Log the determined worker URL for debugging
console.log("Using QStash Worker URL:", WORKER_URL);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SubmitBatchInput;
    const { urls, settings } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "No URLs provided" }, { status: 400 });
    }

    // Generate a unique ID for this batch
    const batchId = randomUUID();
    console.log(`Generated Batch ID: ${batchId} for ${urls.length} URLs`);

    // Enqueue each URL as a separate job
    const publishPromises = urls.map((url) => {
      const jobPayload: JobPayload = { batchId, url, settings };
      console.log(`Enqueuing job for URL: ${url} with Batch ID: ${batchId}`);

      return qstashClient.publishJSON({
        // Target the worker URL
        url: WORKER_URL,
        // Alternatively, use a topic if you prefer:
        // topic: "scrape-jobs",
        body: jobPayload,
        // Optional: Add delay, retries, etc.
        // retries: 3,
      });
    });

    // Wait for all publish requests to be acknowledged by QStash
    // Note: This doesn't wait for the jobs to be processed, only for them to be accepted by the queue
    const results = await Promise.allSettled(publishPromises);

    // Log any failures during publishing
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `Failed to enqueue job for URL ${urls[index]}:`,
          result.reason
        );
        // Decide how to handle publishing errors - potentially retry or log for manual intervention
      }
    });

    const successfulJobs = results.filter(
      (r) => r.status === "fulfilled"
    ).length;
    console.log(
      `Successfully enqueued ${successfulJobs} / ${urls.length} jobs for Batch ID: ${batchId}`
    );

    // Return the batch ID to the client
    return NextResponse.json(
      {
        message: `Batch accepted. ${successfulJobs} jobs queued.`,
        batchId,
      },
      { status: 202 } // 202 Accepted
    );
  } catch (error) {
    console.error("Error submitting batch:", error);
    return NextResponse.json(
      { error: "Failed to submit batch for processing" },
      { status: 500 }
    );
  }
}

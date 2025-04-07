import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error(
    "Supabase environment variables (URL or Service Role Key) are not set."
  );
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Define the structure for the summary response
interface BatchSummary {
  batchId: string;
  startTime: string;
  processedCount: number;
  // We can add totalUrls later if we store it separately
}

export async function GET() {
  try {
    // Query to get distinct batch_ids, the min created_at (start time),
    // and the count of records for each batch_id.
    const { data, error } = await supabase
      .from("scraping_results")
      .select("batch_id, created_at") // Select necessary fields for aggregation
      // Note: Supabase JS client might not directly support complex GROUP BY + MIN/COUNT.
      // A database function or view might be more performant, but let's try processing here.
      .order("created_at", { ascending: false }); // Get all records ordered

    if (error) {
      console.error("Database error fetching batch history:", error);
      throw error;
    }

    if (!data) {
      return NextResponse.json({ batches: [] });
    }

    // Process the data in code to get the summary
    const batchMap = new Map<
      string,
      { startTime: string; processedCount: number }
    >();

    data.forEach((row) => {
      const existing = batchMap.get(row.batch_id);
      if (existing) {
        existing.processedCount += 1;
        // Update startTime if this row is earlier
        if (new Date(row.created_at) < new Date(existing.startTime)) {
          existing.startTime = row.created_at;
        }
      } else {
        batchMap.set(row.batch_id, {
          startTime: row.created_at,
          processedCount: 1,
        });
      }
    });

    // Convert map to array
    const batchSummaries: BatchSummary[] = Array.from(batchMap.entries())
      .map(([batchId, summary]) => ({
        batchId,
        ...summary,
      }))
      .sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ); // Sort newest first

    return NextResponse.json({ batches: batchSummaries });
  } catch (error) {
    console.error("Error fetching batch history:", error);
    return NextResponse.json(
      { error: "Failed to fetch batch history" },
      { status: 500 }
    );
  }
}

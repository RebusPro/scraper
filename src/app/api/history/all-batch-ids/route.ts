import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error(
    "Supabase environment variables (URL or Service Role Key) are not set."
  );
  // Consider throwing an error or handling appropriately if critical
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Define the structure for the summary response (can be shared)
interface BatchSummary {
  batchId: string;
  startTime: string;
  processedCount: number;
}

// Define response structure (can be shared)
interface AllBatchResponse {
  batches: BatchSummary[];
  totalCount: number;
}

// Define structure of rows fetched from scraping_results
interface ScrapingResultRow {
  batch_id: string;
  created_at: string; // Assuming timestamptz comes as string
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate") || null;
    const endDate = searchParams.get("endDate") || null;

    // Basic validation for date strings
    const isValidDate = (dateStr: string | null) => {
      if (!dateStr) return true; // No date filter is valid
      return !isNaN(Date.parse(dateStr));
    };

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      console.warn(
        "Invalid date format received in query params for all-batch-ids"
      );
      return NextResponse.json(
        { error: "Invalid date format provided" },
        { status: 400 }
      );
    }

    // Query to fetch all results matching the date criteria
    // Select only necessary fields
    let query = supabase
      .from("scraping_results")
      .select("batch_id, created_at")
      .order("created_at", { ascending: true }); // Order ascending to easily get MIN(created_at)

    if (startDate) {
      query = query.gte("created_at", `${startDate}T00:00:00Z`);
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setDate(endOfDay.getDate() + 1);
      query = query.lt(
        "created_at",
        endOfDay.toISOString().split("T")[0] + "T00:00:00Z"
      ); // Less than start of next day
    }

    // Execute the query to fetch all relevant rows
    const { data: allResults, error } = await query;

    if (error) {
      console.error(
        "Database error fetching results for batch summary:",
        error
      );
      throw error;
    }

    if (!allResults || allResults.length === 0) {
      // Return empty list if no results match
      return NextResponse.json({ batches: [], totalCount: 0 });
    }

    // Process data in code to get unique batches with summary info
    const batchMap = new Map<
      string,
      { startTime: string; processedCount: number }
    >();

    allResults.forEach((result: ScrapingResultRow) => {
      const existing = batchMap.get(result.batch_id);
      if (!existing) {
        // First time seeing this batch_id, record start time and count 1
        batchMap.set(result.batch_id, {
          startTime: result.created_at,
          processedCount: 1,
        });
      } else {
        // Increment count for existing batch_id
        existing.processedCount++;
        // Keep the startTime already set (which is the earliest due to ordering)
      }
    });

    // Convert map to BatchSummary array
    const batchSummaries: BatchSummary[] = Array.from(batchMap.entries()).map(
      ([batchId, summary]) => ({
        batchId,
        startTime: summary.startTime,
        processedCount: summary.processedCount,
      })
    );

    // Optional: Sort batches by startTime descending (most recent first)
    batchSummaries.sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    const response: AllBatchResponse = {
      batches: batchSummaries,
      totalCount: batchSummaries.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in /api/history/all-batch-ids:", error);
    return NextResponse.json(
      { error: "Failed to fetch all batch summaries for export" },
      { status: 500 }
    );
  }
}

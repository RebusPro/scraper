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

// Define the structure returned by the RPC function
interface RpcBatchResult {
  batch_id: string;
  start_time: string; // Supabase returns timestamptz as string
  processed_count: number; // bigint can usually be handled as number in JS
  total_batches: number; // bigint
}

// Define response structure including total count
interface PaginatedBatchResponse {
  batches: BatchSummary[];
  totalCount: number;
}

export async function GET(request: NextRequest) {
  try {
    // Get page and limit from query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    // Get optional date filters
    const startDate = searchParams.get("startDate") || null; // Pass null if not present
    const endDate = searchParams.get("endDate") || null;

    // Validate page and limit
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.max(1, Math.min(50, limit)); // Limit max page size

    // Basic validation for date strings (can be enhanced)
    const isValidDate = (dateStr: string | null) => {
      if (!dateStr) return true; // Null is valid (no filter)
      return !isNaN(Date.parse(dateStr)); // Check if parsable
    };

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      console.warn("Invalid date format received in query params");
      // Optionally return an error, or proceed without date filters
      // For now, let the RPC handle potential conversion issues if needed
    }

    // Call the RPC function, passing date filters
    const { data, error } = await supabase.rpc("get_batch_summaries", {
      page_num: validatedPage,
      page_size: validatedLimit,
      start_date_text: startDate,
      end_date_text: endDate,
    });

    if (error) {
      console.error("Database RPC error fetching batch history:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ batches: [], totalCount: 0 });
    }

    // Extract total count from the first row
    const totalCount = data[0].total_batches;

    // Map the data to the BatchSummary format
    const batchSummaries: BatchSummary[] = data.map((row: RpcBatchResult) => ({
      batchId: row.batch_id,
      startTime: row.start_time,
      processedCount: row.processed_count,
    }));

    const response: PaginatedBatchResponse = {
      batches: batchSummaries,
      totalCount: totalCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching paginated batch history:", error);
    return NextResponse.json(
      { error: "Failed to fetch batch history" },
      { status: 500 }
    );
  }
}

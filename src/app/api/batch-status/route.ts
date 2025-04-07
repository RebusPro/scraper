import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client (use service role key for backend operations)
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");

  if (!batchId) {
    return NextResponse.json({ error: "batchId is required" }, { status: 400 });
  }

  try {
    // Query the database for results matching the batchId
    const { data: results, error: dbError } = await supabase
      .from("scraping_results") // Use your actual table name
      .select("*") // Select all columns
      .eq("batch_id", batchId) // Filter by batch_id
      .order("created_at", { ascending: true }); // Optional: order by creation time

    if (dbError) {
      console.error(
        `Database error fetching status for Batch ID ${batchId}:`,
        dbError
      );
      throw dbError; // Throw to be caught by the outer catch block
    }

    // Process results: Parse contacts JSON
    const processedResults =
      results?.map((row) => {
        let parsedContacts = null;
        if (row.contacts && typeof row.contacts === "string") {
          try {
            parsedContacts = JSON.parse(row.contacts);
          } catch (e) {
            console.error(
              `Failed to parse contacts JSON for URL ${row.url}, Batch ID ${batchId}:`,
              e
            );
            // Keep contacts as null or the raw string depending on desired error handling
          }
        }
        return { ...row, contacts: parsedContacts }; // Return with contacts parsed
      }) || [];

    // TODO: We might also want to get the *total* number of expected jobs for this batchId
    // to calculate progress accurately. This might require storing the total count
    // somewhere when the batch is first submitted, or deriving it if possible.
    // For now, we just return the results found so far.
    const progress = {
      processed: processedResults.length,
      // total: totalJobsInBatch // Needs implementation
    };

    return NextResponse.json({
      message: `Status for Batch ID ${batchId}`,
      progress: progress, // Include progress info
      results: processedResults,
    });
  } catch (error) {
    console.error(`Error fetching status for Batch ID ${batchId}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch batch status" },
      { status: 500 }
    );
  }
}

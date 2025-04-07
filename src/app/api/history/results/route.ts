import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ScrapedContact } from "@/lib/scraper/types"; // Assuming types are needed for parsing

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
        `Database error fetching results for Batch ID ${batchId}:`,
        dbError
      );
      throw dbError; // Throw to be caught by the outer catch block
    }

    // Process results: Parse contacts JSON
    const processedResults =
      results?.map((row) => {
        let parsedContacts: ScrapedContact[] | null = null;
        if (row.contacts && typeof row.contacts === "string") {
          try {
            parsedContacts = JSON.parse(row.contacts);
          } catch (e) {
            console.error(
              `Failed to parse contacts JSON for URL ${row.url}, Batch ID ${batchId}:`,
              e
            );
          }
        }
        // Map DB row to a structure closer to ScrapingResult for consistency
        return {
          url: row.url,
          contacts: parsedContacts,
          timestamp: row.created_at,
          status: row.status,
          message: row.error_message,
          // Include other potentially useful fields if needed
          id: row.id,
          batch_id: row.batch_id,
        };
      }) || [];

    return NextResponse.json({
      message: `Results for Batch ID ${batchId}`,
      results: processedResults,
    });
  } catch (error) {
    console.error(`Error fetching results for Batch ID ${batchId}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch batch results" },
      { status: 500 }
    );
  }
}

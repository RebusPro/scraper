import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client (use service role key for backend operations)
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error(
    "⚠️ Supabase environment variables (URL or Service Role Key) are not set."
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
    console.log(`📊 Fetching status for batch: ${batchId}`);

    // Query the database for results matching the batchId
    const { data: results, error: dbError } = await supabase
      .from("scraping_results")
      .select("*")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true });

    if (dbError) {
      console.error(
        `❌ Database error fetching batch ${batchId}: ${dbError.message}`
      );
      throw dbError;
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
              `⚠️ JSON parse error for ${row.url}: ${
                e instanceof Error ? e.message : "Unknown error"
              }`
            );
          }
        }
        return { ...row, contacts: parsedContacts };
      }) || [];

    const progress = {
      processed: processedResults.length,
    };

    // Count successes and failures
    const successCount = processedResults.filter(
      (r) => r.status === "success"
    ).length;
    const errorCount = processedResults.filter(
      (r) => r.status === "error"
    ).length;

    // Count total emails found
    const totalEmails = processedResults.reduce((sum, result) => {
      return (
        sum + (Array.isArray(result.contacts) ? result.contacts.length : 0)
      );
    }, 0);

    console.log(
      `📈 Batch ${batchId} status: ${processedResults.length} URLs processed (${successCount} ✅, ${errorCount} ❌), ${totalEmails} emails found`
    );

    return NextResponse.json({
      message: `Status for Batch ID ${batchId}`,
      progress: progress,
      results: processedResults,
      summary: {
        successful: successCount,
        failed: errorCount,
        totalEmails: totalEmails,
      },
    });
  } catch (error) {
    console.error(
      `❌ Error fetching batch ${batchId}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return NextResponse.json(
      { error: "Failed to fetch batch status" },
      { status: 500 }
    );
  }
}

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const batchId = searchParams.get("batchId");

    if (!batchId) {
      return NextResponse.json(
        { error: "batchId query parameter is required" },
        { status: 400 }
      );
    }

    // Query distinct URLs for the given batchId
    // Note: Selecting distinct might be less performant on very large tables without indexing.
    // For moderate use, this should be okay. A database function could optimize if needed.
    const { data, error } = await supabase
      .from("scraping_results")
      .select("url", { count: "exact", head: false }) // Select only URL
      .eq("batch_id", batchId);

    if (error) {
      console.error(
        `Database error fetching URLs for batch ${batchId}:`,
        error
      );
      throw error;
    }

    if (!data) {
      return NextResponse.json({ urls: [] });
    }

    // Extract unique URLs using a Set to handle potential duplicates if .select distinct isn't perfect
    const uniqueUrls = [...new Set(data.map((item) => item.url))];

    return NextResponse.json({ urls: uniqueUrls });
  } catch (error) {
    console.error("Error fetching batch URLs:", error);
    return NextResponse.json(
      { error: "Failed to fetch batch URLs" },
      { status: 500 }
    );
  }
}

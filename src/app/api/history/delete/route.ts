import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId");

    if (!batchId) {
      return NextResponse.json(
        { error: "Batch ID is required" },
        { status: 400 }
      );
    }

    // Delete all results associated with the batch
    // Since we only have a scraping_results table, we just need to delete entries with the given batch_id
    const { error } = await supabase
      .from("scraping_results")
      .delete()
      .eq("batch_id", batchId);

    if (error) {
      console.error("Error deleting batch:", error);
      return NextResponse.json(
        { error: "Failed to delete batch" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in delete batch:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

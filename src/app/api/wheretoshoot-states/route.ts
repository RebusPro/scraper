/**
 * API endpoint to get available states from WhereToShoot data
 * This helps verify we're showing all states that have shooting ranges
 */

import { NextResponse } from "next/server";

export const maxDuration = 60;

interface RangeData {
  State: string;
  [key: string]: unknown;
}

export async function GET() {
  try {
    // Fetch all ranges
    const dataUrl = "https://www.wheretoshoot.org/wp-content/plugins/where-to-shoot/api/data.php?wts_map_data=6857649";
    const response = await fetch(dataUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch range data: ${response.status}`);
    }

    const allRanges = await response.json();

    // Extract unique state abbreviations
    const uniqueStates = [...new Set(
      allRanges
        .map((range: RangeData) => range.State)
        .filter((state: string) => state && state.trim() !== "")
    )].sort();

    return NextResponse.json({
      states: uniqueStates,
      count: uniqueStates.length,
      totalRanges: allRanges.length,
    });
  } catch (error) {
    console.error("Error fetching states:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch states",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

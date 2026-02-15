/**
 * API endpoint to get available cities for a state from WhereToShoot data
 * This ensures the city dropdown only shows cities that actually have ranges
 */

import { NextRequest, NextResponse } from "next/server";

// Set runtime to allow longer execution
export const maxDuration = 60;

// Map state names to abbreviations
const STATE_ABBREV: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
  Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

interface RangeData {
  City: string;
  State: string;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const state = searchParams.get("state");

    if (!state) {
      return NextResponse.json(
        { error: "State parameter is required" },
        { status: 400 }
      );
    }

    // Get state abbreviation
    const stateAbbrev = STATE_ABBREV[state];
    if (!stateAbbrev) {
      return NextResponse.json(
        { error: `Invalid state: ${state}` },
        { status: 400 }
      );
    }

    // Fetch all ranges
    const dataUrl = "https://www.wheretoshoot.org/wp-content/plugins/where-to-shoot/api/data.php?wts_map_data=6857649";
    const response = await fetch(dataUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch range data: ${response.status}`);
    }

    const allRanges = await response.json();

    // Filter by state and extract unique cities
    const rangesInState = allRanges.filter((range: RangeData) => {
      return range.State === stateAbbrev;
    });

    const uniqueCities = [...new Set(
      rangesInState
        .map((range: RangeData) => range.City)
        .filter((city: string) => city && city.trim() !== "")
    )].sort();

    return NextResponse.json({
      cities: uniqueCities,
      count: uniqueCities.length,
    });
  } catch (error) {
    console.error("Error fetching cities:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch cities",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

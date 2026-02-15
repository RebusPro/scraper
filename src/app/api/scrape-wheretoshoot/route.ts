/**
 * API Route for scraping WhereToShoot.org shooting range data
 * Uses WordPress REST API endpoints - no browser automation needed!
 */

import { NextRequest, NextResponse } from "next/server";
import { ScrapedContact } from "@/lib/scraper/types";

// Set runtime to allow longer execution
export const maxDuration = 60; // 60 seconds max

// Interface for the data.php API response
interface RangeData {
  Name: string;
  Shooting_Facility_Range_Name: string;
  General_Email: string;
  Main_Phone: string;
  Web_Site_Address: string;
  Address: string;
  City: string;
  State: string;
  ZIP: string;
  Country: string;
  Lat: string;
  Lng: string;
  Type_of_Facility: string;
  Public_or_Private_Facility: string;
  [key: string]: unknown; // For all other fields
}

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { state, city } = body;

    console.log("Received request:", { state, city });

    // Validate state
    if (!state) {
      return NextResponse.json(
        { error: "State is required" },
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

    console.log(`Fetching ALL ranges from data.php and filtering by state: ${stateAbbrev}`);

    // Step 1: Fetch ALL ranges from the data.php endpoint
    const dataUrl = "https://www.wheretoshoot.org/wp-content/plugins/where-to-shoot/api/data.php?wts_map_data=6857649";
    console.log("Fetching all ranges from:", dataUrl);

    const response = await fetch(dataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch range data: ${response.status}`);
    }

    const allRanges = await response.json();
    console.log(`Fetched ${allRanges.length} total ranges from data.php`);

    // Step 2: Filter by state (and optionally city)
    let filteredRanges = allRanges.filter((range: RangeData) => {
      return range.State === stateAbbrev;
    });

    console.log(`Found ${filteredRanges.length} ranges in ${state} (${stateAbbrev})`);

    // Log unique cities in this state for debugging
    const uniqueCities = [...new Set(filteredRanges.map((range: RangeData) => range.City))].sort();
    console.log(`Unique cities in ${state}:`, uniqueCities.slice(0, 20)); // Show first 20 cities

    // Count ranges per city for debugging
    const cityCounts: Record<string, number> = {};
    filteredRanges.forEach((range: RangeData) => {
      const city = range.City || "Unknown";
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });
    const citiesWithMultipleRanges = Object.entries(cityCounts)
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    console.log(`Cities with multiple ranges in ${state}:`, citiesWithMultipleRanges);

    // If a specific city is selected, filter further
    if (city && city !== "ALL Cities") {
      const beforeFilterCount = filteredRanges.length;
      filteredRanges = filteredRanges.filter((range: RangeData) => {
        const rangeCity = String(range.City || "").toLowerCase();
        return rangeCity.includes(city.toLowerCase());
      });
      console.log(`Filtered from ${beforeFilterCount} to ${filteredRanges.length} ranges when searching for "${city}"`);
    }

    if (filteredRanges.length === 0) {
      return NextResponse.json({
        contacts: [],
        ranges: [],
        message: "No shooting ranges found for the selected location",
      });
    }

    // Step 3: Extract contact information
    const contacts: ScrapedContact[] = [];
    const processedRanges: Record<string, unknown>[] = [];

    filteredRanges.forEach((range: RangeData, index: number) => {
      // Log first range to see what fields we have
      if (index === 0) {
        console.log("Sample range data (first result):", JSON.stringify(range, null, 2).substring(0, 1000));
      }

      // Extract contact info using the data.php field names
      const email = String(range.General_Email || "").trim().toLowerCase();
      const website = normalizeWebsite(String(range.Web_Site_Address || ""));
      const phone = String(range.Main_Phone || "");
      const rangeName = String(range.Shooting_Facility_Range_Name || "Unknown Range");
      const address = String(range.Address || "");
      const rangeCity = String(range.City || "");
      const rangeState = String(range.State || "");
      const zip = String(range.ZIP || "");
      const lat = range.Lat;
      const lng = range.Lng;

      // Build display name with location
      let displayName = rangeName;
      if (rangeCity && rangeState) {
        displayName = `${rangeName} (${rangeCity}, ${rangeState})`;
      } else if (rangeCity) {
        displayName = `${rangeName} (${rangeCity})`;
      }

      // Log what we extracted for first few ranges
      if (index < 3) {
        console.log(`Range ${index + 1} extraction:`, {
          rangeName,
          email: email || "NO EMAIL",
          website: website || "NO WEBSITE",
          phone: phone || "NO PHONE",
          city: rangeCity,
          state: rangeState,
          hasData: !!(email || website)
        });
      }

      // Add all ranges (even without email/website, they may have phone or address)
      contacts.push({
        email: email || "",
        url: website || "",
        name: displayName,
        phone: phone,
        title: "",
        source: "WhereToShoot.org API",
        metadata: {
          address,
          city: rangeCity,
          state: rangeState,
          zip,
          contactPerson: "",
          facilityType: range.Type_of_Facility || range.Public_or_Private_Facility,
          latitude: lat,
          longitude: lng,
        },
      });

      // Store full range data for raw view
      processedRanges.push(range);
    });

    console.log(`Extracted ${contacts.length} contacts with email or website`);

    return NextResponse.json({
      contacts,
      ranges: processedRanges,
      stats: {
        totalRangesFetched: allRanges.length,
        rangesInState: filteredRanges.length,
        contactsExtracted: contacts.length,
      },
    });
  } catch (error) {
    console.error("Error in scrape-wheretoshoot API:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch shooting range data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Normalize website URLs to ensure they're valid and consistent
 */
function normalizeWebsite(website: string | undefined): string {
  if (!website) return "";

  let url = website.trim();

  // Remove common invalid patterns
  if (
    url === "http://" ||
    url === "https://" ||
    url === "www." ||
    url === "N/A" ||
    url === "n/a" ||
    url === "none" ||
    url === "None"
  ) {
    return "";
  }

  // Add https:// if no protocol specified
  if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  // Basic URL validation
  try {
    new URL(url);
    return url;
  } catch {
    // If URL is invalid, try with www prefix
    try {
      const withWww = url.startsWith("http") ? url : `https://www.${url}`;
      new URL(withWww);
      return withWww;
    } catch {
      // Still invalid, return empty
      return "";
    }
  }
}

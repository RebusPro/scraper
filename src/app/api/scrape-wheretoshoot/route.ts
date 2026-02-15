/**
 * API Route for scraping WhereToShoot.org shooting range data
 * Uses WordPress REST API endpoints - no browser automation needed!
 */

import { NextRequest, NextResponse } from "next/server";
import { ScrapedContact } from "@/lib/scraper/types";
import { CITIES_BY_STATE } from "@/lib/constants/citiesByState";

// Set runtime to allow longer execution
export const maxDuration = 60; // 60 seconds max

interface WhereToShootSearchResult {
  attributes: {
    type: string;
    url: string;
  };
  Name: string;
  Shooting_Facility_Range_Name__c: string;
}

interface WhereToShootRangeDetails {
  Name: string;
  Shooting_Facility_Range_Name__c?: string;
  // Actual field names from API
  General_Email__c?: string;
  Primary_Contact_Email__c?: string;
  Email__c?: string;
  Main_Phone__c?: string;
  Primary_Contact_Phone__c?: string;
  Fax__c?: string;
  Primary_Phone__c?: string;
  Fax_Number__c?: string;
  Web_Site_Address__c?: string;
  Website__c?: string;
  First_Name__c?: string;
  Last_Name__c?: string;
  Contact_First_Name__c?: string;
  Contact_Last_Name__c?: string;
  Primary_Contact_Title__c?: string;
  Applicants_Title__c?: string;
  Address__c?: string;
  Facility_Address_Line_1__c?: string;
  Facility_Address_Line_2__c?: string;
  City__c?: string;
  Facility_City__c?: string;
  State__c?: string;
  Facility_State_Province__c?: string;
  ZIP__c?: string;
  Facility_Postal_Code__c?: string;
  Latitude__c?: number;
  Longitude__c?: number;
  Facility_Latitude__c?: number;
  Facility_Longitude__c?: number;
  Public_or_Private_Facility__c?: string;
  Type_of_Facility__c?: string;
  [key: string]: unknown; // For all other fields
}

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

    // Build search terms array
    let searchTerms: string[] = [];

    if (city === "ALL Cities" || !city) {
      // Search state name + all major cities
      searchTerms = [state, ...(CITIES_BY_STATE[state] || [])];
      console.log(
        `Searching ALL cities in ${state}. Total search terms: ${searchTerms.length}`
      );
    } else {
      // Search only specific city
      searchTerms = [city];
      console.log(`Searching only ${city}, ${state}`);
    }

    // Step 1: Search for range IDs using all search terms
    // Add delay between requests to avoid rate limiting
    console.log("Step 1: Searching for range IDs...");
    const rangeIdSets: string[][] = [];

    // Process searches in batches of 10 with delays to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < searchTerms.length; i += batchSize) {
      const batch = searchTerms.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (term) => {
          try {
            const searchUrl = `https://www.wheretoshoot.org/wp-json/search-form/v1/form/${encodeURIComponent(
              term
            )}`;
            console.log(`Searching: ${searchUrl}`);

            // Add small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));

            const response = await fetch(searchUrl);
            if (!response.ok) {
              console.error(`Search failed for ${term}: ${response.status}`);
              return [];
            }

            const results: WhereToShootSearchResult[] = await response.json();
            console.log(`Found ${results.length} results for "${term}"`);

            // Extract range IDs
            return results.map((r) => r.Name);
          } catch (error) {
            console.error(`Error searching for ${term}:`, error);
            return [];
          }
        })
      );

      rangeIdSets.push(...batchResults);

      // Delay between batches
      if (i + batchSize < searchTerms.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Flatten and deduplicate range IDs
    const allRangeIds = rangeIdSets.flat();
    const uniqueRangeIds = [...new Set(allRangeIds)];
    console.log(
      `Total unique range IDs found: ${uniqueRangeIds.length} (from ${allRangeIds.length} total results)`
    );

    if (uniqueRangeIds.length === 0) {
      return NextResponse.json({
        contacts: [],
        ranges: [],
        message: "No shooting ranges found for the selected location",
      });
    }

    // Step 2: Fetch detailed information for each range
    console.log(
      "Step 2: Fetching detailed information for each range..."
    );
    const rangeDetailsResults: WhereToShootRangeDetails[] = [];

    // Fetch in batches with delays to avoid rate limiting
    const detailBatchSize = 5;
    for (let i = 0; i < uniqueRangeIds.length; i += detailBatchSize) {
      const batch = uniqueRangeIds.slice(i, i + detailBatchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (rangeId, index) => {
          try {
            // Stagger requests within batch
            await new Promise(resolve => setTimeout(resolve, index * 200));

            const detailsUrl = `https://www.wheretoshoot.org/wp-json/range-form/v1/form/${rangeId}`;
            const response = await fetch(detailsUrl);

            if (!response.ok) {
              console.error(
                `Failed to fetch details for range ${rangeId}: ${response.status}`
              );
              return null;
            }

            const rawDetails = await response.json();
            // API returns an array with single object, extract it
            const details: WhereToShootRangeDetails = Array.isArray(rawDetails) ? rawDetails[0] : rawDetails;
            console.log(`Fetched details for range ${rangeId}:`, {
              name: details.Shooting_Facility_Range_Name__c,
              hasEmail: !!(details.General_Email__c || details.Email__c),
              hasWebsite: !!(details.Web_Site_Address__c || details.Website__c)
            });
            return details;
          } catch (error) {
            console.error(`Error fetching details for range ${rangeId}:`, error);
            return null;
          }
        })
      );

      // Filter successful results
      batchResults.forEach(result => {
        if (result.status === "fulfilled" && result.value !== null) {
          rangeDetailsResults.push(result.value);
        }
      });

      // Delay between batches
      if (i + detailBatchSize < uniqueRangeIds.length) {
        console.log(`Waiting before next batch... (${rangeDetailsResults.length} fetched so far)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // rangeDetailsResults already contains only valid results
    const rangeDetails: WhereToShootRangeDetails[] = rangeDetailsResults;

    console.log(
      `Successfully fetched details for ${rangeDetails.length} ranges`
    );

    // Step 3: Extract contact information
    const contacts: ScrapedContact[] = [];
    const processedRanges: Record<string, unknown>[] = [];

    rangeDetails.forEach((range, index) => {
      // Log first range to see what fields we actually get
      if (index === 0) {
        console.log("Sample range data (first result):", JSON.stringify(range, null, 2));
      }

      // Extract basic contact info - use actual field names from API
      const email = String(
        range.General_Email__c ||           // Correct field name!
        range.Primary_Contact_Email__c ||
        range.Email__c ||
        range.email ||
        range.Email ||
        ""
      ).trim().toLowerCase();

      const website = normalizeWebsite(
        String(
          range.Web_Site_Address__c ||      // Correct field name!
          range.Website__c ||
          range.website ||
          range.Website ||
          ""
        )
      );

      const phone = String(
        range.Main_Phone__c ||               // Correct field name!
        range.Primary_Contact_Phone__c ||
        range.Fax__c ||
        range.Primary_Phone__c ||
        range.Fax_Number__c ||
        range.phone ||
        range.Phone ||
        ""
      );

      const rangeName = String(
        range.Shooting_Facility_Range_Name__c ||
        range.name ||
        range.Name ||
        range["facilityName"] ||
        "Unknown Range"
      );

      // Build full address - use actual field names from API
      const addressParts = [
        range.Address__c,                    // Correct field name!
        range.Facility_Address_Line_1__c,
        range.Facility_Address_Line_2__c,
      ].filter(Boolean);
      const address = addressParts.join(", ");

      const city = String(range.City__c || range.Facility_City__c || range.city || "");
      const state = String(range.State__c || range.Facility_State_Province__c || range.state || "");
      const zip = String(range.ZIP__c || range.Facility_Postal_Code__c || range.zip || "");

      // Build contact name - use actual field names from API
      const firstName = String(range.First_Name__c || range.Contact_First_Name__c || "");
      const lastName = String(range.Last_Name__c || range.Contact_Last_Name__c || "");
      const contactPerson = [firstName, lastName].filter(Boolean).join(" ");

      // Build display name with location
      let displayName = rangeName;
      if (city && state) {
        displayName = `${rangeName} (${city}, ${state})`;
      } else if (city) {
        displayName = `${rangeName} (${city})`;
      }

      // Log what we extracted
      if (index < 3) {
        console.log(`Range ${index + 1} extraction:`, {
          rangeName,
          email: email || "NO EMAIL",
          website: website || "NO WEBSITE",
          phone: phone || "NO PHONE",
          hasData: !!(email || website)
        });
      }

      // Only add if we have at least email OR website
      if (email || website) {
        contacts.push({
          email: email || "",
          url: website || "",
          name: displayName,
          phone: phone,
          title: String(range.Primary_Contact_Title__c || ""),
          source: "WhereToShoot.org API",
          // Store additional data for export
          metadata: {
            address,
            city,
            state,
            zip,
            contactPerson,
            facilityType:
              range.Public_or_Private_Facility__c || range.Type_of_Facility__c,
            latitude: range.Latitude__c || range.Facility_Latitude__c,
            longitude: range.Longitude__c || range.Facility_Longitude__c,
          },
        });
      }

      // Store full range data for raw view
      processedRanges.push(range as Record<string, unknown>);
    });

    console.log(`Extracted ${contacts.length} contacts with email or website`);

    return NextResponse.json({
      contacts,
      ranges: processedRanges,
      stats: {
        searchTermsUsed: searchTerms.length,
        rangeIdsFound: uniqueRangeIds.length,
        rangesWithDetails: rangeDetails.length,
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

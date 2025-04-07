/**

 * API route specifically designed to handle the Learn to Skate USA website

 * Uses browser automation to handle cases where direct API calls are blocked

 */

import { FormField, WebScraper } from "@/lib/scraper";

import { ScrapedContact } from "@/lib/scraper/types";

import { NextRequest, NextResponse } from "next/server";

// Increase the maximum execution duration for this function to 60 seconds (Vercel Pro plan)
export const maxDuration = 180; // Increase to 3 minutes for interactive scrape

// Remove unused interfaces
// interface ProgramInfo { ... }
// interface PageProgramInfo { ... }

// Type for program data from the API

interface LearnToSkateProgram {
  // Known properties

  Email?: string;

  email?: string;

  OrganizationName?: string;

  FacilityName?: string;

  Website?: string;

  website?: string;

  OrganizationPhoneNumber?: string;

  Phone?: string; // Allow other string properties for exploration

  [key: string]: string | number | boolean | null | undefined;
}

export async function POST(request: NextRequest) {
  try {
    const { state, zipCode, programName } = await request.json(); // Validate input

    if (!state && !zipCode) {
      return NextResponse.json(
        { error: "Either state or zip code is required" },

        { status: 400 }
      );
    }

    console.log(
      `Starting browser-based scraping for state=${state}, zipCode=${zipCode}`
    ); // Create a form fields array with proper typing

    const formFields: FormField[] = [
      // State dropdown - always included

      {
        selector: "#mapStateId",

        value: state,

        type: "select",
      }, // Zip radius - always included

      {
        selector: "#zipSelect",

        value: "100", // 100 mile radius (maximum)

        type: "select",
      },
    ]; // Conditionally add zip code field if provided

    if (zipCode) {
      formFields.push({
        selector: "#mapZipCode",

        value: zipCode,

        type: "text",
      });
    } // Conditionally add program name field if provided

    if (programName) {
      formFields.push({
        selector: "#mapFacilityName",

        value: programName,

        type: "text",
      });
    } // Configure the scraper

    const scraper = new WebScraper({
      // Required for interactive websites

      useHeadless: true, // Configure form interaction specifically for Learn to Skate USA

      formInteraction: {
        enabled: true,

        fields: formFields,

        submitButtonSelector: "#searchProgramsSubmitBtn",

        waitTime: 5000, // 5 seconds
      }, // Enable following links for more contact info

      followLinks: true,

      maxDepth: 2,
    });

    try {
      // Run the scraper
      const result = await scraper.scrapeWebsite(
        "https://www.learntoskateusa.com/findaskatingprogram/#mapListings"
      );

      const resultObj = JSON.parse(JSON.stringify(result));
      const apiResponses = resultObj.apiResponses || [];

      interface ApiResponse {
        url?: string;
        content: string;
      }

      // --- REVISED LOGIC ---
      // 1. Find ALL relevant API responses
      const learnToSkateApiResponses = apiResponses.filter(
        (response: ApiResponse) =>
          response.url?.includes("/umbraco/surface/Map/GetPointsFromSearch")
      );
      console.log(
        `Found ${learnToSkateApiResponses.length} GetPointsFromSearch responses.`
      );

      // 2. Select the LAST response, assuming it's the correct one after form submit
      const finalApiResponse =
        learnToSkateApiResponses.length > 0
          ? learnToSkateApiResponses[learnToSkateApiResponses.length - 1]
          : null;

      // 3. Initialize results array
      const enhancedContacts: ScrapedContact[] = [];
      let formattedPrograms: LearnToSkateProgram[] = []; // For raw display

      // 4. Process ONLY the final response
      if (finalApiResponse) {
        try {
          const apiData = JSON.parse(finalApiResponse.content);
          console.log(`Processing the FINAL GetPointsFromSearch response.`);
          // Vercel Debug log for the final response
          console.log(
            `VERCEL_DEBUG (Final): Received ${
              apiData.programs?.length ?? 0
            } programs. First few:`,
            JSON.stringify(apiData.programs?.slice(0, 5), null, 2)
          );

          if (apiData && apiData.programs && Array.isArray(apiData.programs)) {
            apiData.programs.forEach((program: LearnToSkateProgram) => {
              // Ensure potential email fields are strings before calling toLowerCase
              let email: string | undefined = undefined;
              if (typeof program.OrganizationEmail === "string") {
                email = program.OrganizationEmail.toLowerCase();
              } else if (typeof program.Email === "string") {
                email = program.Email.toLowerCase();
              } else if (typeof program.email === "string") {
                email = program.email.toLowerCase();
              }

              if (email) {
                let website =
                  typeof program.Website === "string" ? program.Website : "";
                if (website === "http://") website = "";

                let displayName = program.OrganizationName || "Unknown Program";
                if (program.City && program.StateCode) {
                  displayName = `${displayName} (${program.City}, ${program.StateCode})`;
                }

                enhancedContacts.push({
                  email: email,
                  name: displayName,
                  title: "Organization", // Default title
                  phone: program.OrganizationPhoneNumber || "",
                  url: website,
                  source: "Learn to Skate USA API",
                });
              }
            });

            // Build formattedPrograms based on the final list for raw display
            formattedPrograms = enhancedContacts.map(
              (contact) =>
                ({
                  OrganizationName: contact.name,
                  OrganizationEmail: contact.email,
                  OrganizationPhoneNumber: contact.phone || "",
                  Website: contact.url || "",
                } as LearnToSkateProgram)
            );
            console.log(
              `Successfully processed ${enhancedContacts.length} contacts from final API response.`
            );
          } else {
            console.log(
              "Final API response did not contain a valid 'programs' array."
            );
          }
        } catch (parseError) {
          console.error(
            "Error parsing FINAL Learn to Skate API response:",
            parseError
          );
        }
      } else {
        console.log(
          "Could not find any GetPointsFromSearch API response in captured data."
        );
      }

      // --- REMOVED OLD/REDUNDANT PROCESSING LOOPS ---
      // The old loops using programsByEmail and apiProgramsMap are no longer needed

      // 5. Return the results built ONLY from the final API response
      return NextResponse.json({
        success: true,
        emails: enhancedContacts, // Use the correctly built list
        programs: formattedPrograms, // Use the correctly built list
        message: `Found ${enhancedContacts.length} contacts from API.`, // Updated message
      });
    } catch (error) {
      console.error("Error during browser-based scraping:", error); // Return a more detailed error

      return NextResponse.json(
        {
          error: "Failed to scrape Learn to Skate USA website",

          details: error instanceof Error ? error.message : String(error),
        },

        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error processing request:", error);

    return NextResponse.json(
      { error: "Failed to process request" },

      { status: 500 }
    );
  }
}

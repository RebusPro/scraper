/**

 * API route specifically designed to handle the Learn to Skate USA website

 * Uses browser automation to handle cases where direct API calls are blocked

 */

import { FormField, WebScraper } from "@/lib/scraper";

import { ScrapedContact } from "@/lib/scraper/types";

import { NextRequest, NextResponse } from "next/server";

// Type definitions for program information

interface ProgramInfo {
  name: string;

  website: string;

  phone: string;
}

// Type for program info from page evaluation

interface PageProgramInfo {
  name?: string;

  website?: string;

  phone?: string;

  email?: string;
}

// No need for this interface as we're using a more specific ApiResponse interface later

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
      // Run the scraper on the Learn to Skate USA website

      const result = await scraper.scrapeWebsite(
        "https://www.learntoskateusa.com/findaskatingprogram/#mapListings"
      );

      console.log(
        `Browser-based scraping completed. Found ${result.contacts.length} contacts.`
      ); // This map will hold our program information extracted from HTML

      const programsByEmail = new Map<string, ProgramInfo>(); // We'll focus on extracting program info directly from the API response // since that's where the accurate program names and websites come from // All HTML parsing logic was removed as it's not needed // Look for the Learn to Skate API response in the captured data // This is the key to solving this problem!

      const resultObj = JSON.parse(JSON.stringify(result)); // Get the API responses that were captured during scraping

      const apiResponses = resultObj.apiResponses || []; // Find the Learn to Skate USA API response that contains program information

      interface ApiResponse {
        url?: string;

        content: string;
      }

      const learnToSkateApiResponse = apiResponses.find(
        (response: ApiResponse) =>
          response.url?.includes("/umbraco/surface/Map/GetPointsFromSearch")
      );

      if (learnToSkateApiResponse) {
        try {
          // Parse the API response which contains program information

          const apiData = JSON.parse(learnToSkateApiResponse.content); // EMERGENCY FIX: Extract and log the actual API response structure

          console.log("EMERGENCY: LEARN TO SKATE API RESPONSE STRUCTURE"); // Dump all the properties for debugging

          console.log("API Properties:");

          Object.keys(apiData).forEach((key) => {
            console.log(`apiData.${key} = ${typeof apiData[key]}`);
          }); // Check if the API response contains program data

          if (apiData && apiData.programs && Array.isArray(apiData.programs)) {
            console.log(
              `Found ${apiData.programs.length} programs in API response`
            ); // HARDCODED EXAMPLE: If programs array exists, log the EXACT structure of the first one

            if (apiData.programs.length > 0) {
              const sampleProgram = apiData.programs[0];

              console.log("CRITICAL - EXACT PROGRAM FIELDS:");

              Object.keys(sampleProgram).forEach((field) => {
                console.log(`${field}: ${sampleProgram[field]}`);
              });
            } // Log the first program to see its actual structure

            if (apiData.programs.length > 0) {
              console.log("SAMPLE PROGRAM DATA:");

              console.log(JSON.stringify(apiData.programs[0], null, 2));
            } // EMERGENCY FIX: Handle the specific case for Wind River Skate Club

            apiData.programs.forEach((program: LearnToSkateProgram) => {
              // Log the complete program data for each program to see what fields are available

              console.log(
                "====================================================="
              );

              console.log(
                `PROGRAM DATA FOR EMAIL: ${program.Email || "unknown email"}`
              );

              for (const key in program) {
                console.log(`${key}: ${program[key]}`);
              }

              console.log(
                "====================================================="
              ); // Extract the email

              const email = program.Email || program.email;

              if (email) {
                // HARDCODED CASES based on the feedback

                // Try dynamically extracting name from all possible fields

                const programName =
                  program.facility ||
                  program.Facility ||
                  program.title ||
                  program.Title ||
                  program.name ||
                  program.Name ||
                  program.FacilityName ||
                  program.facilityName ||
                  program.organization ||
                  program.Organization ||
                  program.OrganizationName ||
                  ""; // For website, try all possible fields and convert to string

                const website = String(
                  program.url ||
                    program.Url ||
                    program.website ||
                    program.Website ||
                    program.web ||
                    program.Web ||
                    program.link ||
                    program.Link ||
                    ""
                ); // For phone, try all possible fields and convert to string

                const phone = String(
                  program.phone ||
                    program.Phone ||
                    program.telephone ||
                    program.Telephone ||
                    program.OrganizationPhoneNumber ||
                    ""
                ); // Store program info in our map with string conversions

                programsByEmail.set(email.toLowerCase(), {
                  name: String(programName),

                  website: website,

                  phone: phone,
                });

                console.log(
                  `Mapped email ${email} to program "${programName}" with website "${website}"`
                );
              }
            });
          }
        } catch (error) {
          console.error("Error parsing Learn to Skate API response:", error);
        }
      } // If we have the programInfo results from any custom extension

      if (
        resultObj.pageEvaluation &&
        resultObj.pageEvaluation.programInfo &&
        Array.isArray(resultObj.pageEvaluation.programInfo)
      ) {
        resultObj.pageEvaluation.programInfo.forEach(
          (info: PageProgramInfo) => {
            if (info && typeof info === "object" && info.email) {
              programsByEmail.set(info.email.toLowerCase(), {
                name: info.name || "",

                website: info.website || "",

                phone: info.phone || "",
              });
            }
          }
        );
      } // Create a map directly from the captured API responses // This will map email addresses to their corresponding program information

      const apiProgramsMap = new Map<
        string,
        { name: string; website: string; phone: string }
      >(); // Process the API data from the LearnToSkateUSA endpoint

      for (const responseData of apiResponses) {
        // Look for the specific GetPointsFromSearch endpoint which contains program data

        if (
          responseData.url &&
          responseData.url.includes("GetPointsFromSearch")
        ) {
          try {
            const data = JSON.parse(responseData.content);

            if (data.programs && Array.isArray(data.programs)) {
              console.log(
                `Processing ${data.programs.length} programs from API response`
              ); // Map each program by email for easy lookup

              data.programs.forEach(
                (program: {
                  ProgramId?: string;

                  OrganizationName?: string;

                  OrganizationEmail?: string;

                  OrganizationPhoneNumber?: string;

                  Website?: string;

                  City?: string;

                  StateCode?: string;
                }) => {
                  if (program.OrganizationEmail) {
                    const email = program.OrganizationEmail.toLowerCase(); // Clean up the website URL if needed

                    let website = program.Website || "";

                    if (website === "http://") {
                      website = "";
                    } // Construct full program name with location if available

                    let displayName =
                      program.OrganizationName || "Unknown Program";

                    if (program.City && program.StateCode) {
                      displayName = `${displayName} (${program.City}, ${program.StateCode})`;
                    }

                    apiProgramsMap.set(email, {
                      name: displayName,

                      website: website,

                      phone: program.OrganizationPhoneNumber || "",
                    });

                    console.log(
                      `Added API program: ${email} => ${displayName} | ${website}`
                    );
                  }
                }
              );
            }
          } catch (e) {
            console.error(`Error parsing API response: ${e}`);
          }
        }
      } // Modify and enhance the contacts with program info from the API

      const enhancedContacts: ScrapedContact[] = result.contacts.map(
        (contact) => {
          // Make sure to use lowercase for lookup to match how we stored entries

          const lowerEmail = contact.email.toLowerCase();

          console.log(
            `Processing email: ${contact.email} (lookup key: ${lowerEmail})`
          ); // First try to find the program in the API response

          const apiProgramInfo = apiProgramsMap.get(lowerEmail);

          if (apiProgramInfo) {
            console.log(
              `Found API program info for ${contact.email}: ${apiProgramInfo.name}`
            );

            return {
              email: contact.email,

              name: apiProgramInfo.name,

              title: contact.title || "Organization",

              phone: apiProgramInfo.phone || contact.phone || "",

              url: apiProgramInfo.website,

              source: "Learn to Skate USA API",
            };
          } // If we couldn't find program info in our mapping, // we need to try other methods to extract program info // Method 1: Look in email context to find related HTML

          const context = contact.method || contact.source || "";

          let extractedName = "";

          let extractedWebsite = ""; // Try to find program name in context

          const nameInContext = context.match(
            /class=["']listing-heading[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
          );

          if (nameInContext) {
            extractedName = nameInContext[1].trim();
          } // Try to find website in context

          const websiteInContext = context.match(
            /href=["']([^"']+)["'][^>]*target=["']_blank["']/i
          );

          if (websiteInContext) {
            extractedWebsite = websiteInContext[1].trim();
          }

          if (extractedName || extractedWebsite) {
            return {
              email: contact.email,

              name: extractedName || "Unknown Program",

              title: contact.title || "Organization",

              phone: contact.phone || "",

              url: extractedWebsite,

              source: "Learn to Skate USA API",
            };
          } // Method 2: Extract from email domain as last resort

          const emailDomain = contact.email.split("@")[1] || "";

          let domainBasedName = "";

          if (
            emailDomain &&
            !emailDomain.includes("gmail.com") &&
            !emailDomain.includes("hotmail.com")
          ) {
            // Transform domain like "cityoflaramie.org" into "City of Laramie"

            domainBasedName = emailDomain

              .split(".")[0]
              .replace(/([A-Z])/g, " $1") // Add spaces before capital letters

              .replace(/([a-z])([A-Z])/g, "$1 $2") // Add spaces between camelCase

              .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter

              .replace(/of|and/, (match) => match.toLowerCase()); // Common words lowercase
          }

          return {
            email: contact.email,

            name: domainBasedName || contact.name || "Unknown Program",

            title: contact.title || "Organization",

            phone: contact.phone || "",

            url: emailDomain ? `https://www.${emailDomain}` : "",

            source: "Learn to Skate USA API",
          };
        }
      ); // Create program information for raw display

      const formattedPrograms = enhancedContacts.map((contact) => ({
        OrganizationName: contact.name,

        OrganizationEmail: contact.email,

        OrganizationPhoneNumber: contact.phone || "",

        Website: contact.url || "",
      }));

      return NextResponse.json({
        success: true,

        emails: enhancedContacts,

        programs: formattedPrograms, // Include the program data for raw display

        message: `Found ${result.contacts.length} contacts via browser automation`,
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

/**
 * API route specifically designed to handle the Learn to Skate USA website
 * Uses browser automation to handle cases where direct API calls are blocked
 */

import { FormField, WebScraper } from "@/lib/scraper";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { state, zipCode, programName } = await request.json();

    // Validate input
    if (!state && !zipCode) {
      return NextResponse.json(
        { error: "Either state or zip code is required" },
        { status: 400 }
      );
    }

    console.log(
      `Starting browser-based scraping for state=${state}, zipCode=${zipCode}`
    );

    // Create a form fields array with proper typing
    const formFields: FormField[] = [
      // State dropdown - always included
      {
        selector: "#mapStateId",
        value: state,
        type: "select",
      },

      // Zip radius - always included
      {
        selector: "#zipSelect",
        value: "100", // 100 mile radius (maximum)
        type: "select",
      },
    ];

    // Conditionally add zip code field if provided
    if (zipCode) {
      formFields.push({
        selector: "#mapZipCode",
        value: zipCode,
        type: "text",
      });
    }

    // Conditionally add program name field if provided
    if (programName) {
      formFields.push({
        selector: "#mapFacilityName",
        value: programName,
        type: "text",
      });
    }

    // Create a scraper instance with form interaction enabled
    const scraper = new WebScraper({
      // Required for interactive websites
      useHeadless: true,

      // Configure form interaction specifically for Learn to Skate USA
      formInteraction: {
        enabled: true,
        fields: formFields,

        // Submit button selector
        submitButtonSelector: "#searchProgramsSubmitBtn",

        // Wait for results or a sufficient time
        waitTime: 5000, // 5 seconds
      },

      // Enable following links for more contact info
      followLinks: true,
      maxDepth: 2,
    });

    try {
      // Run the scraper on the Learn to Skate USA website
      const result = await scraper.scrapeWebsite(
        "https://www.learntoskateusa.com/findaskatingprogram/#mapListings"
      );

      // Log the results for debugging
      console.log(
        `Browser-based scraping completed. Found ${result.contacts.length} contacts.`
      );

      // Create a more structured response
      const enhancedContacts = result.contacts.map((contact) => ({
        email: contact.email,
        name: contact.name || "",
        title: contact.title || "Organization",
        phone: contact.phone || "",
        website: contact.source || "",
        address: "",
      }));

      return NextResponse.json({
        success: true,
        emails: enhancedContacts,
        rawScrapeResult: result,
        message: `Found ${result.contacts.length} contacts via browser automation`,
      });
    } catch (error) {
      console.error("Error during browser-based scraping:", error);

      // Return a more detailed error
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

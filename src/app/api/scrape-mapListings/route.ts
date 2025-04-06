/**
 * API route specifically designed to handle the Learn to Skate USA website
 * This provides a specialized endpoint that directly handles mapListings API responses
 */

import { Program } from "@/lib/scraper/types";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

/**
 * Direct API handler for Learn to Skate site
 */
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

    // API endpoint for Learn to Skate USA's program search
    // Previous endpoint returned 404, trying the correct URL based on network analysis
    const endpoint =
      "https://www.learntoskateusa.com/findaskatingprogram/searchmap";

    // Define request parameter types for better type safety
    interface SearchParams {
      StateId: string;
      ZipCode: string;
      Name: string;
      ZipRadius: string;
    }

    // Prepare request parameters based on what the user provided
    const params: SearchParams = {
      StateId: state || "",
      ZipCode: zipCode || "",
      Name: programName || "",
      ZipRadius: "100", // Use maximum search radius for best results
    };

    console.log("Submitting direct API request with params:", params);

    // Make the direct API request to Learn to Skate USA
    // Switching from POST to GET with query parameters
    const response = await axios.get(endpoint, {
      params: params,
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        Referer: "https://www.learntoskateusa.com/findaskatingprogram/",
      },
    });

    // Log the raw response for debugging
    console.log(
      "Raw API response:",
      JSON.stringify(response.data).substring(0, 500) + "..."
    );

    // Extract the program data from the response
    const responseData = response.data;

    // More flexible handling of different response structures
    let programs: Program[] = [];

    // Case 1: Standard response format with programs array
    if (responseData.programs && Array.isArray(responseData.programs)) {
      programs = responseData.programs;
      console.log(`Found ${programs.length} programs in 'programs' array`);
    }
    // Case 2: Response with data property containing programs
    else if (responseData.data && Array.isArray(responseData.data)) {
      programs = responseData.data;
      console.log(`Found ${programs.length} programs in 'data' array`);
    }
    // Case 3: Response is a direct array of programs
    else if (Array.isArray(responseData)) {
      programs = responseData;
      console.log(`Found ${programs.length} programs in direct array`);
    }
    // Case 4: Response contains results property
    else if (responseData.results && Array.isArray(responseData.results)) {
      programs = responseData.results;
      console.log(`Found ${programs.length} programs in 'results' array`);
    }

    // If we found programs, extract contact information
    if (programs.length > 0) {
      // Log a sample program to see its structure
      console.log(
        "Sample program structure:",
        JSON.stringify(programs[0]).substring(0, 300) + "..."
      );

      // Extract email addresses from the programs with more flexible field mapping
      const emails = programs
        .filter(
          (program) =>
            program.OrganizationEmail || program.email || program.Email
        )
        .map((program) => ({
          email: program.OrganizationEmail || program.email || program.Email,
          name: program.OrganizationName || program.name || program.Name || "",
          title: "Organization",
          phone:
            program.OrganizationPhoneNumber ||
            program.phone ||
            program.Phone ||
            "",
          website: program.Website || program.website || program.url || "",
          address: program.StreetOne
            ? `${program.StreetOne || ""}, ${program.City || ""}, ${
                program.StateCode || ""
              } ${program.PostalCode || ""}`
            : program.address || "",
        }));

      console.log(`Extracted ${emails.length} email contacts`);

      const results = {
        programs: programs,
        emails: emails,
      };

      return NextResponse.json(results);
    } else {
      console.log("No programs found in API response");

      // Return the raw data for debugging
      return NextResponse.json({
        message: "No programs found or unexpected API response format",
        rawData: responseData,
        responseStatus: response.status,
        responseUrl: response.config?.url,
      });
    }
  } catch (error) {
    console.error("Error making direct API request:", error);
    return NextResponse.json(
      { error: "Failed to fetch data from Learn to Skate USA API" },
      { status: 500 }
    );
  }
}

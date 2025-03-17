import { NextRequest, NextResponse } from "next/server";
import { WebScraper } from "@/lib/scraper/scraper";
import {
  generateExcelFile,
  generateCsvFile,
  generateFilename,
} from "@/lib/scraper/exportUtils";
import { ScrapingOptions } from "@/lib/scraper/types";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { url, options = {} } = body;

    // Validate URL
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Create scraper instance with options
    const scraper = new WebScraper(options as ScrapingOptions);

    // Scrape the website
    const result = await scraper.scrapeWebsite(url);

    // Return the result
    return NextResponse.json(result);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get URL from query parameters
    const url = request.nextUrl.searchParams.get("url");
    const format = request.nextUrl.searchParams.get("format") || "json";
    const followLinks =
      request.nextUrl.searchParams.get("followLinks") === "true";
    const useHeadless =
      request.nextUrl.searchParams.get("useHeadless") === "true";

    // Validate URL
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Create scraper instance with options
    const scraper = new WebScraper({
      followLinks,
      useHeadless,
      maxDepth: followLinks ? 2 : 1,
    });

    // Scrape the website
    const result = await scraper.scrapeWebsite(url);

    // Return the result in the requested format
    if (format === "xlsx") {
      const buffer = await generateExcelFile(result);
      const filename = generateFilename(url, "xlsx");

      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } else if (format === "csv") {
      const buffer = generateCsvFile(result);
      const filename = generateFilename(url, "csv");

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } else {
      // Default to JSON
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

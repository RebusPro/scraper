import { NextRequest, NextResponse } from "next/server";
import {
  generateExcelFile,
  generateCsvFile,
  generateFilename,
} from "@/lib/scraper/exportUtils";
import { ScrapingResult } from "@/lib/scraper/types";

/**
 * Export API endpoint - generates XLSX or CSV file from provided scraping results
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { result, format = "xlsx" } = body;

    // Validate request
    if (!result || !result.contacts) {
      return NextResponse.json(
        { error: "Invalid scraping result data" },
        { status: 400 }
      );
    }

    // Generate the appropriate file format
    let buffer;
    let contentType;
    let filename;

    if (format === "xlsx") {
      buffer = await generateExcelFile(result as ScrapingResult);
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      filename = generateFilename(result.url, "xlsx");
    } else if (format === "csv") {
      buffer = generateCsvFile(result as ScrapingResult);
      contentType = "text/csv";
      filename = generateFilename(result.url, "csv");
    } else {
      return NextResponse.json(
        { error: "Unsupported format. Use 'xlsx' or 'csv'." },
        { status: 400 }
      );
    }

    // Return the file
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Export failed",
      },
      { status: 500 }
    );
  }
}

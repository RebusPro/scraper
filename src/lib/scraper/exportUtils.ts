/**
 * Utilities for exporting scraped data to different formats
 */
import * as XLSX from "xlsx";
import { ScrapedContact } from "./types";

/**
 * Export contacts to Excel (XLSX) format
 */
export async function exportToExcel(
  contacts: ScrapedContact[],
  filename: string
): Promise<void> {
  try {
    // Format data for Excel export
    const formattedData = contacts.map((contact) => ({
      Email: contact.email,
      Name: contact.name || "",
      "Title/Position": contact.title || "",
      Phone: contact.phone || "",
      "Source Website": contact.source || "",
      "Scrape Date": contact.scrapeTime || new Date().toLocaleString(),
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Column widths
    const columnWidths = [
      { wch: 35 }, // Email
      { wch: 30 }, // Name
      { wch: 30 }, // Title
      { wch: 20 }, // Phone
      { wch: 40 }, // Source
      { wch: 20 }, // Date
    ];

    worksheet["!cols"] = columnWidths;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");

    // Generate xlsx file
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    throw new Error("Failed to export data to Excel");
  }
}

/**
 * Export contacts to CSV format
 */
export function exportToCSV(
  contacts: ScrapedContact[],
  filename: string
): void {
  try {
    // Format data for CSV
    const formattedData = contacts.map((contact) => ({
      Email: contact.email,
      Name: contact.name || "",
      "Title/Position": contact.title || "",
      Phone: contact.phone || "",
      "Source Website": contact.source || "",
      "Scrape Date": contact.scrapeTime || new Date().toLocaleString(),
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Create CSV string
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

    // Create download link
    const blob = new Blob([csvOutput], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting to CSV:", error);
    throw new Error("Failed to export data to CSV");
  }
}

/**
 * Generate Excel file for API endpoint (returns buffer instead of writing to file)
 */
export async function generateExcelFile(result: {
  contacts: ScrapedContact[];
  url?: string;
}): Promise<Buffer> {
  try {
    // Format data for Excel export
    const formattedData = result.contacts.map((contact) => ({
      Email: contact.email,
      Name: contact.name || "",
      "Title/Position": contact.title || "",
      Phone: contact.phone || "",
      "Source Website": contact.source || "",
      "Scrape Date": contact.scrapeTime || new Date().toLocaleString(),
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Column widths
    const columnWidths = [
      { wch: 35 }, // Email
      { wch: 30 }, // Name
      { wch: 30 }, // Title
      { wch: 20 }, // Phone
      { wch: 40 }, // Source
      { wch: 20 }, // Date
    ];

    worksheet["!cols"] = columnWidths;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");

    // Return buffer instead of writing to file
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  } catch (error) {
    console.error("Error generating Excel file:", error);
    throw new Error("Failed to generate Excel file");
  }
}

/**
 * Generate CSV file for API endpoint (returns buffer instead of writing to file)
 */
export function generateCsvFile(result: {
  contacts: ScrapedContact[];
  url?: string;
}): Buffer {
  try {
    // Format data for CSV
    const formattedData = result.contacts.map((contact) => ({
      Email: contact.email,
      Name: contact.name || "",
      "Title/Position": contact.title || "",
      Phone: contact.phone || "",
      "Source Website": contact.source || "",
      "Scrape Date": contact.scrapeTime || new Date().toLocaleString(),
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Convert to CSV and return as buffer
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    return Buffer.from(csvOutput);
  } catch (error) {
    console.error("Error generating CSV file:", error);
    throw new Error("Failed to generate CSV file");
  }
}

/**
 * Generate a filename for exports based on the URL and format
 */
export function generateFilename(
  url: string = "",
  format: string = "xlsx"
): string {
  // Parse domain from URL
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/\./g, "_");
  } catch {
    domain = "scrape_results";
  }

  // Add timestamp
  const timestamp = new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .split(".")[0];
  return `${domain}_${timestamp}.${format}`;
}

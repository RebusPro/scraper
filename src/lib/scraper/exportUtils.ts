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
      Website: contact.url || "",
      Name: contact.name || "",
      // "Title/Position": contact.title || "",
      Phone: contact.phone || "",
      // "Source Website": contact.source || "",
      "Scrape Date": contact.scrapeTime || new Date().toLocaleString(),
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Column widths
    const columnWidths = [
      { wch: 35 }, // Email
      { wch: 30 }, // Name
      { wch: 30 }, // Title
      { wch: 40 }, // Website
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
      Website: contact.url || "",
      Name: contact.name || "",
      // "Title/Position": contact.title || "",
      Phone: contact.phone || "",
      // "Source Website": contact.source || "",
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

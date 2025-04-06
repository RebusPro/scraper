/**
 * Utilities for exporting scraped data to different formats
 */
import * as XLSX from "xlsx";

/**
 * Export contacts to Excel (XLSX) format
 */
export async function exportToExcel(
  dataToExport: Array<
    Record<string, string | number | boolean | null | undefined>
  >,
  filename: string
): Promise<void> {
  try {
    if (!dataToExport || dataToExport.length === 0) {
      console.warn("No data provided for Excel export.");
      return;
    }

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Auto-calculate column widths (basic)
    const headers = Object.keys(dataToExport[0]);
    const colWidths = headers.map((header) => {
      const maxLength = Math.max(
        header.length,
        ...dataToExport.map((row) => String(row[header] ?? "").length)
      );
      return { wch: Math.min(50, maxLength + 2) }; // Limit max width
    });
    worksheet["!cols"] = colWidths;

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
  dataToExport: Array<
    Record<string, string | number | boolean | null | undefined>
  >,
  filename: string
): void {
  try {
    if (!dataToExport || dataToExport.length === 0) {
      console.warn("No data provided for CSV export.");
      return;
    }

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

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
  contacts: Array<Record<string, string | number | boolean | null | undefined>>;
  url?: string;
}): Promise<Buffer> {
  try {
    if (!result.contacts || result.contacts.length === 0) {
      throw new Error("No contact data provided for Excel generation.");
    }

    // Create worksheet directly from the data
    const worksheet = XLSX.utils.json_to_sheet(result.contacts);

    // Auto-calculate column widths (basic)
    const headers = Object.keys(result.contacts[0]);
    const colWidths = headers.map((header) => {
      const maxLength = Math.max(
        header.length,
        ...result.contacts.map((row) => String(row[header] ?? "").length)
      );
      return { wch: Math.min(50, maxLength + 2) }; // Limit max width
    });
    worksheet["!cols"] = colWidths;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");

    // Return buffer
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  } catch (error) {
    console.error("Error generating Excel file buffer:", error);
    throw new Error("Failed to generate Excel file buffer");
  }
}

/**
 * Generate CSV file for API endpoint (returns buffer instead of writing to file)
 */
export function generateCsvFile(result: {
  contacts: Array<Record<string, string | number | boolean | null | undefined>>;
  url?: string;
}): Buffer {
  try {
    if (!result.contacts || result.contacts.length === 0) {
      throw new Error("No contact data provided for CSV generation.");
    }

    // Create worksheet - header order determined by keys
    const worksheet = XLSX.utils.json_to_sheet(result.contacts);

    // Convert to CSV and return as buffer
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    return Buffer.from(csvOutput);
  } catch (error) {
    console.error("Error generating CSV file buffer:", error);
    throw new Error("Failed to generate CSV file buffer");
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

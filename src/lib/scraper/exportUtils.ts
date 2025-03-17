/**
 * Utilities for exporting scraped data to different formats ...
 */
import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";
import { ScrapingResult } from "./types";
import { Buffer } from "buffer";

/**
 * Generate Excel file from scraping results
 */
export async function generateExcelFile(
  result: ScrapingResult
): Promise<Buffer> {
  // Using any to avoid type issues with Buffer
  // Create a new workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Email Harvester";
  workbook.created = new Date();

  // Add a worksheet
  const worksheet = workbook.addWorksheet("Contacts");

  // Define columns
  worksheet.columns = [
    { header: "Email", key: "email", width: 30 },
    { header: "Name", key: "name", width: 25 },
    { header: "Title/Position", key: "title", width: 25 },
    { header: "Phone", key: "phone", width: 20 },
    { header: "Source URL", key: "source", width: 40 },
  ];

  // Add header row styling
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Add data rows
  result.contacts.forEach((contact) => {
    worksheet.addRow({
      email: contact.email,
      name: contact.name || "",
      title: contact.title || "",
      phone: contact.phone || "",
      source: contact.source || result.url,
    });
  });

  // Add summary information
  worksheet.addRow({}); // Empty row
  worksheet.addRow({
    email: `Total Contacts: ${result.contacts.length}`,
    name: `With Names: ${result.contacts.filter((c) => c.name).length}`,
    title: `Scraped URL: ${result.url}`,
    phone: `Date: ${new Date(result.timestamp).toLocaleString()}`,
  });

  // Auto-filter the header row
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 5 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

/**
 * Generate CSV file from scraping results
 */
export function generateCsvFile(result: ScrapingResult): Buffer {
  // Using any to avoid type issues with Buffer
  // Prepare data for CSV
  const data = result.contacts.map((contact) => ({
    Email: contact.email,
    Name: contact.name || "",
    Title: contact.title || "",
    Phone: contact.phone || "",
    "Source URL": contact.source || result.url,
  }));

  // Generate CSV string
  const csvString = stringify(data, {
    header: true,
    columns: ["Email", "Name", "Title", "Phone", "Source URL"],
  });

  // Convert to buffer
  return Buffer.from(csvString);
}

/**
 * Generate a filename for the exported data
 */
export function generateFilename(url: string, format: "xlsx" | "csv"): string {
  // Extract domain from URL
  let domain = url.replace(/^https?:\/\//, "");
  domain = domain.split("/")[0];

  // Clean up domain for filename
  domain = domain.replace(/[^a-zA-Z0-9]/g, "_");

  // Add date
  const date = new Date().toISOString().split("T")[0];

  return `contacts_${domain}_${date}.${format}`;
}

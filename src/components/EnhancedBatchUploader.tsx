/**
 * Enhanced component for uploading Excel/CSV files containing website URLs
 * with improved user experience and sample template
 */
"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import Image from "next/image";

interface EnhancedBatchUploaderProps {
  onBatchScrape: (urls: string[]) => void;
  isLoading: boolean;
}

// Define types for XLSX data
interface SheetRow {
  [key: string]: string | number | boolean | null | undefined;
}

export default function EnhancedBatchUploader({
  onBatchScrape,
  isLoading,
}: EnhancedBatchUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [textInput, setTextInput] = useState<string>("");
  const [showExcelHelp, setShowExcelHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle dropped file
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Handle file input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  // Handle file button click
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Process the file and extract URLs
  const handleFile = async (file: File) => {
    setFile(file);
    setParseError(null);

    try {
      // Check file type
      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      const isCSV = file.name.endsWith(".csv");

      if (!isExcel && !isCSV) {
        setParseError(
          "Please upload an Excel (.xlsx, .xls) or CSV (.csv) file."
        );
        return;
      }

      const extractedUrls: string[] = [];

      if (isExcel) {
        // Read Excel file
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);

        // Assume URLs are in the first sheet, look for columns with URLs
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<SheetRow>(firstSheet);

        // Look for URL-related columns
        jsonData.forEach((row: SheetRow) => {
          for (const key in row) {
            // Look for columns that might contain URLs (website, url, link, etc.)
            const lowerKey = key.toLowerCase();
            if (
              lowerKey.includes("website") ||
              lowerKey.includes("url") ||
              lowerKey.includes("link") ||
              lowerKey.includes("site")
            ) {
              const value = String(row[key]).trim();
              if (value && isValidUrl(value)) {
                extractedUrls.push(normalizeUrl(value));
              }
            }
          }
        });

        // If we didn't find any URL columns, just check all columns for values that look like URLs
        if (extractedUrls.length === 0) {
          jsonData.forEach((row: SheetRow) => {
            for (const key in row) {
              const value = String(row[key]).trim();
              if (value && isValidUrl(value)) {
                extractedUrls.push(normalizeUrl(value));
              }
            }
          });
        }
      } else if (isCSV) {
        // Read CSV file
        const text = await file.text();
        const rows = text.split("\n");

        rows.forEach((row) => {
          const columns = row.split(",");
          columns.forEach((cell) => {
            const value = cell.trim().replace(/["']/g, ""); // Remove quotes
            if (value && isValidUrl(value)) {
              extractedUrls.push(normalizeUrl(value));
            }
          });
        });
      }

      // Filter duplicates and set URLs
      const uniqueUrls = [...new Set(extractedUrls)];
      setUrls(uniqueUrls);

      if (uniqueUrls.length === 0) {
        setParseError(
          "No valid URLs found in the file. Please check your file format. Make sure your Excel file contains a column with website URLs."
        );
      }
    } catch (error) {
      console.error("Error processing file:", error);
      setParseError("Error processing file. Please check the file format.");
    }
  };

  // Process text input for URLs
  const handleTextInputProcess = () => {
    setParseError(null);

    try {
      if (!textInput.trim()) {
        setParseError("Please enter at least one URL.");
        return;
      }

      // Try different patterns to extract URLs:
      // 1. Split by newlines (most common format)
      // 2. Split by commas
      // 3. Split by spaces
      let candidates: string[] = [];

      // First try newlines
      candidates = textInput.split(/\r?\n/).filter((line) => line.trim());

      // If we only have one candidate, try commas (common in CSV paste)
      if (candidates.length === 1) {
        candidates = textInput.split(",").filter((item) => item.trim());
      }

      // If we still only have one candidate, try spaces (rare but possible)
      if (candidates.length === 1) {
        candidates = textInput.split(/\s+/).filter((item) => item.trim());
      }

      // Process candidates to valid URLs
      const extractedUrls: string[] = [];

      candidates.forEach((candidate) => {
        // Clean up the candidate
        const cleaned = candidate.trim().replace(/["']/g, "");

        if (cleaned && isValidUrl(cleaned)) {
          extractedUrls.push(normalizeUrl(cleaned));
        }
      });

      // Filter duplicates and set URLs
      const uniqueUrls = [...new Set(extractedUrls)];
      setUrls(uniqueUrls);

      if (uniqueUrls.length === 0) {
        setParseError(
          "No valid URLs found. URLs must include domain names (e.g., example.com)."
        );
      }
    } catch (error) {
      console.error("Error processing text input:", error);
      setParseError("Error processing text input. Please check the format.");
    }
  };

  // Check if a string is a valid URL
  const isValidUrl = (string: string) => {
    try {
      // Basic URL validation
      return (
        string.includes(".") &&
        (string.startsWith("http://") ||
          string.startsWith("https://") ||
          string.startsWith("www.") ||
          /^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}/.test(string)) // domain-like pattern
      );
    } catch (error) {
      console.error("Error validating URL:", error);
      return false;
    }
  };

  // Normalize URL format
  const normalizeUrl = (url: string) => {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `https://${url.startsWith("www.") ? "" : "www."}${url}`;
    }
    return url;
  };

  // Start the batch scraping process
  const handleStartScraping = () => {
    if (urls.length > 0) {
      onBatchScrape(urls);
    }
  };

  // Toggle input mode
  const toggleInputMode = (mode: "file" | "text") => {
    setInputMode(mode);
    // Clear previous data when switching modes
    setUrls([]);
    setFile(null);
    setTextInput("");
    setParseError(null);
  };

  // Create sample Excel file
  const createSampleExcel = () => {
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();

    // Sample data with coaching websites
    const sampleData = [
      {
        website_url: "https://hockey.travelsports.com/coaches",
        organization: "Travel Sports Hockey",
        notes: "Hockey coaches directory",
      },
      {
        website_url: "https://www.icecoachingdirectory.com",
        organization: "Ice Coaching Directory",
        notes: "Skating coaches",
      },
      {
        website_url: "https://www.skatecoach.org/staff",
        organization: "Skate Coach Organization",
        notes: "Figure skating coaches",
      },
    ];

    // Convert to worksheet
    const ws = XLSX.utils.json_to_sheet(sampleData);

    // Add to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Websites");

    // Generate and download the file
    XLSX.writeFile(wb, "coaching-websites-template.xlsx");
  };

  return (
    <div className="space-y-4">
      {/* Input mode switch */}
      <div className="flex border rounded-md overflow-hidden divide-x">
        <button
          type="button"
          onClick={() => toggleInputMode("file")}
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            inputMode === "file"
              ? "bg-indigo-600 text-white"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          Upload Excel/CSV
        </button>
        <button
          type="button"
          onClick={() => toggleInputMode("text")}
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            inputMode === "text"
              ? "bg-indigo-600 text-white"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          Paste URLs
        </button>
      </div>

      {/* File upload area */}
      {inputMode === "file" && (
        <div className="space-y-4">
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center ${
              dragActive
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-gray-300 dark:border-gray-700"
            } transition-colors duration-200`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleChange}
              className="hidden"
            />

            <div className="space-y-2">
              <div className="mx-auto h-12 w-12">
                <Image
                  src="/file.svg"
                  alt="Upload file"
                  width={48}
                  height={48}
                  className="text-gray-400 dark:text-gray-500"
                />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Drag & drop your spreadsheet or click to browse
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Accepts Excel (.xlsx, .xls) or CSV (.csv) files with website
                URLs
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleButtonClick}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Browse Files
                </button>
                <button
                  type="button"
                  onClick={createSampleExcel}
                  className="inline-flex items-center px-4 py-2 border border-indigo-300 dark:border-indigo-800 rounded-md shadow-sm text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Download Template
                </button>
              </div>
            </div>
          </div>

          {/* Excel help section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-md p-4">
            <div className="flex justify-between items-start">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-blue-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Excel Format Tips
                  </h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-400">
                    <p>
                      Your Excel file should include a column with website URLs.
                      Our system will automatically detect columns with headers
                      like &quot;Website&quot;, &quot;URL&quot;, or
                      &quot;Link&quot;.
                    </p>
                    <button
                      onClick={() => setShowExcelHelp(!showExcelHelp)}
                      className="mt-1 text-blue-600 dark:text-blue-300 underline text-xs font-medium"
                    >
                      {showExcelHelp ? "Hide examples" : "Show examples"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Collapsible example section */}
            {showExcelHelp && (
              <div className="mt-3 border-t border-blue-200 dark:border-blue-800 pt-3">
                <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
                  Example Excel format:
                </p>
                <div className="overflow-x-auto rounded-md border border-blue-200 dark:border-blue-800">
                  <table className="min-w-full divide-y divide-blue-200 dark:divide-blue-800">
                    <thead className="bg-blue-100 dark:bg-blue-900/40">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                          Website URL
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                          Organization
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-blue-900/20 divide-y divide-blue-200 dark:divide-blue-800">
                      <tr>
                        <td className="px-4 py-2 text-xs text-blue-800 dark:text-blue-300">
                          https://hockey.travelsports.com/coaches
                        </td>
                        <td className="px-4 py-2 text-xs text-blue-800 dark:text-blue-300">
                          Travel Sports Hockey
                        </td>
                        <td className="px-4 py-2 text-xs text-blue-800 dark:text-blue-300">
                          Hockey coaches directory
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-xs text-blue-800 dark:text-blue-300">
                          https://www.icecoachingdirectory.com
                        </td>
                        <td className="px-4 py-2 text-xs text-blue-800 dark:text-blue-300">
                          Ice Coaching Directory
                        </td>
                        <td className="px-4 py-2 text-xs text-blue-800 dark:text-blue-300">
                          Skating coaches
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Text input area */}
      {inputMode === "text" && (
        <div className="space-y-3">
          <div className="border rounded-lg p-4 bg-white dark:bg-gray-800">
            <label
              htmlFor="urls-input"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Paste URLs (one per line or comma-separated)
            </label>
            <textarea
              id="urls-input"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
              placeholder="https://hockey.travelsports.com/coaches&#10;https://www.icecoachingdirectory.com&#10;https://www.skatecoach.org/staff"
            />
            <div className="mt-3">
              <button
                type="button"
                onClick={handleTextInputProcess}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={!textInput.trim()}
              >
                Process URLs
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Enter each URL on a new line or separate them with commas. URLs
              will be automatically normalized and our system handles sites with
              dynamic content.
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {parseError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-md p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{parseError}</p>
        </div>
      )}

      {/* Extracted URLs */}
      {urls.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100">
              {urls.length} URLs{" "}
              {file ? `extracted from ${file.name}` : "processed"}
            </h3>
            <button
              type="button"
              onClick={handleStartScraping}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </>
              ) : (
                "Start Scraping"
              )}
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2 text-sm">
            <ul className="list-disc list-inside">
              {urls.map((url, index) => (
                <li
                  key={index}
                  className="text-gray-700 dark:text-gray-300 truncate"
                >
                  {url}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

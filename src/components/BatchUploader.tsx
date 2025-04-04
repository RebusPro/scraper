/**
 * Component for uploading Excel/CSV files containing website URLs
 */
"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";

interface BatchUploaderProps {
  onBatchScrape: (urls: string[]) => void;
  isLoading: boolean;
}

// Define types for XLSX data
interface SheetRow {
  [key: string]: string | number | boolean | null | undefined;
}

export default function BatchUploader({
  onBatchScrape,
  isLoading,
}: BatchUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
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
          "No valid URLs found in the file. Please check your file format."
        );
      }
    } catch (error) {
      console.error("Error processing file:", error);
      setParseError("Error processing file. Please check the file format.");
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
          string.startsWith("www."))
      );
    } catch {
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

  return (
    <div className="space-y-4">
      {/* File drag & drop area */}
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
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Drag & drop your spreadsheet or click to browse
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Accepts Excel (.xlsx, .xls) or CSV (.csv) files
          </p>
          <button
            type="button"
            onClick={handleButtonClick}
            className="mt-2 inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Browse Files
          </button>
        </div>
      </div>

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
              {urls.length} URLs extracted from {file?.name}
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

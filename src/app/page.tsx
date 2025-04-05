/**
 * Main application page - Email Scraper for Marketing
 * Enhanced for non-technical managers with improved user experience
 */
"use client";

import { useState } from "react";
import { ScrapingResult } from "@/lib/scraper/types";
import EnhancedBatchUploader from "@/components/EnhancedBatchUploader";
import ResultsDisplay from "@/components/ResultsDisplay";
import ScrapeProgressDisplay from "@/components/ScrapeProgressDisplay";
import SimplifiedScrapeSettingsSelector from "@/components/SimplifiedScrapeSettingsSelector";
import { exportToCSV, exportToExcel } from "@/lib/scraper/exportUtils";

export default function Home() {
  const [results, setResults] = useState<ScrapingResult[]>([]);
  const [currentResult, setCurrentResult] = useState<ScrapingResult | null>(
    null
  );
  const [isScrapingBatch, setIsScrapingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [isDownloading, setIsDownloading] = useState(false);
  const [errors, setErrors] = useState<{ url: string; error: string }[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scrapeSettings, setScrapeSettings] = useState({
    mode: "standard" as "standard" | "aggressive" | "gentle",
    maxDepth: 2,
    followLinks: true,
    includePhoneNumbers: true,
    browserType: "chromium" as "chromium" | "firefox",
    timeout: 30000,
  });
  const [showFeatureInfo, setShowFeatureInfo] = useState(false);

  // Handle batch scraping from Excel/CSV file
  const handleBatchScrape = async (urlList: string[]) => {
    if (!urlList || urlList.length === 0) return;

    // Make sure we have an array even for a single URL
    const urls = Array.isArray(urlList) ? urlList : [urlList];

    setIsScrapingBatch(true);
    setBatchProgress({ current: 0, total: urls.length });
    setResults([]);
    setErrors([]);

    try {
      // Send all URLs to the API at once
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls,
          settings: scrapeSettings,
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      // Store the session ID for cancellation
      const newSessionId = response.headers.get("X-Scraping-Session-Id");
      if (newSessionId) {
        setSessionId(newSessionId);
      }

      // Process the response as a stream for real-time updates
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      // Buffer to accumulate data across chunks
      let buffer = "";

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk and add to buffer
        buffer += new TextDecoder().decode(value);

        try {
          // Try to parse the JSON from the buffer
          const result = JSON.parse(buffer);
          // If successful, reset the buffer
          buffer = "";

          // Update the state with the results
          if (result.results && result.results.length > 0) {
            setResults(result.results);
            setCurrentResult(result.results[0]);
          }

          // Update errors
          if (result.errors && result.errors.length > 0) {
            setErrors(result.errors);
          }

          // Update progress
          setBatchProgress({
            current: result.processed || 0,
            total: result.total || urls.length,
          });

          // Mark as done
          if (result.done) {
            setIsScrapingBatch(false);
            break;
          }
        } catch {
          // If parsing fails, we might need more data
          // But if the buffer gets too large, something's wrong
          if (buffer.length > 50000) {
            console.error("Buffer too large, resetting");
            buffer = "";
          }
        }
      }
    } catch (error) {
      console.error("Error in batch scrape:", error);
      setIsScrapingBatch(false);

      // Cancel any active scraping
      if (sessionId) {
        try {
          await fetch(`/api/scrape?sessionId=${sessionId}`, {
            method: "DELETE",
          });
        } catch (cancelError) {
          console.error("Error cancelling scrape:", cancelError);
        }
      }

      // Create a generic error result
      const batchResults: ScrapingResult[] = urls.map((url) => ({
        url,
        contacts: [],
        timestamp: new Date().toISOString(),
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      }));

      setResults(batchResults);
      setErrors(
        urls.map((url) => ({
          url,
          error: error instanceof Error ? error.message : "Unknown error",
        }))
      );
    }
  };

  // Handle downloading results in Excel or CSV format
  const handleDownload = async (format: "xlsx" | "csv") => {
    if (!results.length) return;

    setIsDownloading(true);
    try {
      const allContacts = results.flatMap((result) =>
        result.contacts && result.contacts.length > 0
          ? result.contacts.map((contact) => ({
              ...contact,
              source: result.url,
              scrapeTime: new Date(result.timestamp).toLocaleString(),
            }))
          : []
      );

      if (format === "xlsx") {
        await exportToExcel(allContacts, "coaching-email-results");
      } else {
        exportToCSV(allContacts, "coaching-email-results");
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Failed to download results. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle cancellation of scraping
  const handleCancelScraping = async () => {
    if (!sessionId) {
      console.error("No session ID available for cancellation");
      setIsScrapingBatch(false);
      return;
    }

    try {
      const response = await fetch(`/api/scrape?sessionId=${sessionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setIsScrapingBatch(false);
      } else {
        const errorText = await response.text();
        console.error("Failed to cancel scraping:", errorText);

        // If we can't cancel, still update the UI
        setIsScrapingBatch(false);
      }
    } catch (error) {
      console.error("Error cancelling scrape:", error);
      // If we can't cancel, still update the UI
      setIsScrapingBatch(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col p-6 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto">
        {/* Header section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Coach Email Finder
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2 max-w-2xl mx-auto">
            Extract real coach emails, names, and positions from websites for
            your marketing campaigns
          </p>

          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <div className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Dynamic Content Support
            </div>
            <div className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Excel Import/Export
            </div>
            <div className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
              Name & Title Extraction
            </div>
            <button
              onClick={() => setShowFeatureInfo(!showFeatureInfo)}
              className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              How it works
            </button>
          </div>
        </div>

        {/* Feature Info section - collapsible */}
        {showFeatureInfo && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 animate-fadeIn">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">
              How Our Coach Email Finder Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-5 w-5 text-indigo-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-800 dark:text-white">
                      Finds Real Emails Only:
                    </span>{" "}
                    No guessing or generating email addresses - we extract only
                    real contact information
                  </p>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-5 w-5 text-indigo-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-800 dark:text-white">
                      Bulk Processing:
                    </span>{" "}
                    Upload an Excel sheet with multiple websites to process them
                    all at once
                  </p>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-5 w-5 text-indigo-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-800 dark:text-white">
                      Contextual Data:
                    </span>{" "}
                    Extracts not just emails but also names and positions/titles
                    when available
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-5 w-5 text-indigo-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-800 dark:text-white">
                      Dynamic Content Handling:
                    </span>{" "}
                    Special processing for sites like hockey.travelsports.com
                    that load content dynamically
                  </p>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-5 w-5 text-indigo-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-800 dark:text-white">
                      Intelligent Navigation:
                    </span>{" "}
                    Automatically explores staff and contact pages to find
                    contact information
                  </p>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-5 w-5 text-indigo-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-800 dark:text-white">
                      Export Options:
                    </span>{" "}
                    Download your results as Excel or CSV for easy import into
                    your marketing tools
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30 rounded-md">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                <strong>Tip:</strong> For best results with sites like
                hockey.travelsports.com, use the &ldquo;Thorough&rdquo; scanning
                mode in the settings below.
              </p>
            </div>
          </div>
        )}

        {/* Main content area */}
        <div className="space-y-6">
          {/* Upload component */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Upload Your Website List
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Upload an Excel file with coaching websites to scrape or paste
                URLs directly. Our system will automatically extract all
                available contact information.
              </p>
            </div>

            {/* Simplified Scrape settings selector */}
            <SimplifiedScrapeSettingsSelector
              onSettingsChange={setScrapeSettings}
            />

            <div className="mt-6">
              <EnhancedBatchUploader
                onBatchScrape={handleBatchScrape}
                isLoading={isScrapingBatch}
              />
            </div>
          </div>

          {/* Progress display (only visible during batch scraping) */}
          {isScrapingBatch && (
            <ScrapeProgressDisplay
              inProgress={isScrapingBatch}
              processedUrls={batchProgress.current}
              totalUrls={batchProgress.total}
              results={results}
              errors={errors}
              remainingUrls={[]}
              onCancel={handleCancelScraping}
            />
          )}

          {/* Results display */}
          {results.length > 0 && (
            <ResultsDisplay
              result={currentResult}
              allResults={results}
              onDownload={handleDownload}
              isDownloading={isDownloading}
            />
          )}
        </div>
      </div>
    </main>
  );
}

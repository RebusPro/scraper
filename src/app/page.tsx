/**
 * Main application page - Email Scraper for Marketing
 * Enhanced for non-technical managers with improved user experience
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ScrapingResult, ScrapedContact } from "@/lib/scraper/types";
import EnhancedBatchUploader from "@/components/EnhancedBatchUploader";
import ResultsDisplay from "@/components/ResultsDisplay";
import ScrapeProgressDisplay from "@/components/ScrapeProgressDisplay";
import SimplifiedScrapeSettingsSelector from "@/components/SimplifiedScrapeSettingsSelector";
import { exportToCSV, exportToExcel } from "@/lib/scraper/exportUtils";

// Interface for the structure returned by the batch-status API
interface BatchStatusResponse {
  message: string;
  progress: {
    processed: number;
    // total might be added later
  };
  results: (Partial<ScrapingResult> & {
    batch_id?: string;
    created_at?: string;
    id?: string;
    error_message?: string | null;
    url: string;
    status: "success" | "error";
    contacts: ScrapedContact[] | null;
  })[];
}

export default function Home() {
  const [results, setResults] = useState<ScrapingResult[]>([]);
  const [isScrapingBatch, setIsScrapingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0 });
  const [totalUrlsInBatch, setTotalUrlsInBatch] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errors, setErrors] = useState<{ url: string; error: string }[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const pollingIntervalId = useRef<NodeJS.Timeout | null>(null);
  const [scrapeSettings, setScrapeSettings] = useState({
    mode: "standard" as "standard" | "aggressive" | "gentle",
    maxDepth: 2,
    followLinks: true,
    includePhoneNumbers: true,
    browserType: "chromium" as "chromium" | "firefox",
    timeout: 90000,
  });
  const [showFeatureInfo, setShowFeatureInfo] = useState(false);

  // --- Function to fetch batch status ---
  // Ensure dependencies are correct for useCallback
  const fetchBatchStatus = useCallback(async () => {
    // Read batchId directly from state within the function execution
    // This avoids stale closure issues if we passed it as an arg
    if (!currentBatchId) {
      console.log("Polling check: No Batch ID, stopping.");
      if (pollingIntervalId.current) clearInterval(pollingIntervalId.current);
      pollingIntervalId.current = null;
      // setIsScrapingBatch(false); // Let useEffect handle this based on ID nullification
      return;
    }

    console.log(`Polling status for Batch ID: ${currentBatchId}`);
    try {
      const response = await fetch(
        `/api/batch-status?batchId=${currentBatchId}`
      );
      if (!response.ok) {
        console.error(`Error fetching batch status: ${response.status}`);
        throw new Error(`API error ${response.status}`);
      }

      const data: BatchStatusResponse = await response.json();

      // ... (logic to update results and errors remains the same) ...
      const updatedResults: ScrapingResult[] = data.results.map((dbResult) => ({
        url: dbResult.url,
        contacts: dbResult.contacts || [],
        timestamp: dbResult.created_at || new Date().toISOString(),
        status: dbResult.status,
        message: dbResult.error_message || undefined,
        stats: {
          totalEmails: dbResult.contacts?.length || 0,
          totalWithNames:
            dbResult.contacts?.filter((c: ScrapedContact) => !!c.name).length ||
            0,
          pagesScraped: 1,
        },
      }));
      setResults(updatedResults);
      const updatedErrors = updatedResults
        .filter((r) => r.status === "error")
        .map((r) => ({ url: r.url, error: r.message || "Unknown error" }));
      setErrors(updatedErrors);

      // Update progress
      const processedCount = data.progress.processed;
      setBatchProgress({ current: processedCount });

      // Check for completion
      // Use a local variable for totalUrlsInBatch to avoid stale state in comparison
      if (totalUrlsInBatch > 0 && processedCount >= totalUrlsInBatch) {
        console.log(
          `Batch ${currentBatchId} completed. Processed ${processedCount}/${totalUrlsInBatch}. Stopping polling.`
        );
        // Reset state, which will trigger useEffect cleanup
        setIsScrapingBatch(false);
        setCurrentBatchId(null);
      } else {
        console.log(
          `Batch ${currentBatchId} progress: ${processedCount}/${totalUrlsInBatch}`
        );
      }
    } catch (error) {
      console.error("Error during polling:", error);
      // Stop polling on error by resetting state
      setIsScrapingBatch(false);
      setCurrentBatchId(null);
      setErrors((prev) => [
        ...prev,
        { url: "Batch Status", error: "Failed to get updates." },
      ]);
    }
  }, [currentBatchId, totalUrlsInBatch]); // Keep dependencies

  // --- Effect to manage polling interval ---
  useEffect(() => {
    if (isScrapingBatch && currentBatchId) {
      // Scraping started and we have a batch ID
      console.log(
        `useEffect: Scraping started for Batch ID ${currentBatchId}. Setting up polling.`
      );

      // Clear any previous interval just in case
      if (pollingIntervalId.current) {
        clearInterval(pollingIntervalId.current);
      }

      // Fetch status immediately when starting
      fetchBatchStatus();

      // Start the interval
      pollingIntervalId.current = setInterval(fetchBatchStatus, 5000);
    } else {
      // Scraping stopped or no batch ID
      console.log(
        `useEffect: Scraping stopped or no Batch ID. Clearing interval.`
      );
      if (pollingIntervalId.current) {
        clearInterval(pollingIntervalId.current);
        pollingIntervalId.current = null;
      }
    }

    // Cleanup function for when the component unmounts or dependencies change
    return () => {
      console.log("useEffect cleanup: Clearing interval.");
      if (pollingIntervalId.current) {
        clearInterval(pollingIntervalId.current);
        pollingIntervalId.current = null;
      }
    };
  }, [isScrapingBatch, currentBatchId, fetchBatchStatus]); // Dependencies control when this effect re-runs

  // Handle batch scraping from Excel/CSV file
  const handleBatchScrape = async (urlList: string[]) => {
    // Prevent duplicate submissions if already scraping
    if (isScrapingBatch) {
      console.log("Scraping already in progress. Ignoring duplicate request.");
      return;
    }

    if (!urlList || urlList.length === 0) return;

    const urls = Array.isArray(urlList) ? urlList : [urlList];

    // --- Reset state for new batch ---
    // Set loading FIRST to prevent double clicks more effectively
    setIsScrapingBatch(true);
    setTotalUrlsInBatch(urls.length);
    setBatchProgress({ current: 0 });
    setResults([]);
    setErrors([]);
    setCurrentBatchId(null); // Clear previous ID before getting new one

    // --- Clear any lingering interval manually just in case ---
    // (Although useEffect should handle this)
    if (pollingIntervalId.current) {
      clearInterval(pollingIntervalId.current);
      pollingIntervalId.current = null;
    }

    try {
      // --- Call the new submit-batch API ---
      const response = await fetch("/api/submit-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls,
          settings: scrapeSettings,
        }),
      });

      if (response.status !== 202) {
        throw new Error(`API returned status ${response.status}`);
      }

      // --- Get Batch ID and trigger useEffect by setting state ---
      const submitResponse = await response.json();
      if (submitResponse.batchId) {
        console.log(
          `Batch submitted successfully. Setting Batch ID: ${submitResponse.batchId}`
        );
        // Setting the batch ID here will trigger the useEffect to start polling
        setCurrentBatchId(submitResponse.batchId);
        // REMOVED interval setup from here
      } else {
        throw new Error("API did not return a batchId");
      }
    } catch (error) {
      console.error("Error in batch scrape submission:", error);
      setIsScrapingBatch(false); // Turn off loading on error
      setCurrentBatchId(null); // Clear batch ID on error
      const batchResults: ScrapingResult[] = urls.map((url) => ({
        url,
        contacts: [],
        timestamp: new Date().toISOString(),
        status: "error",
        message:
          error instanceof Error ? error.message : "Unknown submission error",
      }));
      setResults(batchResults);
      setErrors(
        urls.map((url) => ({
          url,
          error:
            error instanceof Error ? error.message : "Unknown submission error",
        }))
      );
    }
  };

  // Handle downloading results in Excel or CSV format
  const handleDownload = async (format: "xlsx" | "csv") => {
    if (!results.length) return;

    setIsDownloading(true);
    try {
      // Format data specifically for the main page export
      const dataForExport = results.flatMap(
        (result) =>
          result.contacts?.map((contact) => ({
            Email: contact.email || "",
            Name: contact.name || "",
            "Title/Position": contact.title || "",
            "Source Website": contact.source || result.url || "",
            "Scrape Date": new Date(result.timestamp).toLocaleString(),
          })) ?? []
      );

      if (dataForExport.length === 0) {
        alert("No contacts found in the results to export.");
        return;
      }

      if (format === "xlsx") {
        await exportToExcel(dataForExport, "coaching-email-results");
      } else {
        exportToCSV(dataForExport, "coaching-email-results");
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
    console.log("Cancel requested by user.");
    // Resetting state will trigger useEffect cleanup to stop polling
    setIsScrapingBatch(false);
    setCurrentBatchId(null);
    // Optional TODO remains the same
  };

  return (
    <main className="flex min-h-screen flex-col p-6 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto">
        {/* Header section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Email Finder Pro
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2 max-w-2xl mx-auto">
            Extract real emails, names, and positions from any website type
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
              How Our Email Finder Works
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
                    we extract only real contact information
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
                    Special processing for sites that load content dynamically
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
                    Download your results as Excel or CSV
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30 rounded-md">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                <strong>Tip:</strong> For best results, use the
                &ldquo;Thorough&rdquo; scanning mode in the settings below.
              </p>
            </div>
          </div>
        )}

        {/* Main content area */}
        <div className="space-y-6">
          {/* Upload component */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                  Upload Your Website List
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 max-w-lg">
                  Upload an Excel file with websites to scrape or paste URLs
                  directly. The system will automatically extract all available
                  contact information.
                </p>
              </div>
              <Link href="/history" legacyBehavior>
                <a className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus:ring-offset-gray-800 whitespace-nowrap">
                  View History
                </a>
              </Link>
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
              totalUrls={totalUrlsInBatch}
              results={results}
              errors={errors}
              onCancel={handleCancelScraping}
            />
          )}

          {/* Results display */}
          {results.length > 0 && (
            <ResultsDisplay
              result={results[0]}
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

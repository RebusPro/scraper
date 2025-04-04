/**
 * Main application page - Email Scraper for Marketing
 */
"use client";

import { useState } from "react";
import { ScrapingResult } from "@/lib/scraper/types";
import BatchUploader from "@/components/BatchUploader";
import ResultsDisplay from "@/components/ResultsDisplay";
import ScrapeProgressDisplay from "@/components/ScrapeProgressDisplay";
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
        body: JSON.stringify({ urls }),
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

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Process the chunk
        const chunk = new TextDecoder().decode(value);
        const result = JSON.parse(chunk);

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
        await exportToExcel(allContacts, "email-scraping-results");
      } else {
        exportToCSV(allContacts, "email-scraping-results");
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
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Coaching Email Extractor
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Extract coach emails, names, and titles from websites for your
            marketing campaigns
          </p>
        </div>

        {/* Main content area */}
        <div className="space-y-6">
          {/* Upload component */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Upload Your Website List
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Upload an Excel or CSV file with coaching websites to scrape.
                We&apos;ll automatically extract all available contact
                information.
              </p>
            </div>

            <BatchUploader
              onBatchScrape={handleBatchScrape}
              isLoading={isScrapingBatch}
            />
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

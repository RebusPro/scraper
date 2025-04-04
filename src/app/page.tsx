/**
 * Main application page - Email Scraper for Marketing
 */
"use client";

import { useState } from "react";
import { ScrapingOptions, ScrapingResult } from "@/lib/scraper/types";
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

  // Handle batch scraping from Excel/CSV file
  const handleBatchScrape = async (urls: string[]) => {
    setIsScrapingBatch(true);
    setBatchProgress({ current: 0, total: urls.length });
    setResults([]);

    const batchResults: ScrapingResult[] = [];

    for (let i = 0; i < urls.length; i++) {
      try {
        const url = urls[i];
        setBatchProgress({ current: i + 1, total: urls.length });

        // Use smart auto-detection options
        const smartOptions: ScrapingOptions = {
          followLinks: true,
          maxDepth: 2,
          useHeadless: true,
          usePlaywright: true,
          includePhoneNumbers: true,
          timeout: 60000,
        };

        const response = await fetch("/api/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url, options: smartOptions }),
        });

        const result: ScrapingResult = await response.json();
        batchResults.push(result);
        setResults([...batchResults]);
        setCurrentResult(result);
      } catch (error) {
        console.error(`Error scraping URL at index ${i}:`, error);
        batchResults.push({
          url: urls[i],
          contacts: [],
          timestamp: new Date().toISOString(),
          status: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
        setResults([...batchResults]);
      }
    }

    setIsScrapingBatch(false);
  };

  // Handle downloading results in Excel or CSV format
  const handleDownload = async (format: "xlsx" | "csv") => {
    if (!results.length) return;

    setIsDownloading(true);
    try {
      const allContacts = results.flatMap((result) =>
        result.contacts.map((contact) => ({
          ...contact,
          source: result.url,
          scrapeTime: new Date(result.timestamp).toLocaleString(),
        }))
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
              current={batchProgress.current}
              total={batchProgress.total}
              results={results}
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

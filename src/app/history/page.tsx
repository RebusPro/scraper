"use client";

import { useState, useEffect } from "react";
import ResultsDisplay from "@/components/ResultsDisplay"; // Reuse the results display
import { ScrapingResult, ScrapedContact } from "@/lib/scraper/types"; // Import necessary types

// Define types for the data fetched from the APIs
interface BatchSummary {
  batchId: string;
  startTime: string;
  processedCount: number;
  // totalUrls might be added later
}

// Type for individual result row fetched for detail view
// Should align with the structure returned by /api/history/results
interface HistoryResultRow {
  id: string;
  batch_id: string;
  url: string;
  status: "success" | "error";
  contacts: ScrapedContact[] | null;
  error_message: string | null;
  timestamp: string; // Already mapped from created_at in API
}

export default function HistoryPage() {
  const [batchList, setBatchList] = useState<BatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatchResults, setSelectedBatchResults] = useState<
    HistoryResultRow[]
  >([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch batch list on component mount
  useEffect(() => {
    const fetchBatches = async () => {
      setIsLoadingBatches(true);
      setError(null);
      try {
        const response = await fetch("/api/history/batches");
        if (!response.ok) {
          throw new Error(`Failed to fetch batches: ${response.statusText}`);
        }
        const data = await response.json();
        setBatchList(data.batches || []);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Failed to load batch history"
        );
      } finally {
        setIsLoadingBatches(false);
      }
    };
    fetchBatches();
  }, []);

  // Fetch results when a batch is selected
  useEffect(() => {
    if (!selectedBatchId) {
      setSelectedBatchResults([]); // Clear results if no batch selected
      return;
    }

    const fetchResults = async () => {
      setIsLoadingResults(true);
      setError(null);
      setSelectedBatchResults([]); // Clear previous results while loading
      try {
        const response = await fetch(
          `/api/history/results?batchId=${selectedBatchId}`
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch results for batch ${selectedBatchId}: ${response.statusText}`
          );
        }
        const data = await response.json();
        setSelectedBatchResults(data.results || []);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : `Failed to load results for batch ${selectedBatchId}`
        );
      } finally {
        setIsLoadingResults(false);
      }
    };
    fetchResults();
  }, [selectedBatchId]);

  // Map selected batch results to the format ResultsDisplay expects
  // This assumes ResultsDisplay expects an array of ScrapingResult
  const resultsForDisplay: ScrapingResult[] = selectedBatchResults.map(
    (row) => ({
      url: row.url,
      contacts: row.contacts || [],
      timestamp: row.timestamp,
      status: row.status,
      message: row.error_message || undefined,
      stats: {
        // Reconstruct basic stats
        totalEmails: row.contacts?.length || 0,
        totalWithNames: row.contacts?.filter((c) => !!c.name).length || 0,
        pagesScraped: 1, // This info isn't stored, use placeholder
      },
    })
  );

  // Placeholder download handler for ResultsDisplay prop requirement
  const handleHistoryDownload = (format: "xlsx" | "csv") => {
    console.log(
      `Download requested for format: ${format} from history (not implemented)`
    );
    // TODO: Implement download logic for historical data if needed
    alert("Download from history page is not yet implemented.");
  };

  return (
    <main className="flex min-h-screen flex-col p-6 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">
          Scraping History
        </h1>

        {error && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
            role="alert"
          >
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Batch List Section */}
          <div className="md:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 h-fit">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              Batches
            </h2>
            {isLoadingBatches ? (
              <p className="text-gray-500 dark:text-gray-400">
                Loading batches...
              </p>
            ) : batchList.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                No past batches found.
              </p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto">
                {batchList.map((batch) => (
                  <li key={batch.batchId}>
                    <button
                      onClick={() => setSelectedBatchId(batch.batchId)}
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        selectedBatchId === batch.batchId
                          ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <p className="font-medium">
                        ID: {batch.batchId.substring(0, 8)}...
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Started: {new Date(batch.startTime).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        URLs Processed: {batch.processedCount}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Results Display Section */}
          <div className="md:col-span-2">
            {selectedBatchId ? (
              isLoadingResults ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <p className="text-gray-500 dark:text-gray-400">
                    Loading results for batch {selectedBatchId.substring(0, 8)}
                    ...
                  </p>
                </div>
              ) : (
                <ResultsDisplay
                  // Pass the first result if available, or null/empty object if needed by component
                  result={
                    resultsForDisplay.length > 0 ? resultsForDisplay[0] : null
                  }
                  allResults={resultsForDisplay}
                  onDownload={handleHistoryDownload}
                  isDownloading={false}
                />
              )
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <p className="text-center text-gray-500 dark:text-gray-400">
                  Select a batch from the list to view its results.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

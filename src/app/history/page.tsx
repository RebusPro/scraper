"use client";

import { useState, useEffect, useCallback } from "react";
import ResultsDisplay from "@/components/ResultsDisplay"; // Reuse the results display
import { ScrapingResult, ScrapedContact } from "@/lib/scraper/types"; // Import necessary types
// Import export utilities
import { exportToCSV, exportToExcel } from "@/lib/scraper/exportUtils";
import { toast } from "react-hot-toast";

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

// Interface for API response (matching backend)
interface PaginatedBatchResponse {
  batches: BatchSummary[];
  totalCount: number;
}

const ITEMS_PER_PAGE = 10; // Define items per page constant

export default function HistoryPage() {
  const [batchList, setBatchList] = useState<BatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatchResults, setSelectedBatchResults] = useState<
    HistoryResultRow[]
  >([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBatches, setTotalBatches] = useState(0);

  // Filter State
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Add state for tracking batch deletion
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  // Hover State for URL Tooltip
  const [hoveredBatchId, setHoveredBatchId] = useState<string | null>(null);
  const [hoveredUrls, setHoveredUrls] = useState<string[] | null>(null);
  const [isLoadingUrls, setIsLoadingUrls] = useState<boolean>(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Add state for history download status
  const [isHistoryDownloading, setIsHistoryDownloading] = useState(false);

  // Calculate total pages
  const totalPages = Math.ceil(totalBatches / ITEMS_PER_PAGE);

  // Fetch batch list - now accepts page number and filters
  const fetchBatches = useCallback(
    async (page: number, filterStartDate?: string, filterEndDate?: string) => {
      setIsLoadingBatches(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (filterStartDate) params.set("startDate", filterStartDate);
      if (filterEndDate) params.set("endDate", filterEndDate);

      try {
        const response = await fetch(
          `/api/history/batches?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch batches: ${response.statusText}`);
        }
        const data: PaginatedBatchResponse = await response.json();
        setBatchList(data.batches || []);
        setTotalBatches(data.totalCount || 0);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Failed to load batch history"
        );
        setBatchList([]); // Clear list on error
        setTotalBatches(0);
      } finally {
        setIsLoadingBatches(false);
      }
    },
    []
  ); // Dependencies remain empty

  // Fetch initial data on mount
  useEffect(() => {
    fetchBatches(1); // Fetch page 1 initially with no filters
  }, [fetchBatches]);

  // Refetch data when currentPage changes, maintaining filters
  useEffect(() => {
    // Remove the condition - fetch whenever currentPage or filters change
    // The initial fetch is handled by the effect above.
    // We need this to run even when currentPage becomes 1 via the Previous button.
    fetchBatches(currentPage, startDate, endDate);
  }, [currentPage, fetchBatches, startDate, endDate]); // Dependencies are correct

  // Fetch results when a batch is selected
  useEffect(() => {
    if (!selectedBatchId) {
      setSelectedBatchResults([]);
      return;
    }
    // Reset results if selected batch is not in the current list view
    if (!batchList.some((b) => b.batchId === selectedBatchId)) {
      setSelectedBatchId(null);
      setSelectedBatchResults([]);
      return;
    }

    const fetchResults = async () => {
      setIsLoadingResults(true);
      setError(null);
      setSelectedBatchResults([]);
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
  }, [selectedBatchId, batchList]); // Added batchList dependency

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

  // Implement the actual download logic
  const handleHistoryDownload = async (format: "xlsx" | "csv") => {
    if (!resultsForDisplay.length || !selectedBatchId) {
      alert("No results to download for the selected batch.");
      return;
    }

    setIsHistoryDownloading(true);
    try {
      // Format data similar to the main page export
      const dataForExport = resultsForDisplay.flatMap(
        (result) =>
          result.contacts?.map((contact) => ({
            Email: contact.email || "",
            Name: contact.name || "",
            "Title/Position": contact.title || "",
            "Source Website": contact.source || result.url || "", // Use result.url if source isn't on contact
            "Scrape Date": new Date(result.timestamp).toLocaleString(),
          })) ?? []
      );

      if (dataForExport.length === 0) {
        alert("No contacts found in the selected batch results to export.");
        return;
      }

      const filename = `batch-${selectedBatchId.substring(0, 8)}-results`;

      if (format === "xlsx") {
        await exportToExcel(dataForExport, filename);
      } else {
        exportToCSV(dataForExport, filename);
      }
    } catch (error) {
      console.error("Error exporting history data:", error);
      alert("Failed to download history results. Please try again.");
    } finally {
      setIsHistoryDownloading(false);
    }
  };

  // --- Pagination handlers ---
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // --- Filter Handlers ---
  const handleApplyFilters = () => {
    setCurrentPage(1); // Reset to page 1 when applying filters
    fetchBatches(1, startDate, endDate);
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setCurrentPage(1); // Reset to page 1
    fetchBatches(1); // Fetch without filters
  };

  // Handle batch deletion
  const handleDeleteBatch = async (batchId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the batch when clicking delete

    if (
      !confirm(
        "Are you sure you want to delete this batch? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeletingBatchId(batchId);

    try {
      const response = await fetch(`/api/history/delete?batchId=${batchId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to delete batch: ${response.statusText}`
        );
      }

      // On success, remove the batch from the local state
      setBatchList((prevList) =>
        prevList.filter((batch) => batch.batchId !== batchId)
      );

      // If the deleted batch was selected, clear the selection
      if (selectedBatchId === batchId) {
        setSelectedBatchId(null);
        setSelectedBatchResults([]);
      }

      // Update total count
      setTotalBatches((prev) => prev - 1);

      toast.success("Batch deleted successfully");
    } catch (err) {
      console.error("Error deleting batch:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete batch"
      );
    } finally {
      setDeletingBatchId(null);
    }
  };

  // --- URL Tooltip Handlers ---
  const handleBadgeMouseEnter = async (batchId: string) => {
    // Avoid fetching if already hovering same batch or already loading
    if (hoveredBatchId === batchId || isLoadingUrls) return;

    setHoveredBatchId(batchId);
    setHoveredUrls(null); // Clear previous URLs
    setUrlError(null); // Clear previous errors
    setIsLoadingUrls(true);

    try {
      const response = await fetch(
        `/api/history/batch-urls?batchId=${batchId}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to fetch URLs: ${response.statusText}`
        );
      }
      const data = await response.json();
      setHoveredUrls(data.urls || []);
    } catch (err) {
      console.error("Error fetching URLs for tooltip:", err);
      setUrlError(err instanceof Error ? err.message : "Could not load URLs");
      setHoveredUrls([]); // Set empty array on error to stop loading indicator
    } finally {
      setIsLoadingUrls(false);
    }
  };

  const handleBadgeMouseLeave = () => {
    setHoveredBatchId(null);
    setHoveredUrls(null);
    setIsLoadingUrls(false);
    setUrlError(null);
  };

  return (
    <main className="flex min-h-screen flex-col p-6 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto relative">
        {" "}
        {/* Added relative for tooltip positioning */}
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
        {/* Adjust Grid Layout for narrower left column */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Batch List Section - Column 1 (remains md:col-span-1) */}
          <div className="md:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-fit">
            {/* Filter Controls */}
            <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3">
                Filter by Date
              </h3>
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="startDate"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="endDate"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleApplyFilters}
                    disabled={isLoadingBatches}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
                  >
                    Filter
                  </button>
                  <button
                    onClick={handleClearFilters}
                    disabled={isLoadingBatches || (!startDate && !endDate)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              Batches
            </h2>
            {isLoadingBatches ? (
              <div className="text-center py-10">
                <p className="text-gray-500 dark:text-gray-400">
                  Loading batches...
                </p>
              </div>
            ) : batchList.length === 0 && !error ? (
              <div className="text-center py-10">
                <p className="text-gray-500 dark:text-gray-400">
                  No past batches found.
                </p>
              </div>
            ) : (
              <>
                <ul className="space-y-3 mb-6">
                  {batchList.map((batch) => (
                    <li key={batch.batchId} className="relative">
                      {" "}
                      {/* Added relative for tooltip */}
                      <button
                        onClick={() => setSelectedBatchId(batch.batchId)}
                        className={`w-full text-left p-4 rounded-lg transition-all duration-150 ease-in-out border ${
                          selectedBatchId === batch.batchId
                            ? "bg-indigo-50 dark:bg-indigo-900/50 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-200 dark:ring-indigo-800"
                            : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">
                            {new Date(batch.startTime).toLocaleString()}
                          </p>
                          <div className="flex space-x-2 items-center">
                            <span
                              onMouseEnter={() =>
                                handleBadgeMouseEnter(batch.batchId)
                              }
                              onMouseLeave={handleBadgeMouseLeave}
                              className="flex-shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 whitespace-nowrap cursor-help relative" // Added cursor-help, relative
                              title={`${batch.processedCount} URLs Processed`}
                            >
                              {batch.processedCount} URLs
                              {/* Tooltip Content - Absolutely Positioned */}
                              {hoveredBatchId === batch.batchId && (
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg z-10 break-words">
                                  {isLoadingUrls && <p>Loading URLs...</p>}
                                  {urlError && (
                                    <p className="text-red-400">
                                      Error: {urlError}
                                    </p>
                                  )}
                                  {hoveredUrls &&
                                    !isLoadingUrls &&
                                    !urlError &&
                                    (hoveredUrls.length > 0 ? (
                                      <>
                                        <p className="font-semibold mb-1 border-b border-gray-600 pb-1">
                                          Scraped URLs:
                                        </p>
                                        <ul className="list-disc list-inside max-h-40 overflow-y-auto">
                                          {hoveredUrls.slice(0, 15).map(
                                            (
                                              url,
                                              i // Limit display length
                                            ) => (
                                              <li
                                                key={i}
                                                className="truncate"
                                                title={url}
                                              >
                                                {url}
                                              </li>
                                            )
                                          )}
                                        </ul>
                                        {hoveredUrls.length > 15 && (
                                          <p className="text-center text-gray-400 mt-1">
                                            ...and {hoveredUrls.length - 15}{" "}
                                            more
                                          </p>
                                        )}
                                      </>
                                    ) : (
                                      <p>No URLs found for this batch.</p>
                                    ))}
                                </div>
                              )}
                            </span>
                            <button
                              className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 focus:outline-none"
                              onClick={(e) =>
                                handleDeleteBatch(batch.batchId, e)
                              }
                              disabled={deletingBatchId === batch.batchId}
                              title="Delete batch"
                            >
                              {deletingBatchId === batch.batchId ? (
                                <svg
                                  className="animate-spin h-4 w-4"
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
                              ) : (
                                <svg
                                  className="h-4 w-4"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                    clipRule="evenodd"
                                  ></path>
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                {/* Pagination Controls */}
                {totalBatches > ITEMS_PER_PAGE && (
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1 || isLoadingBatches}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage >= totalPages || isLoadingBatches}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Results Display Section - Now takes 3 columns */}
          <div className="md:col-span-3">
            {selectedBatchId &&
              (isLoadingResults ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <p className="text-gray-500 dark:text-gray-400">
                    Loading results for batch {selectedBatchId.substring(0, 8)}
                    ...
                  </p>
                </div>
              ) : resultsForDisplay.length > 0 ? (
                <ResultsDisplay
                  result={resultsForDisplay[0]}
                  allResults={resultsForDisplay}
                  onDownload={handleHistoryDownload}
                  isDownloading={isHistoryDownloading}
                />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <p className="text-center text-gray-500 dark:text-gray-400">
                    No results found for the selected batch.
                  </p>
                </div>
              ))}
            {/* Optional: Placeholder if no batch is selected */}
            {!selectedBatchId && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-full flex items-center justify-center">
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

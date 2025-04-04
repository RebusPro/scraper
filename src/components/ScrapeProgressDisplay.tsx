/**
 * Component to display scraping progress for batch jobs
 */
"use client";

import { useState } from "react";
import { ScrapingResult } from "@/lib/scraper/types";

interface ScrapeProgressDisplayProps {
  current: number;
  total: number;
  results: ScrapingResult[];
}

export default function ScrapeProgressDisplay({
  current,
  total,
  results,
}: ScrapeProgressDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Calculate progress percentage
  const progressPercentage = Math.round((current / total) * 100);

  // Count success/error/partial results
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const partialCount = results.filter((r) => r.status === "partial").length;

  // Count total emails found
  const totalEmails = results.reduce(
    (sum, result) => sum + (result.contacts?.length || 0),
    0
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Scraping in progress
          </h3>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {current} of {total} sites
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2">
          <div
            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>

        <div className="flex flex-wrap gap-3 mt-3">
          <div className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 text-xs font-medium px-2.5 py-0.5 rounded">
            Success: {successCount}
          </div>
          {errorCount > 0 && (
            <div className="bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-xs font-medium px-2.5 py-0.5 rounded">
              Failed: {errorCount}
            </div>
          )}
          {partialCount > 0 && (
            <div className="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 text-xs font-medium px-2.5 py-0.5 rounded">
              Partial: {partialCount}
            </div>
          )}
          <div className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 text-xs font-medium px-2.5 py-0.5 rounded">
            Emails found: {totalEmails}
          </div>
        </div>
      </div>

      {/* Toggle details button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 focus:outline-none"
      >
        {showDetails ? "Hide details" : "Show details"}
      </button>

      {/* Details table */}
      {showDetails && results.length > 0 && (
        <div className="mt-4 max-h-60 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Website
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Emails
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {results.map((result, index) => (
                <tr
                  key={index}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 truncate max-w-[250px]">
                    {result.url}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {result.status === "success" ? (
                      <span className="text-green-600 dark:text-green-400">
                        Success
                      </span>
                    ) : result.status === "partial" ? (
                      <span className="text-yellow-600 dark:text-yellow-400">
                        Partial
                      </span>
                    ) : (
                      <span
                        className="text-red-600 dark:text-red-400"
                        title={result.message}
                      >
                        Error
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">
                    {result.contacts.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

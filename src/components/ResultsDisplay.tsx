/**
 * Component to display scraping results
 */
"use client";

import { useState } from "react";
import { ScrapedContact, ScrapingResult } from "@/lib/scraper/types";

interface ResultsDisplayProps {
  result: ScrapingResult | null;
  onDownload: (format: "xlsx" | "csv") => void;
  isDownloading: boolean;
}

export default function ResultsDisplay({
  result,
  onDownload,
  isDownloading,
}: ResultsDisplayProps) {
  const [searchTerm, setSearchTerm] = useState("");

  if (!result) return null;

  const { contacts, url, status, timestamp, stats } = result;

  // Filter contacts based on search term
  const filteredContacts = searchTerm
    ? contacts.filter(
        (contact) =>
          contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (contact.name &&
            contact.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (contact.title &&
            contact.title.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : contacts;

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            Scraping Results
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {new Date(timestamp).toLocaleString()} • {url}
          </p>
        </div>

        <div className="flex space-x-2 mt-4 md:mt-0">
          <button
            onClick={() => onDownload("xlsx")}
            disabled={isDownloading || contacts.length === 0}
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? "Downloading..." : "Excel"}
          </button>
          <button
            onClick={() => onDownload("csv")}
            disabled={isDownloading || contacts.length === 0}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? "Downloading..." : "CSV"}
          </button>
        </div>
      </div>

      {status === "error" ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-md p-4 mb-4">
          <p className="text-red-700 dark:text-red-400">
            {result.message || "An error occurred while scraping the website."}
          </p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30 rounded-md p-4 mb-4">
          <p className="text-yellow-700 dark:text-yellow-400">
            No email addresses found on this website. Try enabling advanced
            options or try a different URL.
          </p>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Found <span className="font-semibold">{contacts.length}</span>{" "}
              email addresses
              {stats?.totalWithNames
                ? ` (${stats.totalWithNames} with names)`
                : ""}
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search results..."
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Email
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Title/Position
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredContacts.map(
                  (contact: ScrapedContact, index: number) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600 dark:text-indigo-400">
                        <a
                          href={`mailto:${contact.email}`}
                          className="hover:underline"
                        >
                          {contact.email}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {contact.name || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {contact.title || "-"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

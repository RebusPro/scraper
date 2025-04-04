/**
 * Component to display scraping results with enhanced viewing and export options
 */
"use client";

import { useState } from "react";
import { ScrapedContact, ScrapingResult } from "@/lib/scraper/types";

interface ResultsDisplayProps {
  result: ScrapingResult | null; // Keep in interface for API compatibility
  allResults: ScrapingResult[];
  onDownload: (format: "xlsx" | "csv") => void;
  isDownloading: boolean;
}

export default function ResultsDisplay({
  allResults,
  onDownload,
  isDownloading,
}: ResultsDisplayProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  // Get all contacts from all results
  const allContacts = allResults.flatMap((r) => r.contacts);

  // Filter contacts based on search term and selected site
  const filteredContacts = allContacts.filter((contact) => {
    const matchesSearch =
      !searchTerm ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.name &&
        contact.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (contact.title &&
        contact.title.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSite = !selectedSite || contact.source === selectedSite;

    return matchesSearch && matchesSite;
  });

  // Group sites by domain for the filter dropdown
  const sites = [...new Set(allResults.map((r) => r.url))];

  // Compute stats
  const totalSites = allResults.length;
  const totalEmails = allContacts.length;
  const emailsWithNames = allContacts.filter((c) => c.name).length;
  const emailsWithTitles = allContacts.filter((c) => c.title).length;

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            Scraping Results
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {new Date().toLocaleString()}
          </p>
        </div>

        <div className="flex space-x-2 mt-4 md:mt-0">
          <button
            onClick={() => onDownload("xlsx")}
            disabled={isDownloading || allContacts.length === 0}
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? "Downloading..." : "Excel"}
          </button>
          <button
            onClick={() => onDownload("csv")}
            disabled={isDownloading || allContacts.length === 0}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? "Downloading..." : "CSV"}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
          <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
            {totalEmails}
          </div>
          <div className="text-sm text-indigo-600 dark:text-indigo-300">
            Total Emails
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">
            {totalSites}
          </div>
          <div className="text-sm text-green-600 dark:text-green-300">
            Sites Scraped
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
            {emailsWithNames}
          </div>
          <div className="text-sm text-blue-600 dark:text-blue-300">
            With Names
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
            {emailsWithTitles}
          </div>
          <div className="text-sm text-purple-600 dark:text-purple-300">
            With Titles
          </div>
        </div>
      </div>

      {allContacts.length === 0 ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30 rounded-md p-4 mb-4">
          <p className="text-yellow-700 dark:text-yellow-400">
            No email addresses found. Try enabling advanced options or try
            different websites.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            {/* Search and filter controls */}
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search emails, names..."
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white w-full sm:w-64"
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

              <select
                value={selectedSite || ""}
                onChange={(e) => setSelectedSite(e.target.value || null)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Sites</option>
                {sites.map((site, i) => (
                  <option key={i} value={site}>
                    {site.replace(/^https?:\/\//, "").replace(/^www\./, "")}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
              Showing{" "}
              <span className="font-semibold">{filteredContacts.length}</span>{" "}
              of <span className="font-semibold">{allContacts.length}</span>{" "}
              contacts
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
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredContacts.map(
                  (contact: ScrapedContact, index: number) => (
                    <tr
                      key={`${contact.email}-${index}`}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                        <a
                          href={contact.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-blue-600 dark:text-blue-400"
                        >
                          {contact.source
                            ?.replace(/^https?:\/\//, "")
                            .replace(/^www\./, "")}
                        </a>
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

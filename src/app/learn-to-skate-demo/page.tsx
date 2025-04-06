/**
 * Demo page for the Learn to Skate USA specialized scraper
 * This matches the style of the main page and is exportable
 */

"use client";

import { useState } from "react";
import { ScrapedContact } from "@/lib/scraper/types";
import LearnToSkateForm from "@/components/LearnToSkateForm";
import { exportToCSV, exportToExcel } from "@/lib/scraper/exportUtils";

export default function LearnToSkateDemoPage() {
  const [contacts, setContacts] = useState<ScrapedContact[]>([]);
  const [programs, setPrograms] = useState<unknown[]>([]);
  const [isShowingRaw, setIsShowingRaw] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleResults = (
    newContacts: ScrapedContact[],
    rawPrograms: unknown[]
  ) => {
    setContacts(newContacts);
    setPrograms(rawPrograms);
  };

  // Handle downloading results in Excel or CSV format
  const handleDownload = async (format: "xlsx" | "csv") => {
    if (!contacts.length) return;

    setIsDownloading(true);
    try {
      const allContacts = contacts.map((contact) => ({
        email: contact.email || "",
        name: contact.name || "Unknown Program",
        title: contact.title || "Organization",
        phone: contact.phone || "",
        source: "Learn to Skate USA API",
        scrapeTime: new Date().toLocaleString(),
        // Ensure website URL is included with the proper field name for exports
        website: contact.url || "",
        url: contact.url || "",
      }));

      if (format === "xlsx") {
        await exportToExcel(allContacts, "learn-to-skate-contacts");
      } else {
        exportToCSV(allContacts, "learn-to-skate-contacts");
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
        {/* Header section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Learn to Skate USA Contact Finder
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2 max-w-2xl mx-auto">
            This specialized tool directly connects to the Learn to Skate USA
            API to find program contact information.
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
              Direct API Access
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
              Excel/CSV Export
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
              Contact Information
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <LearnToSkateForm onResults={handleResults} />
            </div>

            <div className="md:col-span-2">
              {contacts.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                      Results
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsShowingRaw(!isShowingRaw)}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-sm text-gray-800 dark:text-white"
                      >
                        {isShowingRaw ? "Show Formatted" : "Show Raw Data"}
                      </button>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDownload("xlsx")}
                          disabled={isDownloading}
                          className={`px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm flex items-center ${
                            isDownloading ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          Excel
                        </button>
                        <button
                          onClick={() => handleDownload("csv")}
                          disabled={isDownloading}
                          className={`px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm flex items-center ${
                            isDownloading ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          CSV
                        </button>
                      </div>
                    </div>
                  </div>

                  {isShowingRaw ? (
                    <div className="mt-4">
                      <h3 className="font-semibold mb-2 text-gray-800 dark:text-white">
                        Raw Program Data:
                      </h3>
                      <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-auto max-h-[500px] text-sm text-gray-800 dark:text-gray-300">
                        {JSON.stringify(programs, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <>
                      <p className="mb-4 text-gray-700 dark:text-gray-300">
                        Found {contacts.length} contacts
                      </p>
                      <div className="space-y-4">
                        {contacts.map((contact, index) => (
                          <div
                            key={index}
                            className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                          >
                            <p className="font-semibold text-blue-600 dark:text-blue-400">
                              {contact.email}
                            </p>
                            {contact.name && (
                              <p className="text-gray-800 dark:text-gray-300">
                                <span className="font-medium">Program:</span>{" "}
                                <span className="font-semibold">
                                  {contact.name}
                                </span>
                              </p>
                            )}
                            {contact.phone && (
                              <p className="text-gray-800 dark:text-gray-300">
                                <span className="font-medium">Phone:</span>{" "}
                                {contact.phone}
                              </p>
                            )}
                            {contact.url && (
                              <p className="text-gray-800 dark:text-gray-300">
                                <span className="font-medium">Website:</span>{" "}
                                <a
                                  href={contact.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  {contact.url}
                                </a>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center flex items-center justify-center h-full">
                  <div>
                    <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                      No results yet
                    </h3>
                    <p className="text-gray-400 dark:text-gray-500">
                      Select a state or enter a ZIP code to find skating
                      programs
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* <div className="mt-12 bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
              How It Works
            </h2>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              This specialized tool bypasses the limitations of traditional web
              scraping by directly connecting to the Learn to Skate USA API.
              When you select a state or enter a ZIP code:
            </p>
            <ol className="list-decimal pl-5 space-y-2 mb-4 text-gray-600 dark:text-gray-300">
              <li>
                Our backend API makes a request to the Learn to Skate USA API
              </li>
              <li>
                The API returns program data including contact information
              </li>
              <li>
                We extract and format the email addresses and other contact
                details
              </li>
              <li>The results are displayed in a user-friendly format</li>
            </ol>
            <p className="text-gray-600 dark:text-gray-300">
              For more technical details, see the{" "}
              <a
                href="#"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Learn-To-Skate-Solution.md
              </a>{" "}
              documentation.
            </p>
          </div> */}
        </div>
      </div>
    </main>
  );
}

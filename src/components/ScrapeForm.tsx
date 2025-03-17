/**
 * URL input form component for the web scraper
 */
"use client";

import { useState } from "react";
import { ScrapingOptions } from "@/lib/scraper/types";

interface ScrapeFormProps {
  onSubmit: (url: string, options: ScrapingOptions) => void;
  isLoading: boolean;
}

export default function ScrapeForm({ onSubmit, isLoading }: ScrapeFormProps) {
  const [url, setUrl] = useState("");
  const [advancedOptions, setAdvancedOptions] = useState(false);
  const [followLinks, setFollowLinks] = useState(false);
  const [useHeadless, setUseHeadless] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url) return;

    const options = {
      followLinks,
      useHeadless,
      maxDepth: followLinks ? 2 : 1,
    };

    onSubmit(url, options);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
        Enter Website URL
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="url"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Website URL
          </label>
          <div className="flex">
            <input
              type="text"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-grow px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              required
            />
            <button
              type="submit"
              disabled={isLoading || !url}
              className="px-4 py-2 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                  Scraping...
                </span>
              ) : (
                "Scrape"
              )}
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Enter the full URL including http:// or https://
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setAdvancedOptions(!advancedOptions)}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 focus:outline-none"
          >
            {advancedOptions
              ? "- Hide advanced options"
              : "+ Show advanced options"}
          </button>

          {advancedOptions && (
            <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="followLinks"
                  checked={followLinks}
                  onChange={(e) => setFollowLinks(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="followLinks"
                  className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                >
                  Follow links to contact pages (slower but more thorough)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="useHeadless"
                  checked={useHeadless}
                  onChange={(e) => setUseHeadless(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="useHeadless"
                  className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                >
                  Use browser rendering (for JavaScript-heavy sites)
                </label>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

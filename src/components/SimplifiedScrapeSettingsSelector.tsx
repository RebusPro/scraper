/**
 * Simplified component for selecting scraping settings with user-friendly presets
 * Designed for non-technical users
 */
"use client";

import { useState, useEffect } from "react";

// Define the settings type
type ScraperSettings = {
  mode: "standard" | "aggressive" | "gentle";
  maxDepth: number;
  followLinks: boolean;
  includePhoneNumbers: boolean;
  browserType: "chromium" | "firefox";
  timeout: number;
};

interface ScrapeSettingsProps {
  onSettingsChange: (settings: ScraperSettings) => void;
}

export default function SimplifiedScrapeSettingsSelector({
  onSettingsChange,
}: ScrapeSettingsProps) {
  const [settingsMode, setSettingsMode] = useState<
    "standard" | "aggressive" | "gentle"
  >("standard");

  // Default settings for each mode
  const standardSettings: ScraperSettings = {
    mode: "standard",
    maxDepth: 2,
    followLinks: true,
    includePhoneNumbers: true,
    browserType: "chromium",
    timeout: 30000,
  };

  const aggressiveSettings: ScraperSettings = {
    mode: "aggressive",
    maxDepth: 3,
    followLinks: true,
    includePhoneNumbers: true,
    browserType: "chromium",
    timeout: 60000, // Increased timeout for dynamic sites
  };

  const gentleSettings: ScraperSettings = {
    mode: "gentle",
    maxDepth: 1,
    followLinks: false,
    includePhoneNumbers: true,
    browserType: "firefox",
    timeout: 20000,
  };

  // Handle mode change
  const handleModeChange = (mode: "standard" | "aggressive" | "gentle") => {
    setSettingsMode(mode);

    let newSettings: ScraperSettings;

    if (mode === "standard") {
      newSettings = standardSettings;
    } else if (mode === "aggressive") {
      newSettings = aggressiveSettings;
    } else {
      newSettings = gentleSettings;
    }

    onSettingsChange(newSettings);
  };

  // Initialize with standard settings
  useEffect(() => {
    onSettingsChange(standardSettings);
  }, []);

  return (
    <div className="space-y-4 bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
        Scanning Intensity
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Choose how thoroughly to scan websites for coach information
      </p>

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => handleModeChange("gentle")}
          className={`p-4 rounded-lg flex flex-col items-center justify-center text-center h-full ${
            settingsMode === "gentle"
              ? "bg-green-100 border-2 border-green-500 dark:bg-green-900/30 dark:border-green-400"
              : "bg-gray-100 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          <div className="text-2xl mb-2">🌱</div>
          <div className="font-medium text-gray-900 dark:text-white">Light</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Fast scanning
            <br />
            Simple sites only
          </div>
        </button>

        <button
          onClick={() => handleModeChange("standard")}
          className={`p-4 rounded-lg flex flex-col items-center justify-center text-center h-full ${
            settingsMode === "standard"
              ? "bg-indigo-100 border-2 border-indigo-500 dark:bg-indigo-900/30 dark:border-indigo-400"
              : "bg-gray-100 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          <div className="text-2xl mb-2">🔍</div>
          <div className="font-medium text-gray-900 dark:text-white">
            Standard
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Balanced approach
            <br />
            Works with most sites
          </div>
        </button>

        <button
          onClick={() => handleModeChange("aggressive")}
          className={`p-4 rounded-lg flex flex-col items-center justify-center text-center h-full ${
            settingsMode === "aggressive"
              ? "bg-red-100 border-2 border-red-500 dark:bg-red-900/30 dark:border-red-400"
              : "bg-gray-100 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          <div className="text-2xl mb-2">🔥</div>
          <div className="font-medium text-gray-900 dark:text-white">
            Thorough
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Deep scanning
            <br />
            For complex sites
          </div>
        </button>
      </div>

      <div className="mt-4 p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
              Recommendation
            </h3>
            <div className="mt-1 text-sm text-blue-700 dark:text-blue-400">
              {settingsMode === "aggressive" ? (
                <p>
                  For sites like hockey.travelsports.com with dynamic content,
                  use <strong>Thorough</strong> mode.
                </p>
              ) : settingsMode === "gentle" ? (
                <p>
                  Light mode works best for simple sites with easily accessible
                  contact information.
                </p>
              ) : (
                <p>Standard mode is recommended for most coaching websites.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

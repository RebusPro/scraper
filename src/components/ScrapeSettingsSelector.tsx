/**
 * Component for selecting scraping settings with user-friendly presets
 */
"use client";

import { useState } from "react";

// Define the settings type to ensure consistent typing throughout the component
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

export default function ScrapeSettingsSelector({
  onSettingsChange,
}: ScrapeSettingsProps) {
  const [settingsMode, setSettingsMode] = useState<
    "standard" | "aggressive" | "gentle"
  >("standard");
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    timeout: 45000,
  };

  const gentleSettings: ScraperSettings = {
    mode: "gentle",
    maxDepth: 1,
    followLinks: false,
    includePhoneNumbers: true,
    browserType: "firefox",
    timeout: 20000,
  };

  // Custom settings
  const [customSettings, setCustomSettings] = useState<ScraperSettings>({
    ...standardSettings,
  });

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

  // Handle custom setting change
  const handleCustomSettingChange = <K extends keyof ScraperSettings>(
    setting: K,
    value: ScraperSettings[K]
  ) => {
    const newSettings = {
      ...customSettings,
      [setting]: value,
    };
    setCustomSettings(newSettings);
    onSettingsChange(newSettings);
  };

  return (
    <div className="space-y-4 bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
        Scraping Mode
      </h3>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handleModeChange("standard")}
          className={`p-3 rounded-lg flex flex-col items-center justify-center text-center ${
            settingsMode === "standard"
              ? "bg-indigo-100 border-2 border-indigo-500 dark:bg-indigo-900/30 dark:border-indigo-400"
              : "bg-gray-100 border border-gray-300 dark:bg-gray-700 dark:border-gray-600"
          }`}
        >
          <div className="text-xl mb-1">🔍</div>
          <div className="font-medium text-gray-900 dark:text-white">
            Standard
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Balanced scraping for most sites
          </div>
        </button>

        <button
          onClick={() => handleModeChange("aggressive")}
          className={`p-3 rounded-lg flex flex-col items-center justify-center text-center ${
            settingsMode === "aggressive"
              ? "bg-red-100 border-2 border-red-500 dark:bg-red-900/30 dark:border-red-400"
              : "bg-gray-100 border border-gray-300 dark:bg-gray-700 dark:border-gray-600"
          }`}
        >
          <div className="text-xl mb-1">🔥</div>
          <div className="font-medium text-gray-900 dark:text-white">
            Thorough
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Deep scraping for complex sites
          </div>
        </button>

        <button
          onClick={() => handleModeChange("gentle")}
          className={`p-3 rounded-lg flex flex-col items-center justify-center text-center ${
            settingsMode === "gentle"
              ? "bg-green-100 border-2 border-green-500 dark:bg-green-900/30 dark:border-green-400"
              : "bg-gray-100 border border-gray-300 dark:bg-gray-700 dark:border-gray-600"
          }`}
        >
          <div className="text-xl mb-1">🌱</div>
          <div className="font-medium text-gray-900 dark:text-white">Light</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Fast scraping for simple sites
          </div>
        </button>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center"
        >
          {showAdvanced ? "Hide" : "Show"} Advanced Settings
          <svg
            className={`ml-1 h-4 w-4 transition-transform ${
              showAdvanced ? "transform rotate-180" : ""
            }`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {showAdvanced && (
        <div className="mt-4 space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Depth
            </label>
            <select
              value={customSettings.maxDepth}
              onChange={(e) =>
                handleCustomSettingChange("maxDepth", parseInt(e.target.value))
              }
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 text-gray-700 dark:text-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value={1}>Shallow - Main page only</option>
              <option value={2}>Medium - Follow contact links</option>
              <option value={3}>Deep - Explore website thoroughly</option>
            </select>
          </div>

          <div className="flex justify-between">
            <div className="flex items-center">
              <input
                id="follow-links"
                name="follow-links"
                type="checkbox"
                checked={customSettings.followLinks}
                onChange={(e) =>
                  handleCustomSettingChange("followLinks", e.target.checked)
                }
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label
                htmlFor="follow-links"
                className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
              >
                Follow internal links
              </label>
            </div>

            <div className="flex items-center">
              <input
                id="include-phone"
                name="include-phone"
                type="checkbox"
                checked={customSettings.includePhoneNumbers}
                onChange={(e) =>
                  handleCustomSettingChange(
                    "includePhoneNumbers",
                    e.target.checked
                  )
                }
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label
                htmlFor="include-phone"
                className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
              >
                Include phone numbers
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Browser Engine
            </label>
            <div className="flex space-x-4">
              <div className="flex items-center">
                <input
                  id="browser-chromium"
                  name="browser-type"
                  type="radio"
                  checked={customSettings.browserType === "chromium"}
                  onChange={() =>
                    handleCustomSettingChange("browserType", "chromium")
                  }
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <label
                  htmlFor="browser-chromium"
                  className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                >
                  Chrome (Better for modern sites)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  id="browser-firefox"
                  name="browser-type"
                  type="radio"
                  checked={customSettings.browserType === "firefox"}
                  onChange={() =>
                    handleCustomSettingChange("browserType", "firefox")
                  }
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <label
                  htmlFor="browser-firefox"
                  className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                >
                  Firefox (Better for legacy sites)
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Timeout (seconds)
            </label>
            <input
              type="range"
              min="10000"
              max="60000"
              step="5000"
              value={customSettings.timeout}
              onChange={(e) =>
                handleCustomSettingChange("timeout", parseInt(e.target.value))
              }
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>10s (Faster)</span>
              <span>{customSettings.timeout / 1000}s</span>
              <span>60s (More thorough)</span>
            </div>
          </div>
        </div>
      )}

      <div className="pt-4 text-sm">
        <h4 className="font-medium text-gray-700 dark:text-gray-300">
          Current Settings:
        </h4>
        <div className="text-gray-500 dark:text-gray-400 mt-1">
          <p>
            {settingsMode === "standard"
              ? "Standard mode: Balanced speed and thoroughness for most websites."
              : settingsMode === "aggressive"
              ? "Thorough mode: Deep scraping suitable for complex websites with hidden contact information."
              : "Light mode: Quick, surface-level scraping for simple websites."}
          </p>
        </div>
      </div>
    </div>
  );
}

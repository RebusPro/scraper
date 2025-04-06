/**
 * URL input form component for the web scraper
 */
"use client";

import { useState } from "react";
import {
  FormField,
  FormInteraction,
  ScrapingOptions,
} from "@/lib/scraper/types";

interface ScrapeFormProps {
  onSubmit: (url: string, options: ScrapingOptions) => void;
  isLoading: boolean;
}

export default function ScrapeForm({ onSubmit, isLoading }: ScrapeFormProps) {
  const [url, setUrl] = useState("");
  const [advancedOptions, setAdvancedOptions] = useState(false);
  const [followLinks, setFollowLinks] = useState(false);
  const [useHeadless, setUseHeadless] = useState(true);
  const [usePlaywright, setUsePlaywright] = useState(false);
  const [enableFormInteraction, setEnableFormInteraction] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [submitButtonSelector, setSubmitButtonSelector] = useState("");
  const [waitForSelector, setWaitForSelector] = useState("");
  const [waitTime, setWaitTime] = useState(2000);

  const handleAddField = () => {
    setFormFields([...formFields, { selector: "", value: "", type: "text" }]);
  };

  const handleRemoveField = (index: number) => {
    const updatedFields = [...formFields];
    updatedFields.splice(index, 1);
    setFormFields(updatedFields);
  };

  const handleFieldChange = (
    index: number,
    key: keyof FormField,
    value: string
  ) => {
    const updatedFields = [...formFields];
    updatedFields[index] = { ...updatedFields[index], [key]: value };
    setFormFields(updatedFields);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url) return;

    // Build form interaction options if enabled
    const formInteraction: FormInteraction | undefined = enableFormInteraction
      ? {
          enabled: true,
          fields: formFields.length > 0 ? formFields : undefined,
          submitButtonSelector: submitButtonSelector || undefined,
          waitForSelector: waitForSelector || undefined,
          waitTime: waitTime || 2000,
        }
      : undefined;

    const options = {
      followLinks,
      useHeadless,
      usePlaywright,
      maxDepth: followLinks ? 2 : 1,
      formInteraction,
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

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="usePlaywright"
                  checked={usePlaywright}
                  onChange={(e) => setUsePlaywright(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="usePlaywright"
                  className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                >
                  Use Playwright engine (for complex dynamic websites)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="formInteraction"
                  checked={enableFormInteraction}
                  onChange={(e) => setEnableFormInteraction(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="formInteraction"
                  className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                >
                  Enable form interaction (for sites requiring search/login)
                </label>
              </div>

              {enableFormInteraction && (
                <div className="mt-3 pl-6 space-y-4 bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Submit Button Selector
                    </label>
                    <input
                      type="text"
                      value={submitButtonSelector}
                      onChange={(e) => setSubmitButtonSelector(e.target.value)}
                      placeholder="button[type='submit'], .search-button"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      CSS selector for the submit/search button
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Wait For Element Selector (Optional)
                    </label>
                    <input
                      type="text"
                      value={waitForSelector}
                      onChange={(e) => setWaitForSelector(e.target.value)}
                      placeholder=".results, #searchResults"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Element that indicates results have loaded
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Wait Time (ms)
                    </label>
                    <input
                      type="number"
                      value={waitTime}
                      onChange={(e) =>
                        setWaitTime(parseInt(e.target.value) || 2000)
                      }
                      min="500"
                      max="10000"
                      step="500"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Time to wait after form submission (ms)
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Form Fields
                      </label>
                      <button
                        type="button"
                        onClick={handleAddField}
                        className="text-xs bg-indigo-600 text-white py-1 px-2 rounded hover:bg-indigo-700"
                      >
                        + Add Field
                      </button>
                    </div>

                    {formFields.map((field, index) => (
                      <div
                        key={index}
                        className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">
                            Field {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveField(index)}
                            className="text-xs text-red-600 dark:text-red-400"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
                              Selector
                            </label>
                            <input
                              type="text"
                              value={field.selector}
                              onChange={(e) =>
                                handleFieldChange(
                                  index,
                                  "selector",
                                  e.target.value
                                )
                              }
                              placeholder="#search, input[name='query']"
                              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
                              Value
                            </label>
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) =>
                                handleFieldChange(
                                  index,
                                  "value",
                                  e.target.value
                                )
                              }
                              placeholder="search term, Alabama"
                              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
                              Type
                            </label>
                            <select
                              value={field.type}
                              onChange={(e) =>
                                handleFieldChange(
                                  index,
                                  "type",
                                  e.target.value as
                                    | "text"
                                    | "select"
                                    | "checkbox"
                                    | "radio"
                                )
                              }
                              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md"
                            >
                              <option value="text">Text Input</option>
                              <option value="select">Select Dropdown</option>
                              <option value="checkbox">Checkbox</option>
                              <option value="radio">Radio Button</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}

                    {formFields.length === 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        No form fields added. Click &quot;Add Field&quot; to
                        define form inputs.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

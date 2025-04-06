/**
 * Specialized component for scraping the Learn to Skate USA website
 * Uses a direct API approach for more reliable results
 */

"use client";

import React, { useState } from "react";
import axios from "axios";
import { ScrapedContact } from "@/lib/scraper/types";

// State options from the Learn to Skate USA website
const STATE_OPTIONS = [
  { value: "0", label: "Select a State" },
  { value: "1", label: "Alabama" },
  { value: "2", label: "Alaska" },
  { value: "3", label: "Arizona" },
  { value: "4", label: "Arkansas" },
  { value: "5", label: "California" },
  { value: "6", label: "Colorado" },
  { value: "7", label: "Connecticut" },
  { value: "8", label: "Delaware" },
  { value: "9", label: "District Of Columbia" },
  { value: "10", label: "Florida" },
  { value: "11", label: "Georgia" },
  { value: "12", label: "Hawaii" },
  { value: "13", label: "Idaho" },
  { value: "14", label: "Illinois" },
  { value: "15", label: "Indiana" },
  { value: "16", label: "Iowa" },
  { value: "17", label: "Kansas" },
  { value: "18", label: "Kentucky" },
  { value: "19", label: "Louisiana" },
  { value: "20", label: "Maine" },
  { value: "21", label: "Maryland" },
  { value: "22", label: "Massachusetts" },
  { value: "23", label: "Michigan" },
  { value: "24", label: "Minnesota" },
  { value: "25", label: "Mississippi" },
  { value: "26", label: "Missouri" },
  { value: "27", label: "Montana" },
  { value: "28", label: "Nebraska" },
  { value: "29", label: "Nevada" },
  { value: "30", label: "New Hampshire" },
  { value: "31", label: "New Jersey" },
  { value: "32", label: "New Mexico" },
  { value: "33", label: "New York" },
  { value: "34", label: "North Carolina" },
  { value: "35", label: "North Dakota" },
  { value: "36", label: "Oklahoma" },
  { value: "37", label: "Ohio" },
  { value: "38", label: "Oregon" },
  { value: "39", label: "Pennsylvania" },
  { value: "40", label: "Rhode Island" },
  { value: "41", label: "South Carolina" },
  { value: "42", label: "South Dakota" },
  { value: "43", label: "Tennessee" },
  { value: "44", label: "Texas" },
  { value: "45", label: "Utah" },
  { value: "46", label: "Vermont" },
  { value: "47", label: "Virginia" },
  { value: "48", label: "Washington" },
  { value: "49", label: "West Virginia" },
  { value: "50", label: "Wyoming" },
  { value: "51", label: "Wisconsin" },
];

interface LearnToSkateFormProps {
  onResults: (
    contacts: ScrapedContact[],
    rawPrograms: Record<string, unknown>[]
  ) => void;
}

export default function LearnToSkateForm({ onResults }: LearnToSkateFormProps) {
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [programName, setProgramName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate that either state or zip code is provided
      if (!state && !zipCode) {
        throw new Error("Please enter either a state or zip code");
      }

      // Call our specialized API endpoint that uses browser automation
      // This is more reliable than direct API calls which may be blocked
      const response = await axios.post("/api/scrape-learn-to-skate", {
        state,
        zipCode,
        programName,
      });

      if (response.data.emails && response.data.emails.length > 0) {
        // Format the results for the results component
        const contacts: ScrapedContact[] = response.data.emails.map(
          (item: Record<string, unknown>) => ({
            email: item.email,
            name: item.name || "",
            title: item.title || "",
            phone: item.phone || "",
            source: "Learn to Skate USA API",
          })
        );

        // Pass both formatted contacts and raw program data to parent
        onResults(contacts, response.data.programs || []);
      } else {
        setError("No programs or emails found. Try different search criteria.");
        onResults([], []);
      }
    } catch (error) {
      console.error("Error fetching Learn to Skate data:", error);
      setError("Failed to fetch data. Please try again.");
      onResults([], []);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg px-8 pt-6 pb-8 mb-4">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
        Learn to Skate USA Program Finder
      </h2>
      <p className="mb-4 text-gray-600 dark:text-gray-300">
        This specialized form directly searches the Learn to Skate USA database
        for skating programs and their contact information.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
            htmlFor="state"
          >
            State
          </label>
          <select
            id="state"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            {STATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label
            className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
            htmlFor="zipCode"
          >
            Zip Code (optional)
          </label>
          <input
            id="zipCode"
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="e.g. 10001"
          />
        </div>

        <div className="mb-4">
          <label
            className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
            htmlFor="programName"
          >
            Program Name (optional)
          </label>
          <input
            id="programName"
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            placeholder="e.g. Ice Center"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="submit"
            className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition ${
              isLoading ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={isLoading}
          >
            {isLoading ? "Searching..." : "Find Programs"}
          </button>
        </div>
      </form>
    </div>
  );
}

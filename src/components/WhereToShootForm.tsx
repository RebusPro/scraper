/**
 * Form component for searching shooting ranges on WhereToShoot.org
 * Features state and city dropdowns with zero typing required
 */

"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { ScrapedContact } from "@/lib/scraper/types";
import { US_STATES, CITIES_BY_STATE } from "@/lib/constants/citiesByState";

interface WhereToShootFormProps {
  onResults: (
    contacts: ScrapedContact[],
    rawRanges: Record<string, unknown>[]
  ) => void;
}

export default function WhereToShootForm({ onResults }: WhereToShootFormProps) {
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("ALL Cities");
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update available cities when state changes
  useEffect(() => {
    if (selectedState) {
      const cities = CITIES_BY_STATE[selectedState] || [];
      setAvailableCities(cities);
      setSelectedCity("ALL Cities"); // Reset to ALL when state changes
    } else {
      setAvailableCities([]);
      setSelectedCity("ALL Cities");
    }
  }, [selectedState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    console.log("Searching for ranges:", {
      state: selectedState,
      city: selectedCity,
    });

    try {
      // Validate that a state is selected
      if (!selectedState) {
        throw new Error("Please select a state");
      }

      // Call our API endpoint
      const response = await axios.post("/api/scrape-wheretoshoot", {
        state: selectedState,
        city: selectedCity,
      });

      console.log("API response received:", response.data);

      if (response.data.contacts && response.data.contacts.length > 0) {
        // Pass contacts and raw range data to parent
        onResults(
          response.data.contacts,
          response.data.ranges || []
        );
      } else {
        setError(
          "No shooting ranges found. Try selecting a different state or city."
        );
        onResults([], []);
      }
    } catch (error) {
      console.error("Error fetching WhereToShoot data:", error);
      if (axios.isAxiosError(error) && error.response) {
        setError(
          error.response.data.error ||
            "Failed to fetch data. Please try again."
        );
      } else {
        setError("Failed to fetch data. Please try again.");
      }
      onResults([], []);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg px-8 pt-6 pb-8 mb-4">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
        WhereToShoot Range Finder
      </h2>
      <p className="mb-4 text-gray-600 dark:text-gray-300">
        Find shooting ranges across the United States. Select a state and
        optionally narrow down by city.
      </p>

      <form onSubmit={handleSubmit}>
        {/* State Dropdown */}
        <div className="mb-4">
          <label
            className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
            htmlFor="state"
          >
            Step 1: Select State *
          </label>
          <select
            id="state"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
            value={selectedState}
            onChange={(e) => {
              console.log("State selected:", e.target.value);
              setSelectedState(e.target.value);
            }}
            required
          >
            <option value="">Select a State...</option>
            {US_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        {/* City Dropdown (only shown when state is selected) */}
        {selectedState && (
          <div className="mb-4">
            <label
              className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
              htmlFor="city"
            >
              Step 2: Select City (Optional)
            </label>
            <select
              id="city"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
              value={selectedCity}
              onChange={(e) => {
                console.log("City selected:", e.target.value);
                setSelectedCity(e.target.value);
              }}
            >
              <option value="ALL Cities">
                ALL Cities (Recommended - Get all ranges)
              </option>
              {availableCities.length > 0 && (
                <option disabled>──────────────</option>
              )}
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {selectedCity === "ALL Cities"
                ? `Selecting "ALL Cities" will search for ranges across all major cities in ${selectedState}, providing the most comprehensive results.`
                : `Searching only for ranges in ${selectedCity}, ${selectedState}.`}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="submit"
            className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition ${
              isLoading || !selectedState ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={isLoading || !selectedState}
          >
            {isLoading ? "Searching..." : "🔍 Find Shooting Ranges"}
          </button>
        </div>

        {/* Info box */}
        {!selectedState && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-sm">
            <strong>Tip:</strong> Start by selecting a state, then choose
            whether you want all ranges in that state or just ranges in a
            specific city.
          </div>
        )}

        {isLoading && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded text-sm">
            <strong>Please wait...</strong> Searching for shooting ranges
            {selectedCity !== "ALL Cities"
              ? ` in ${selectedCity}, ${selectedState}`
              : ` across ${selectedState}`}
            . This may take a moment.
          </div>
        )}
      </form>
    </div>
  );
}

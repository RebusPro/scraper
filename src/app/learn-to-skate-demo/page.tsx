/**
 * Demo page for the Learn to Skate USA specialized scraper
 */

"use client";

import { useState } from "react";
import { ScrapedContact } from "@/lib/scraper/types";
import LearnToSkateForm from "@/components/LearnToSkateForm";

export default function LearnToSkateDemoPage() {
  const [contacts, setContacts] = useState<ScrapedContact[]>([]);
  const [programs, setPrograms] = useState<unknown[]>([]);
  const [isShowingRaw, setIsShowingRaw] = useState(false);

  const handleResults = (
    newContacts: ScrapedContact[],
    rawPrograms: unknown[]
  ) => {
    setContacts(newContacts);
    setPrograms(rawPrograms);
  };

  return (
    <div className="container mx-auto p-4 max-w-5xl bg-gray-900">
      <div className="bg-gray-800 p-6 mb-8 rounded-lg border border-blue-200">
        <h1 className="text-3xl font-bold mb-4 text-blue-800">
          Learn to Skate USA Contact Finder
        </h1>
        <p className="mb-4">
          This specialized tool directly connects to the Learn to Skate USA API
          to find program contact information. Select a state or enter a ZIP
          code to find programs in that area.
        </p>
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> This is more reliable than the general-purpose
          scraper for this specific website.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <LearnToSkateForm onResults={handleResults} />
        </div>

        <div className="md:col-span-2">
          {contacts.length > 0 ? (
            <div className="bg-gray-800 shadow-md rounded p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Results</h2>
                <div className="flex items-center">
                  <button
                    onClick={() => setIsShowingRaw(!isShowingRaw)}
                    className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                  >
                    {isShowingRaw ? "Show Formatted" : "Show Raw Data"}
                  </button>
                </div>
              </div>

              {isShowingRaw ? (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Raw Program Data:</h3>
                  <pre className="bg-gray-800 p-4 rounded overflow-auto max-h-[500px] text-sm">
                    {JSON.stringify(programs, null, 2)}
                  </pre>
                </div>
              ) : (
                <>
                  <p className="mb-4">Found {contacts.length} contacts</p>
                  <div className="space-y-4">
                    {contacts.map((contact, index) => (
                      <div
                        key={index}
                        className="border rounded-lg p-4 hover:bg-gray-50"
                      >
                        <p className="font-semibold text-blue-700">
                          {contact.email}
                        </p>
                        {contact.name && (
                          <p>
                            <span className="font-medium">Program:</span>{" "}
                            {contact.name}
                          </p>
                        )}
                        {contact.phone && (
                          <p>
                            <span className="font-medium">Phone:</span>{" "}
                            {contact.phone}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-8 text-center flex items-center justify-center h-full">
              <div>
                <h3 className="text-lg font-medium text-gray-500 mb-2">
                  No results yet
                </h3>
                <p className="text-gray-400">
                  Select a state or enter a ZIP code to find skating programs
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">How It Works</h2>
        <p className="mb-4">
          This specialized tool bypasses the limitations of traditional web
          scraping by directly connecting to the Learn to Skate USA API. When
          you select a state or enter a ZIP code:
        </p>
        <ol className="list-decimal pl-5 space-y-2 mb-4">
          <li>Our backend API makes a request to the Learn to Skate USA API</li>
          <li>The API returns program data including contact information</li>
          <li>
            We extract and format the email addresses and other contact details
          </li>
          <li>The results are displayed in a user-friendly format</li>
        </ol>
        <p>
          For more technical details, see the{" "}
          <a href="#" className="text-blue-600 hover:underline">
            Learn-To-Skate-Solution.md
          </a>{" "}
          documentation.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import ScrapeForm from "@/components/ScrapeForm";
import ResultsDisplay from "@/components/ResultsDisplay";
import { ScrapingOptions, ScrapingResult } from "@/lib/scraper/types";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [result, setResult] = useState<ScrapingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (url: string, options: ScrapingOptions) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, options }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to scrape website");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error("Error scraping website:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (format: "xlsx" | "csv") => {
    if (!result) return;

    setIsDownloading(true);

    try {
      // Instead of triggering a new scrape, send the existing result to a new endpoint
      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ result, format }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate export file");
      }

      // Get the file as a blob
      const blob = await response.blob();

      // Create URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link element
      const link = document.createElement("a");
      link.href = url;

      // Get filename from Content-Disposition header or generate default one
      const contentDisposition = response.headers.get("Content-Disposition");
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1].replace(/"/g, "")
        : `contacts_${new Date().getTime()}.${format}`;

      link.setAttribute("download", filename);
      document.body.appendChild(link);

      // Trigger the download
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading file:", err);
      setError(err instanceof Error ? err.message : "Failed to download file");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
            Email Harvester
          </h1>
          <p className="mt-3 text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
            Extract email addresses and contact information from websites
          </p>
        </div>

        {error && (
          <div className="mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-md p-4">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <ScrapeForm onSubmit={handleSubmit} isLoading={isLoading} />

        {result && (
          <ResultsDisplay
            result={result}
            onDownload={handleDownload}
            isDownloading={isDownloading}
          />
        )}

        <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Use responsibly and in accordance with website terms of service and
            privacy policies.
          </p>
        </footer>
      </div>
    </div>
  );
}

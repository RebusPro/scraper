import React from "react";
import { ScrapedContact, ScrapingResult } from "@/lib/scraper/types";
import styles from "@/styles/ScrapeProgress.module.css";

interface ScrapeProgressDisplayProps {
  // Original required props
  inProgress?: boolean;
  processedUrls?: number;
  totalUrls?: number;
  results?: ScrapedContact[] | ScrapingResult[];
  errors?: { url: string; error: string }[];
  remainingUrls?: string[];
  onCancel?: () => void;

  // For backward compatibility with the page implementation
  current?: number;
  total?: number;
}

const ScrapeProgressDisplay: React.FC<ScrapeProgressDisplayProps> = ({
  inProgress,
  processedUrls,
  totalUrls,
  results = [],
  errors = [],
  remainingUrls = [],
  onCancel = () => {},
  // Map compatibility props to internal ones
  current,
  total,
}) => {
  // Use compatibility props if original props are not provided
  const effectiveProcessedUrls = processedUrls ?? current ?? 0;
  const effectiveTotalUrls = totalUrls ?? total ?? 0;
  const isInProgress =
    inProgress ?? (current !== undefined && total !== undefined);

  const percentComplete =
    effectiveTotalUrls > 0
      ? Math.round((effectiveProcessedUrls / effectiveTotalUrls) * 100)
      : 0;

  // Categorize results by status
  const succeeded = effectiveProcessedUrls - errors.length;
  const emailsFound = results.length;

  return (
    <div
      className={
        "bg-white dark:bg-gray-800 p-4 rounded shadow " + styles.container
      }
    >
      <h2 className={"text-white text-xl font-bold pb-4"}>Scraping Progress</h2>

      {isInProgress && (
        <>
          <div className={styles.progressBarContainer}>
            <div
              className={styles.progressBar}
              style={{ width: `${percentComplete}%` }}
            ></div>
          </div>

          <div className={styles.progressDetails}>
            <p>
              <strong>
                {" "}
                <span className="text-white">{effectiveProcessedUrls}</span>
              </strong>{" "}
              <span className="text-gray-400">of </span>
              <strong>
                <span className="text-white">{effectiveTotalUrls}</span>
              </strong>{" "}
              <span className="text-gray-400">websites processed </span>
              <span className="text-white">({percentComplete})%</span>
            </p>
            <div className={styles.statusCounts}>
              <div className={styles.statusItem}>
                <span className={styles.successDot}></span>
                <span className="text-white">Success: {succeeded}</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.errorDot}></span>
                <span className="text-white">Errors: {errors.length}</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.emailDot}></span>
                <span className="text-white">Emails found: {emailsFound}</span>
              </div>
            </div>
          </div>

          {onCancel && (
            <div className={styles.cancelButtonContainer}>
              <button
                className={styles.cancelButton}
                onClick={onCancel}
                title="Cancel the scraping process"
              >
                Stop Scraping
              </button>
            </div>
          )}
        </>
      )}

      {!isInProgress && effectiveProcessedUrls > 0 && (
        <div className={styles.summaryContainer}>
          <h3>Scraping Summary</h3>
          <p>
            <strong>{effectiveProcessedUrls}</strong> websites processed
            <br />
            <strong>{succeeded}</strong> successful
            <br />
            <strong>{errors.length}</strong> with errors
            <br />
            <strong>{emailsFound}</strong> emails found
          </p>
        </div>
      )}

      {errors.length > 0 && (
        <div className={styles.errorContainer}>
          <h3>Issues Encountered</h3>
          <div className={styles.errorList}>
            {errors.slice(0, 5).map((error, index) => (
              <div key={index} className={styles.errorItem}>
                <strong>
                  {error.url ? new URL(error.url).hostname : "Unknown domain"}
                </strong>
                <span className={styles.errorMessage}>
                  {error.error?.includes("ENOTFOUND")
                    ? "Site not found"
                    : error.error?.includes("ETIMEDOUT")
                    ? "Connection timed out"
                    : error.error?.includes("CERT_")
                    ? "SSL certificate error"
                    : error.error?.includes("403")
                    ? "Access denied (403)"
                    : error.error?.includes("ECONNRESET")
                    ? "Connection reset"
                    : "Error processing site"}
                </span>
              </div>
            ))}
            {errors.length > 5 && (
              <div className={styles.moreErrors}>
                +{errors.length - 5} more errors
              </div>
            )}
          </div>
        </div>
      )}

      {/* Show currently processing URLs */}
      {isInProgress && remainingUrls.length > 0 && (
        <div className={styles.processingContainer}>
          <h3>Currently Processing</h3>
          <div className={styles.processingUrl}>
            {new URL(remainingUrls[0]).hostname}
            <div className={styles.spinner}></div>
          </div>
          {remainingUrls.length > 1 && (
            <div className={styles.queuedUrls}>
              <strong>Next up:</strong>{" "}
              {remainingUrls
                .slice(1, 3)
                .map((url) => new URL(url).hostname)
                .join(", ")}
              {remainingUrls.length > 3 && ` +${remainingUrls.length - 3} more`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScrapeProgressDisplay;

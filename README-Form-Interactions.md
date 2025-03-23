# Form Interaction Guide for Web Scraper

This guide explains how to use the enhanced form interaction capabilities of the web scraper to extract data from websites that require form submissions, searches, or interactive elements to reveal contact information.

## Overview

Many websites don't display contact information directly on the first page load. Instead, they require users to:

- Fill out search forms (like the Learn to Skate USA website)
- Select options from dropdowns
- Click buttons to reveal content
- Navigate through multi-step processes

The form interaction feature allows the scraper to automate these actions, making it possible to extract data from these interactive websites.

## How It Works

The scraper uses Puppeteer (headless browser) to:

1. Load the target website
2. Fill in form fields (text, select, checkbox, radio)
3. Click submit/search buttons
4. Wait for results to load
5. Extract email addresses and contact information from the results

## Configuration Options

The form interaction feature is controlled through the `formInteraction` option with these properties:

| Option                 | Type    | Description                                |
| ---------------------- | ------- | ------------------------------------------ |
| `enabled`              | boolean | Turn on/off form interaction functionality |
| `fields`               | array   | List of form fields to interact with       |
| `submitButtonSelector` | string  | CSS selector for the submit/search button  |
| `waitForSelector`      | string  | Element that indicates results have loaded |
| `waitTime`             | number  | Time to wait after form submission (ms)    |

### Field Configuration

Each form field in the `fields` array requires:

| Property   | Description                | Example                                       |
| ---------- | -------------------------- | --------------------------------------------- |
| `selector` | CSS selector for the field | `"#state-input"`                              |
| `value`    | Value to enter/select      | `"California"`                                |
| `type`     | Field type                 | `"text"`, `"select"`, `"checkbox"`, `"radio"` |

## Example: Learn to Skate USA

To scrape the Learn to Skate USA website which requires selecting a state and clicking search:

```javascript
import { WebScraper } from "../src/lib/scraper";

const scraper = new WebScraper({
  useHeadless: true, // Required for form interaction
  formInteraction: {
    enabled: true,
    fields: [
      {
        selector: 'input[name="State"]',
        value: "Colorado",
        type: "text",
      },
    ],
    submitButtonSelector: "button.search-programs-button",
    waitForSelector: ".program-listing",
    waitTime: 3000, // Fallback if selector isn't found
  },
});

const result = await scraper.scrapeWebsite(
  "https://www.learntoskateusa.com/findaskatingprogram/#mapListings"
);
```

## Using the UI

The scraper UI includes form interaction options under the "Advanced Options" section:

1. Check "Enable form interaction"
2. Enter the Submit Button Selector
3. (Optional) Specify a Wait For Element Selector
4. Set the Wait Time in milliseconds
5. Add form fields by clicking "Add Field" (for each field to interact with)

## Common Selectors

Finding the right CSS selectors is crucial. Here are tips:

- For forms: `form`, `form#search-form`
- For inputs: `input[name="searchTerm"]`, `#search-input`
- For selects: `select#state-dropdown`, `select[name="state"]`
- For buttons: `button[type="submit"]`, `.search-button`, `#submitBtn`
- For results: `.results-container`, `#search-results`, `.listing-item`

## Troubleshooting

If the scraper isn't finding information:

1. Check that selectors are correct (use browser DevTools to verify)
2. Increase the wait time (some sites load slowly)
3. Verify the form values are valid (e.g., state names must match what the site expects)
4. Try with different form fields or combinations
5. Check the browser console for errors during scraping

## Advanced: Multi-step Forms

For multi-step forms or complex interactions, you may need to create a custom implementation. The base form interaction handles common cases but can be extended for more complex scenarios.

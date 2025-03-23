# Learn to Skate USA Specialized Solution

After analyzing the issue with the Learn to Skate USA website, I've implemented a specialized solution that directly interacts with their API to retrieve program contact information reliably.

## The Problem

The website at `https://www.learntoskateusa.com/findaskatingprogram/#mapListings` uses a form to search for skating programs, but our standard scraper only found generic email addresses like `MemberServices@learntoskateusa.com`.

This happens because:

1. The actual program data is loaded via API calls rather than being embedded in the HTML
2. The website's form submits to a backend API endpoint that returns JSON data
3. Our standard network interception wasn't capturing this API response correctly

## The Solution

I've created three specialized files to handle this case:

1. **Direct API Endpoint**: A specialized API route that directly calls the Learn to Skate USA's internal API
2. **Specialized Form Component**: A React component that provides a better user interface for searching programs
3. **Enhanced Network Monitoring**: Improved the scraper's ability to intercept and extract data from network responses

## How to Use the Solution

### Option 1: Use the Specialized Form Component (Recommended)

1. Import and add the `LearnToSkateForm` component to your page:

```jsx
import LearnToSkateForm from "@/components/LearnToSkateForm";
import { useState } from "react";

export default function LearnToSkatePage() {
  const [results, setResults] = useState([]);
  const [rawData, setRawData] = useState([]);

  const handleResults = (contacts, programs) => {
    setResults(contacts);
    setRawData(programs);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        Learn to Skate USA Program Finder
      </h1>
      <LearnToSkateForm onResults={handleResults} />

      {results.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-2">Results</h2>
          <p>Found {results.length} contacts</p>
          <div className="mt-4">
            {results.map((contact, index) => (
              <div key={index} className="mb-4 p-4 border rounded">
                <p>
                  <strong>Email:</strong> {contact.email}
                </p>
                {contact.name && (
                  <p>
                    <strong>Name:</strong> {contact.name}
                  </p>
                )}
                {contact.phone && (
                  <p>
                    <strong>Phone:</strong> {contact.phone}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Option 2: Use the API Endpoint Directly

If you prefer to use the API endpoint directly:

```javascript
// Example of calling the API endpoint
const fetchLearnToSkatePrograms = async (stateId, zipCode, programName) => {
  try {
    const response = await fetch("/api/scrape-mapListings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state: stateId, // e.g., "48" for Washington state
        zipCode: zipCode, // e.g., "98101"
        programName: programName, // Optional
      }),
    });

    const data = await response.json();
    console.log("Programs found:", data.programs);
    console.log("Email contacts:", data.emails);

    return data;
  } catch (error) {
    console.error("Error fetching programs:", error);
    return { emails: [], programs: [] };
  }
};
```

### Option 3: Use the Enhanced Scraper (Advanced)

The core scraper has been enhanced to better handle websites that load data via API calls. This is useful for other similar websites.

```javascript
import { WebScraper } from "../src/lib/scraper";

// Create a scraper with the enhanced network monitoring
const scraper = new WebScraper({
  useHeadless: true,
  formInteraction: {
    enabled: true,
    fields: [
      {
        selector: "#mapStateId",
        value: "48", // Washington state
        type: "select",
      },
      {
        selector: "#zipSelect",
        value: "100", // 100 mile radius
        type: "select",
      },
    ],
    submitButtonSelector: "#searchProgramsSubmitBtn",
    waitTime: 5000, // 5 seconds
  },
});

// Run the scraper
const result = await scraper.scrapeWebsite(
  "https://www.learntoskateusa.com/findaskatingprogram/#mapListings"
);
```

## Technical Details

### How the Direct API Approach Works

1. We analyzed the network traffic while using the Learn to Skate USA website and identified their API endpoint that returns program data.
2. We created a dedicated API route in our application that makes requests to this endpoint.
3. When a user selects a state or enters a zip code, our API makes a request to the Learn to Skate USA API and extracts the contact information.
4. The extracted data is then formatted and returned to the frontend.

### Enhanced Network Monitoring

For the core scraper, I've improved the ability to intercept network traffic:

1. Added Chrome DevTools Protocol (CDP) session to monitor network.
2. Implemented better response handling for JSON data.
3. Added support for different API response formats.

## Troubleshooting

If you encounter issues:

1. **No results**: Try a different state or zip code. Some areas may have more programs than others.
2. **API changes**: If the Learn to Skate USA website changes their API, our dedicated endpoint may need to be updated.
3. **Rate limiting**: If you make too many requests in a short period, the API might temporarily block your IP address.

## Looking Forward

This specialized solution demonstrates how to handle websites that load data dynamically through APIs. The techniques used here can be applied to other similar websites where traditional scraping doesn't work effectively.

If you encounter other websites with similar challenges, consider:

1. Examining network traffic to identify API endpoints
2. Creating dedicated handlers for specific sites
3. Using the enhanced scraper with better network monitoring capabilities

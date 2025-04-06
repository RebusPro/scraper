// Example script for using the Learn to Skate USA specialized scraper

/**
 * Demonstrates how to use the specialized API endpoint to fetch data from Learn to Skate USA
 */

// Direct API call example
async function fetchProgramsDirectAPI() {
  try {
    const response = await fetch('/api/scrape-learn-to-skate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state: '48',      // Washington state (48)
        zipCode: '',      // Optional
        programName: ''   // Optional 
      })
    });

    const data = await response.json();
    console.log(`Found ${data.emails?.length || 0} contacts`);
    return data;
  } catch (error) {
    console.error('Error fetching programs:', error);
    return null;
  }
}

// Example of configuring the generic scraper for Learn to Skate USA
const scraperConfig = {
  url: 'https://www.learntoskateusa.com/findaskatingprogram/#mapListings',
  options: {
    useHeadless: true,
    formInteraction: {
      enabled: true,
      fields: [
        {
          selector: '#mapStateId',
          value: '48', // Washington state
          type: 'select'
        },
        {
          selector: '#zipSelect',
          value: '100', // 100 mile radius
          type: 'select'
        }
      ],
      submitButtonSelector: '#searchProgramsSubmitBtn',
      waitTime: 5000 // 5 seconds wait time
    }
  }
};

// Run this script with:
// 1. Navigate to /learn-to-skate-demo
// 2. Select "Washington" from the dropdown
// 3. Click "Find Programs"
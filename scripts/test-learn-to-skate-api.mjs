import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/**
 * Test script for the Learn to Skate USA API
 * This script directly calls the API endpoint and saves the results
 * to a JSON file for inspection.
 */

// Setup proper __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const OUTPUT_DIRECTORY = path.join(__dirname, '../api-test-results');
const OUTPUT_FILE = 'wyoming-skating-programs.json';
const STATE_ID = '50'; // Wyoming state ID

async function testLearnToSkateAPI() {
  console.log('Starting Learn to Skate USA API test...');
  console.log(`Testing with state ID: ${STATE_ID} (Wyoming)`);

  try {
    // Create the output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIRECTORY)) {
      fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
      console.log(`Created directory: ${OUTPUT_DIRECTORY}`);
    }

    // Make the API request directly using axios
    console.log('Making API request to Learn to Skate USA API...');
    const response = await axios.post('http://localhost:3000/api/scrape-learn-to-skate', {
      state: STATE_ID,
      zipCode: '',
      programName: '',
    });

    // Log basic stats about the response
    const emailCount = response.data.emails?.length || 0;
    const programCount = response.data.programs?.length || 0;

    console.log(`API response received. Found ${emailCount} email contacts and ${programCount} programs.`);

    // Save the full response to a file
    const outputPath = path.join(OUTPUT_DIRECTORY, OUTPUT_FILE);
    fs.writeFileSync(
      outputPath,
      JSON.stringify(response.data, null, 2)
    );

    console.log(`Full API response saved to: ${outputPath}`);

    // Extract and display the email contacts for quick verification
    if (emailCount > 0) {
      console.log('\nFound the following email contacts:');
      response.data.emails.forEach((contact, index) => {
        console.log(`\n--- Contact ${index + 1} ---`);
        console.log(`Email: ${contact.email}`);
        console.log(`Name: ${contact.name || 'N/A'}`);
        console.log(`Phone: ${contact.phone || 'N/A'}`);
        console.log(`Website: ${contact.url || 'N/A'}`);
      });
    }

    // Create a CSV version for easy viewing in Excel/spreadsheet apps
    const csvRows = ['Email,Program Name,Phone,Website,Source'];
    if (emailCount > 0) {
      response.data.emails.forEach(contact => {
        csvRows.push(`"${contact.email}","${contact.name || ''}","${contact.phone || ''}","${contact.url || ''}","${contact.source || ''}"`);
      });

      fs.writeFileSync(
        path.join(OUTPUT_DIRECTORY, 'wyoming-skating-programs.csv'),
        csvRows.join('\n')
      );
      console.log(`\nCSV version also saved to: ${path.join(OUTPUT_DIRECTORY, 'wyoming-skating-programs.csv')}`);
    }

    console.log('\nTest completed successfully.');
  } catch (error) {
    console.error('Error during API test:', error);

    if (error.response) {
      // Save the error response for debugging
      fs.writeFileSync(
        path.join(OUTPUT_DIRECTORY, 'api-error.json'),
        JSON.stringify({
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        }, null, 2)
      );
      console.error('Error response saved to:', path.join(OUTPUT_DIRECTORY, 'api-error.json'));
    }
  }
}

// Run the test
testLearnToSkateAPI();
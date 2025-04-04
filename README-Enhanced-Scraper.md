# Coach Email Extractor

This tool helps you extract coach emails, names, and titles from websites for your marketing campaigns. It's designed to be easy to use for non-technical users while being powerful enough to handle complex websites.

## How to Use the Web Interface

The web interface provides an easy way to extract emails from coaching websites without requiring any technical knowledge.

### Option 1: Starting the Web Interface

1. Open a terminal/command prompt
2. Navigate to the project folder
3. Run the following command:
   ```
   npm run dev
   ```
4. Open your web browser and go to: http://localhost:3000

### Option 2: Using the Web Interface

1. **Upload an Excel or CSV file**:

   - Click on "Upload Excel/CSV" and select your file
   - The file should contain a column with website URLs
   - Alternatively, click on "Paste URLs" to enter website URLs manually

2. **Process the URLs**:

   - After uploading or pasting URLs, click the "Process URLs" button
   - Then click "Start Scraping" to begin extraction

3. **View Results**:

   - The system will show real-time progress as it processes each website
   - When complete, you'll see a table of all extracted emails and contact information

4. **Download Results**:
   - Click "Download as Excel" or "Download as CSV" to save the results
   - The downloaded file will contain all extracted contacts with their source websites

## Using the Batch Script Directly

For processing large lists of websites without the web interface:

1. Make sure you have an Excel or CSV file containing website URLs
2. Open a terminal/command prompt in the project folder
3. Run:
   ```
   node examples/batch-coach-scraper.mjs path/to/your/excel-file.xlsx
   ```
4. The script will process all URLs and save results to an Excel file in the `output` folder

## How It Works

The Coach Email Extractor uses advanced techniques to extract contact information:

1. **Deep Scanning**: The system follows links to contact pages and coach directories
2. **Dynamic Content Handling**: Works with JavaScript-heavy sites that other scrapers miss
3. **Intelligent Name Extraction**: Attempts to match emails with coach names and titles
4. **Email Format Detection**: Identifies even obfuscated or protected email addresses
5. **Automatic Duplicate Removal**: Ensures clean, unique contact lists

## Troubleshooting

### No Results Found

If no results are found for a specific website:

1. **Check URL format**: Make sure the URL is correct and includes http:// or https://
2. **Try a more specific page**: Instead of the homepage, try linking directly to a "Coaches", "Staff", or "Contact" page
3. **Check if the site needs login**: Some sites hide contact information behind login pages
4. **Try the batch script**: Sometimes the batch script works better for certain sites

### Slow Processing

For websites that take a long time to process:

1. Process fewer websites at once
2. Use the batch script for large lists (it's optimized for background processing)
3. Try during off-peak hours when websites may load faster

## Sample Website Lists

We've included sample files to help you get started:

- `public/sample-websites.csv`: Contains example coaching websites for testing
- You can use this as a template for your own website lists

## Success Stories

This tool has been successfully used for:

- Hockey coaching email campaigns
- Figure skating instructor outreach
- Sport organization marketing
- Tournament and event promotion

## Advanced Features

The system includes several advanced features for special cases:

1. **Alternative Email Formats**: For some coaches, multiple possible email formats are provided
2. **URL Normalization**: Automatically fixes and standardizes website URLs
3. **Intelligent Scraping**: Adapts its approach based on website structure

---

If you have any questions about using this tool, please contact the developer for assistance.

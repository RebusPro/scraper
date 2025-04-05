# Coach Email Scraper

A powerful web application that extracts real email addresses, names, and positions of coaches from sports websites for marketing campaigns.

## Key Features

- **Extract Real Emails Only** - No guessing or generating email addresses
- **Dynamic Content Support** - Specialized handling for sites like hockey.travelsports.com
- **Smart Name & Position Detection** - Extracts full context around email addresses
- **Excel Integration** - Import website lists and export contact data
- **User-Friendly Interface** - Designed for non-technical managers

## How to Use

1. **Start the application**

   ```
   npm run dev
   ```

2. **Choose scanning intensity**

   - Light: Fast scanning for simple sites
   - Standard: Balanced approach for most websites
   - Thorough: Deep scanning for complex sites with dynamic content

3. **Upload or paste website URLs**

   - Upload an Excel file containing website URLs
   - Or paste URLs directly into the text area

4. **View results in real-time**

   - Watch as emails are extracted
   - View the count of contacts found
   - See name and position information when available

5. **Download results**
   - Export all contacts to Excel or CSV format
   - Ready to import into your marketing tools

## Scanning Modes Explained

### Light Mode

- Quick, surface-level scanning
- Only examines main page content
- Best for simple websites with easily accessible contact information
- Fastest option, but finds fewer contacts

### Standard Mode (Default)

- Balanced speed and thoroughness
- Examines main page and contact/about pages
- Works well with most coaching websites
- Recommended for most use cases

### Thorough Mode

- Deep, comprehensive scanning
- Follows more links and examines more pages
- Handles dynamic content and complex websites
- Best for sites like hockey.travelsports.com
- Takes more time but finds the most contacts

## Technical Implementation

### Email Extraction Strategy

The application uses a multi-layered approach to find real emails:

1. **Direct Email Extraction**

   - Scans page content for standard email patterns
   - Checks mailto: links
   - Looks for common email field patterns

2. **Contact Page Navigation**

   - Automatically finds and visits contact/staff pages
   - Examines about pages for contact information
   - Follows links to coach profile pages when available

3. **Dynamic Content Handling**

   - Detects dynamically loaded content
   - Waits for page to fully render
   - Scrolls to trigger lazy loading
   - Handles pagination and filtering interfaces

4. **Obfuscation Detection**
   - Identifies common email protection techniques
   - Decodes CloudFlare protected emails
   - Reassembles split email addresses

### Name & Position Extraction

The application extracts names and positions using context:

1. **Context Analysis**

   - Examines text surrounding each email
   - Looks for capitalized name patterns
   - Identifies common coaching title patterns

2. **Element Structure Analysis**
   - Analyzes HTML structure around emails
   - Identifies name/title elements in staff cards
   - Extracts structured data from coach profiles

## Troubleshooting

### No Emails Found

If no emails are found on a site:

1. **Try Thorough Mode**

   - For dynamic sites, use the "Thorough" scanning mode
   - This enables special handling for complex pages

2. **Check URL Format**

   - Ensure URLs include the protocol (https://)
   - Make sure you're using the main domain, not a subdomain

3. **Verify Site Structure**
   - Some sites hide contact information behind forms
   - Check if the site actually contains visible email addresses

### Performance Issues

If scanning takes too long:

1. **Start with Light Mode**

   - For simple sites, Light mode is much faster

2. **Limit Batch Size**
   - Process fewer sites at once
   - Break large lists into smaller batches

### Excel Import Issues

If your Excel file isn't recognized:

1. **Check Format**

   - URLs should be in a single column
   - File should be .xlsx or .csv format

2. **Simplify Content**
   - Remove unnecessary columns
   - Make sure URLs are properly formatted

## Technical Details

This application combines multiple technologies to provide powerful scraping capabilities:

- **Next.js** - React framework for the UI
- **Playwright** - Browser automation for dynamic content
- **Tailwind CSS** - Styling and UI components
- **ExcelJS** - Excel file parsing and generation

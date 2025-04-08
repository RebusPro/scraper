#Email Extractor

An enhanced tool to reliably extract coach contact information from websites for marketing campaigns.

## What's New

This version includes significant improvements to the email extraction capabilities:

- **Enhanced Email Detection**: Improved detection of real coach emails while filtering out false positives
- **Better Coach Name Association**: More advanced algorithms to pair emails with coach names and titles
- **Obfuscated Email Handling**: Support for various email protection techniques used on coaching websites
- **Robust Error Recovery**: Continue processing even when some websites fail

## Features

- **Upload CSV/Excel Files**: Batch process multiple websites at once
- **Real-Time Progress**: Monitor scraping progress with live updates
- **Download Results**: Export found contacts to Excel or CSV format
- **Customizable Settings**: Control scraping depth and behavior

## How It Works

The Coach Email Extractor uses advanced techniques to find real coach contact information:

1. **Smart Detection**: Analyzes web pages to identify coaching-related content
2. **Deep Scanning**: Follows relevant links like "Contact", "Staff", "Coaches", etc.
3. **Pattern Recognition**: Uses coach-specific patterns to extract contact information
4. **Verification**: Filters out generic emails and technical addresses that aren't real coach contacts
5. **Data Association**: Pairs emails with names and titles when available

## Usage

1. **Upload Websites List**: Either paste URLs or upload a CSV/Excel file containing website URLs
2. **Configure Settings**: Choose between gentle, standard, or aggressive scraping modes
3. **Start Scraping**: Click the "Start Scraping" button to begin the process
4. **Monitor Progress**: Watch real-time progress as the tool processes each website
5. **Download Results**: When completed, download the results in Excel or CSV format

## Best Practices

- **Use Quality Inputs**: Provide specific URLs to coach directories or contact pages when possible
- **Be Patient**: Complex websites may take longer to process
- **Try Different Settings**: If a website doesn't yield results, try with different scraping modes
- **Download Early**: You can download partial results while scraping continues

## Important Notes

- Some websites intentionally hide contact information or use anti-scraping techniques
- The tool only extracts real, confirmed emails that appear on the website - it never guesses
- Websites that require login may not yield complete results
- Some coaching websites only provide generic contact emails rather than individual coach emails

## Technical Improvements

For technical users, this version includes:

- Improved email pattern detection
- Better handling of HTML-encoded and obfuscated emails
- Enhanced filtering of false positives
- Integration with specialized coach directory processing
- More reliable name and title extraction
- Robustness against network errors and timeouts

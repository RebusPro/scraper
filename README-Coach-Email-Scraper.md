# Enhanced Coaching Website Email Scraper

This tool is specially designed for extracting coach emails, names, and titles from skating and hockey coaching websites, including those with dynamic content that traditional scrapers can't handle.

## 🚀 Major Improvements

- **Dynamic Content Support**: Successfully scrapes JavaScript-heavy websites that load content dynamically (like hockey.travelsports.com)
- **Specialized Directory Processing**: Automatically detects and applies specialized extraction techniques for coach directories
- **Excel Integration**: Upload Excel files with lists of websites and export comprehensive results
- **Non-Technical User Interface**: Designed for marketing managers without technical expertise
- **Name & Title Extraction**: Not just emails - also extracts names and titles/positions when available
- **Robust Navigation**: Intelligently explores contact and staff pages for maximum data collection

## 📋 How to Use

### Getting Started

1. Run the application with `npm run dev`
2. Open your browser to `http://localhost:3000`

### For Best Results

1. **Choose the Right Scraping Mode**:

   - **Aggressive**: Best for dynamic sites like hockey.travelsports.com
   - **Standard**: Good balance for most coaching websites
   - **Gentle**: For simple websites or when you want minimal server load

2. **Upload Options**:

   - **Excel/CSV**: Upload a spreadsheet containing website URLs
   - **Paste URLs**: Directly paste a list of URLs in the text area

3. **Excel Format**:
   - Include a column with website URLs (column header should contain "website", "url", or "link")
   - Download the template for a ready-to-use example
   - Additional columns will be preserved in your results

### Processing Dynamic Sites

Sites with dynamic content (like hockey.travelsports.com) require special handling:

1. Use "Aggressive" mode in the settings
2. Expect slightly longer processing times (the system needs to wait for dynamic content to load)
3. The system will automatically detect coach directories and apply specialized extraction techniques

## 🔍 How It Works

Our enhanced scraper uses a multi-layered approach:

1. **Initial Detection**: Identifies if the site is a coaching directory or sports-related website
2. **Specialized Processing**: Applies specific extraction techniques for known site patterns
3. **Dynamic Content Analysis**: Waits for JavaScript-loaded content and processes it
4. **Navigation Intelligence**: Automatically finds and explores contact/staff pages
5. **Contact Extraction**: Extracts emails, names, and titles with context awareness
6. **Email Generation**: For coaches without explicit emails, generates likely email formats

## 🧩 Key Features for Skating/Hockey Websites

- **Directory Specialization**: Optimized for coach/staff directory pages
- **Results Verification**: Confidence ratings show which emails were directly found vs. generated
- **Pagination Handling**: Automatically processes paginated staff listings
- **Filter Interaction**: Smart handling of filtering options in directories
- **Profile Visiting**: Can visit individual coach profiles for more complete information
- **Excel Integration**: Easy importing from your existing database and exporting for marketing

## 📢 Tips for Maximum Results

- **Include Related Pages**: Don't just scrape homepages - include the /coaches, /staff, or /contact URLs when available
- **Check Confidence Ratings**: In results, pay attention to confidence scores - "Confirmed" emails were directly found, while "Generated" require verification
- **Combine with Marketing Tools**: Export to Excel/CSV for easy import into your marketing platform
- **Batch Processing**: Process multiple websites at once for efficiency
- **Template Usage**: Use the provided Excel template for consistent formatting

## 🚫 Limitations

- Some websites actively block scraping with technical measures
- Email addresses displayed as images cannot be extracted
- Extremely complex JavaScript frameworks may limit extraction capabilities
- Generated emails should be verified before use in marketing campaigns

## 📊 Understanding Results

The results page shows:

- Total emails found per website
- Detailed view with names, titles, and confidence scores
- Export options (Excel/CSV)
- Statistics about the successful extraction rate

---

This tool is specifically enhanced for skating coach websites and similar sports coaching directories, with special attention to the dynamic content challenges faced by non-technical marketing managers.

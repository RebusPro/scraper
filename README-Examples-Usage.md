# Using the Example Scrapers

This guide explains how to use the example scripts we've created to enhance your scraping capabilities.

## Running the Example Scripts

The example scripts (`wiki-scraper-example.js`, `sports-directory-scraper.js`, etc.) are standalone Node.js files that demonstrate specific scraping techniques. There are two ways to use them:

### Option 1: Run Directly via Command Line

You can run these examples directly from your terminal:

```bash
# First, make sure you have Playwright browsers installed
npx playwright install

# Then, run any example script directly
node examples/wiki-scraper-example.js
node examples/sports-directory-scraper.js
```

To use this method, you need to first uncomment the script execution code at the bottom of each file. For example, in `wiki-scraper-example.js`, find this section:

```javascript
// Example usage (can be uncommented to run)
/*
scrapeFigureSkatingRinks()
  .then(contacts => {
    console.log('Scraping complete');
  })
  .catch(error => {
    console.error('Error:', error);
  });
*/
```

Remove the `/*` and `*/` comment markers, save the file, and then run it with Node.js.

### Option 2: Use the Email Harvester UI

The techniques shown in these examples are already integrated into the main Email Harvester application. To use them:

1. Open the Email Harvester web interface (run `npm run dev` and go to http://localhost:3000)
2. Enter the target URL (e.g., `https://figure-skating.fandom.com/wiki/List_of_ice_rinks_in_the_USA`)
3. Click "Show advanced options"
4. Check "Use browser rendering"
5. Check "Use Playwright engine"
6. Enable other appropriate options based on the site type:
   - For wikis: no additional settings needed
   - For form-based sites: enable form interaction and configure form fields
   - For directory sites: enable "Follow links" and set depth to 2

## Relationship Between Examples and the Main App

The example scripts are primarily for:

1. **Demonstration**: They show how to use the enhanced scraping capabilities
2. **Testing**: You can use them to test scraping on specific sites
3. **Learning**: They explain the techniques in a clear, focused way

The same functionality is available in the main Email Harvester web interface, where the options in the UI correspond to the configuration options in these scripts.

## Specific Example Usage

### Wiki Scraper

```bash
# Run the wiki scraper on the Figure Skating Fandom wiki
node examples/wiki-scraper-example.js
```

This will scrape the Figure Skating wiki, automatically expanding collapsible sections and tables, and extract genuine contact information while filtering out tracking emails.

### Sports Directory Scraper

```bash
# Run the sports directory scraper on Travel Sports Hockey coaches
node examples/sports-directory-scraper.js
```

This will scrape the main coaches directory page, and then visit individual coach profile pages to extract contact information.

### Learn To Skate Form-based Scraper

```bash
# Run the form interaction scraper on Learn To Skate USA
node examples/learn-to-skate-playwright-example.js
```

This will automate form filling and submission to access contact information behind search forms.

## Troubleshooting

If you get errors about missing Playwright browsers:

```bash
npx playwright install
```

If you get other Node.js errors, make sure you have all dependencies installed:

```bash
npm install
```

# Enhanced Dynamic Website Scraping

This update adds improved support for scraping dynamic websites that load content through JavaScript, AJAX, or require form interactions. We've implemented the Playwright engine which offers superior handling for complex websites compared to Puppeteer.

## New Features

- **Playwright Integration**: A more powerful browser automation engine that offers:

  - Superior auto-waiting mechanisms for dynamic content
  - Better handling of form interactions
  - Enhanced network monitoring capabilities
  - Multi-browser support (Chrome, Firefox, WebKit)
  - Improved resistance to bot detection

- **Advanced Email Filtering**: Automatically filters out non-contact emails such as:
  - Error tracking emails (Sentry, Wix monitoring)
  - System-generated messages
  - Placeholder addresses
  - Automated notification services
- **Special Site-Type Handling**:

  - Wiki-specific extraction for sites like Fandom with collapsible sections
  - Table data extraction for formatted contact information
  - Reference section processing for hidden contact details

- **Improved Form Interaction**: Better support for websites that require search forms or other interactive elements before displaying content.

- **Fallback Strategy**: If Playwright encounters issues, the scraper will automatically fall back to Puppeteer.

## When to Use Playwright vs. Puppeteer

- **Use Playwright for**:

  - Sites that require complex form submissions (search forms, filters)
  - Websites that heavily rely on AJAX/dynamic loading
  - Sites that might have bot detection
  - When you need to see emails that only appear after user interactions
  - The Learn To Skate USA example site

- **Use Puppeteer for** (still available):
  - Simpler JavaScript-rendered sites
  - When you just need basic browser rendering
  - Sites that work fine with the current implementation

## Installation Requirements

Before using the enhanced scraper with Playwright, you need to install the browser binaries:

```bash
npx playwright install
```

This one-time installation will download the necessary browser executables that Playwright uses to automate Chrome/Chromium, Firefox, and/or WebKit. Without this step, you'll see errors like:

```
Error: browserType.launch: Executable doesn't exist at C:\Users\...\headless_shell.exe
```

## Using the Enhanced Scraper

1. Enter the URL as before
2. Click "Show advanced options"
3. For dynamic websites:
   - Check "Use browser rendering"
   - Check "Use Playwright engine"
   - If the site requires search or filtering:
     - Check "Enable form interaction"
     - Add form fields with appropriate selectors and values
     - Set the submit button selector
     - Optionally specify a wait selector (element that indicates results have loaded)

## Example: Learn To Skate USA

To scrape the [Learn To Skate USA](https://www.learntoskateusa.com/findaskatingprogram/) website:

1. Enter: `https://www.learntoskateusa.com/findaskatingprogram/`
2. Under advanced options:
   - Check "Use browser rendering"
   - Check "Use Playwright engine"
   - Check "Enable form interaction"
3. Add a form field:
   - Selector: `#searchLocation`
   - Value: Your search term (e.g., "Alabama", "Chicago")
   - Type: Text Input
4. Set submit button selector: `#searchButton`

5. Set Wait For Element Selector: `.results-container`

6. Click "Scrape"

The scraper will navigate to the site, enter your search term, submit the form, wait for the results to load, and extract emails from both the visible content and any API responses.

## Example: Wiki Pages (like Figure Skating Fandom)

To effectively scrape wiki pages with hidden contact information:

1. Enter the wiki URL (e.g., `https://figure-skating.fandom.com/wiki/List_of_ice_rinks_in_the_USA`)
2. Under advanced options:
   - Check "Use browser rendering"
   - Check "Use Playwright engine"
   - No form interaction needed unless searching

The special wiki handling will:

- Expand any collapsed sections
- Process tables that often contain contact details
- Check reference sections for hidden links
- Filter out tracking/error-logging emails that aren't real contacts

## Technical Notes

- The Playwright implementation preserves all existing features while adding new capabilities
- It monitors network requests to capture data from API responses
- It provides more sophisticated waiting strategies to ensure dynamic content is fully loaded
- For optimal results on complex sites, try adjusting the wait time parameter
- Email filtering ensures you only get genuine contact information, not system-generated addresses

## Example: Sports Directory Sites

Many sports websites organize coaches or teams in directory listings, where each entity has its own profile page. Email addresses are often found on these individual profile pages rather than the main listing.

To effectively scrape sites like `hockey.travelsports.com/coaches`:

1. Enter the main directory URL
2. Under advanced options:
   - Check "Use browser rendering"
   - Check "Use Playwright engine"
   - Check "Follow links" and set depth to 2
   - Set a reasonable timeout (60+ seconds)

The enhanced scraper will:

- Load the main directory page
- Find all profile page links
- Visit each profile page to extract contact information
- Look for hidden email fields in contact forms

This approach is especially effective for sites that distribute contact information across many profile pages rather than listing it all on a single page.

See the following examples for complete implementations:

- `examples/learn-to-skate-playwright-example.js` - For form-based dynamic sites
- `examples/wiki-scraper-example.js` - For wiki pages with expandable content
- `examples/sports-directory-scraper.js` - For directory sites with profile pages

# UI Configuration Guide for Form Interactions

This guide provides step-by-step instructions for configuring the form interaction feature using the web UI, with a specific example for the Learn to Skate USA website.

## Step 1: Enter the URL

Enter the website URL in the main input field:

```
https://www.learntoskateusa.com/findaskatingprogram/#mapListings
```

## Step 2: Enable Advanced Options

Click on the "Show advanced options" link to expand the advanced settings.

## Step 3: Configure Basic Settings

1. Ensure "Use browser rendering" is checked (required for form interactions)
2. Check "Enable form interaction" to show the form interaction options

## Step 4: Configure Form Settings

### For the Learn to Skate USA website:

1. **Submit Button Selector**:
   Enter the ID of the search button:

   ```
   #searchProgramsSubmitBtn
   ```

2. **Wait Time**:
   Set a wait time of 3000ms (3 seconds) to allow the results to load after form submission

### Form Fields

Click "Add Field" to create a new form field entry:

#### For the State Dropdown:

1. **Selector**: `#mapStateId`
2. **Value**: `6` (for Colorado)
3. **Type**: Select "Select Dropdown" from the dropdown menu

If you also want to search for a specific program, add another field:

1. Click "Add Field" again
2. **Selector**: `#mapFacilityName`
3. **Value**: Enter the name of the program you're looking for
4. **Type**: Select "Text Input" from the dropdown menu

## Step 5: Start Scraping

Click the "Scrape" button to start the scraping process with the configured form interaction settings.

## Understanding the Form Elements

Based on the HTML provided, here's how each form element is configured:

### Program Name Input

```html
<input
  id="mapFacilityName"
  type="text"
  class="map-control form-control facility"
  placeholder="Program Name"
  style="display: block;"
/>
```

- Selector: `#mapFacilityName`
- Type: text
- Value: (optional, any program name you want to search for)

### State Dropdown

```html
<select
  id="mapStateId"
  class="map-control form-control state"
  name="StateId"
  style="display: block;"
>
  <option selected="selected" value="0">State</option>
  <option value="1">Alabama</option>
  <option value="2">Alaska</option>
  <!-- ... more options ... -->
  <option value="6">Colorado</option>
  <!-- ... more options ... -->
</select>
```

- Selector: `#mapStateId`
- Type: select
- Value: The actual value you need to use is the `value` attribute of the option, not the text.
  - For Colorado, use `6`
  - For California, use `5`
  - For New York, use `33`
  - Etc.

### Search Button

```html
<button id="searchProgramsSubmitBtn" class="btn btn-map-submit" type="button">
  Search Programs
</button>
```

- Selector: `#searchProgramsSubmitBtn`

## Tips for Testing

1. Start with a specific state to narrow down results
2. Be patient - the scraper needs time to interact with the form and wait for results
3. If no results are found, try:
   - Different states
   - Increasing the wait time
   - Checking the exact selector values in the browser's dev tools
4. Use the browser's developer tools (F12) to inspect elements and verify selectors

## Troubleshooting

If the scraper doesn't find any contacts:

1. Ensure the selectors match exactly what's in the HTML
2. Try with different states or programs
3. Increase the wait time if the website is slow to load results
4. Verify that the form interaction is properly enabled
5. Check that the values used for dropdowns match the option values in the HTML

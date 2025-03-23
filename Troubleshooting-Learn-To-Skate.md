# Troubleshooting: Learn to Skate USA Website Scraping

Based on your feedback, I understand that when scraping the Learn to Skate USA website, you're only getting generic emails like `MemberServices@learntoskateusa.com` rather than specific program contact information. Let me explain what's happening and suggest solutions.

## Analysis of the Issue

After examining the Learn to Skate USA website, I've identified several reasons why you might only be getting generic contact emails:

1. **Email Protection**: The website intentionally avoids exposing program-specific emails directly in the HTML to prevent scraping.

2. **Contact Form Usage**: Many programs use contact forms rather than displaying email addresses directly.

3. **Centralized Contact**: The organization funnels all initial contacts through their central member services email.

4. **JavaScript Rendering**: Some contact information might be loaded dynamically or obfuscated to prevent automated collection.

## What's Actually Happening

When you search for programs:

1. The form submission works correctly
2. Programs are displayed on the map and in results
3. The scraper successfully extracts any visible email addresses
4. But only organization-wide emails are exposed in the HTML

## Solutions and Workarounds

### 1. Follow Links to Detail Pages

The scraper is configured to follow links to detail pages. Make sure this is enabled:

```javascript
followLinks: true,
maxDepth: 2,
```

This will try to navigate to individual program pages that might contain contact information.

### 2. Try Different Search Parameters

Different states or regions might present information differently:

```javascript
fields: [
  {
    selector: "#mapStateId",
    value: "6", // Try different state codes (5 for California, 33 for New York, etc.)
    type: "select",
  },
];
```

### 3. Increase Wait Times

Sometimes contact information loads with delay:

```javascript
waitTime: 5000, // Increase to 5000ms (5 seconds) or more
```

### 4. Alternative Data Sources

If the website actively prevents email harvesting, consider these alternatives:

- Contact the organization directly for program information
- Look for program directories in PDF form that might be more scrapable
- Check for "Find a Program" exports or downloads on the official website

## Limitations of Automated Scraping

It's important to understand that many organizations deliberately make it difficult to bulk-collect contact information to:

1. Protect their members from spam
2. Control communication channels
3. Track and manage inquiries
4. Comply with privacy regulations

If you're seeing only `MemberServices@learntoskateusa.com` emails, it's likely that this is the only email address they're exposing in the HTML, and individual program contacts are either:

- Not present in the HTML at all
- Hidden behind contact forms
- Protected by JavaScript obfuscation
- Only available by contacting the central office first

## Next Steps

1. Try the updated example with increased wait times
2. Experiment with different states and search parameters
3. Consider if the generic contact might be a deliberate choice by the organization

If you need to collect program-specific contacts, you might need to contact Member Services directly and request this information for legitimate purposes.

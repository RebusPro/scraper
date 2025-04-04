# Email Harvester Filtering Improvements

This document describes the improvements made to filter out invalid data and focus on genuine contact information.

## Problem Identified

When scraping certain sites (like wikis and documentation sites), the scraper was:

1. Finding too many false positive "phone numbers" (dates, IDs, version numbers, etc.)
2. Including tracking/monitoring emails (like Sentry IDs) that aren't real contact information
3. Generating excessive placeholder emails for every numeric sequence it found

## Solution Implemented

### 1. Enhanced Email Filtering

We've added sophisticated filtering to exclude non-contact emails:

- **Domain Blocking**: Automatically filters out emails from tracking services (Sentry, Wix monitoring)
- **Pattern Detection**: Recognizes UUID-like patterns and system-generated email formats
- **Format Validation**: Checks for common patterns in real vs. automated emails

### 2. Improved Phone Number Detection

We've completely redesigned phone number detection to be much more selective:

- **Stricter Pattern Matching**: Uses a more precise regex to match valid phone formats
- **Format Exclusion Rules**: Specifically excludes formats like:

  - Long numeric sequences
  - Formats resembling dates (e.g., 2021-01-01)
  - Formats resembling version numbers (e.g., 1.2.3)
  - Formats that are too short or too long
  - Sequential patterns (123-456-7890)
  - Repeating patterns (111-111-1111)

- **Context Awareness**: Checks the character before a potential phone number to exclude version numbers
- **Limited Results**: Only shows phone-only contacts when fewer than 10 are found (to avoid noise)

### 3. Sanitization of Results

- Better email placeholder generation for phone-only contacts
- Proper sanitization of phone numbers used in email addresses
- Clear distinction between genuine contacts and generated placeholders

## How to Use

These improvements work automatically with the existing interface. The primary benefit is higher quality results with less noise, particularly for:

1. Wiki pages (like figure-skating.fandom.com)
2. Documentation sites
3. Sites with many numeric values that aren't phone numbers

The scraper will now focus on finding genuine contact information rather than treating every numeric sequence as a potential phone number.

## Example Improvement

**Before:**

```
Hundreds of "phone-only" placeholders for various dates, IDs, and numeric sequences
Various tracking emails like 8c4075d5481d476e945486754f783364@sentry.io
```

**After:**

```
Only genuine contact emails like:
dcarrick@flagstaffaz.gov
David.Carolus@flagstaffaz.gov
dchase@steamboatsprings.net
ncarelli@steamboatsprings.net
m.ret@live.com
James.Hanten@spectraxp.com
```

These improvements ensure you get only useful contact information from any site.

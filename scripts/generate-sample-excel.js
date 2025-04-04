// Generate a sample Excel file for testing the scraper
const XLSX = require('xlsx');

// Create the workbook and worksheet
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet([
  ['Website', 'Type'], // Headers
  ['https://hockey.travelsports.com/coaches', 'Hockey'],
  ['http://www.pointmallardpark.com/ice-complex/', 'Ice Rink'],
  ['http://www.playzonfuncenter.net', 'Fun Center'],
  ['https://www.yelp.com/biz/clanton-skating-rink-clanton-3', 'Skating Rink'],
  ['http://www.holidaysontheriver.com', 'Seasonal'],
  ['http://www.fungoneskatecenterDothan.com', 'Skate Center'],
  ['http://www.birminghambullshockey.com', 'Hockey Team'],
  ['https://www.skatecastledecatur.com', 'Skate Castle'],
  ['https://www.magictheatreonice.com', 'Ice Theatre'],
  ['https://www.anchoragewomenshockey.com', 'Women\'s Hockey'],
  ['https://www.northpenrec.com/npsa/ice-rink', 'Recreation Center']
]);

// Add the worksheet to the workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'Websites');

// Write the workbook to a file
XLSX.writeFile(workbook, 'public/sample-websites.xlsx');

console.log('Sample Excel file created at public/sample-websites.xlsx');
// populate.js

// Load environment variables from .env file
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Get Supabase credentials from .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY;

// Check if keys are loaded
if (!supabaseUrl || !supabaseServiceKey || !googleBooksApiKey) {
  console.error('Error: Missing API keys in .env file.');
  console.log('Please check your .env file in the backend-script folder.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Fetches books from the Google Books API
 * @param {string} query - The search term (e.g., "fiction", "programming")
 * @param {number} startIndex - The page index to fetch (Google's pagination)
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of book items
 */
async function fetchGoogleBooks(query, startIndex = 0) {
  const maxResults = 40; // Google's max is 40 per request
  const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&startIndex=${startIndex}&maxResults=${maxResults}&key=${googleBooksApiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google API error (${response.status}): ${errorData.error.message}`);
    }
    const data = await response.json();
    return data.items || []; // Return the array of books
  } catch (error) {
    console.error('Error fetching from Google Books:', error.message);
    return [];
  }
}

/**
 * Transforms Google Book data to match our Supabase 'books' table schema
 * @param {Array<Object>} googleBooks - Array of book items from Google API
 * @returns {Array<Object>} - An array of book objects ready for Supabase
 */
function transformBookData(googleBooks) {
  return googleBooks
    .map((item) => {
      const vol = item.volumeInfo;
      const isbn13 = vol.industryIdentifiers?.find(
        (id) => id.type === 'ISBN_13'
      );
      const isbn10 = vol.industryIdentifiers?.find(
        (id) => id.type === 'ISBN_10'
      );

      // We need at least an ISBN (for uniqueness) and a title.
      if (!vol.title || !vol.authors || (!isbn13 && !isbn10)) {
        return null; // Skip this book if essential data is missing
      }

      // Check for valid publication date
      let publicationDate = '1970-01-01'; // Default date
      if (vol.publishedDate) {
        // Google dates can be "2023" or "2023-01" or "2023-01-15"
        // Our SQL schema needs a full date.
        if (vol.publishedDate.length === 4) { // "2023"
          publicationDate = `${vol.publishedDate}-01-01`;
        } else if (vol.publishedDate.length === 7) { // "2023-01"
          publicationDate = `${vol.publishedDate}-01`;
        } else if (vol.publishedDate.length >= 10) { // "2023-01-15"
          publicationDate = vol.publishedDate.substring(0, 10);
        }
      }

      return {
        // This matches your 'books' table schema
        title: vol.title,
        author: vol.authors.join(', '), // Join if multiple authors
        isbn: isbn13 ? isbn13.identifier : isbn10.identifier,
        description:
          vol.description || 'No description available.',
        genre: vol.categories ? vol.categories[0].toLowerCase().split(' ')[0] : 'general', // Take first category, no spaces
        publication_date: publicationDate,
        cover_image: vol.imageLinks?.thumbnail || null,
      };
    })
    .filter(Boolean); // Filter out any 'null' entries
}

/**
 * Main function to run the population script
 */
async function main() {
  // -----------------------------------------------------------------
  // ----- YOU CAN CHANGE THESE VALUES -----
  const searchTerm = 'best seller'; // <-- Search term (e.g., "python", "history", "fantasy")
  const totalBooksToFetch = 200; // <-- Total books you want. (5 requests of 40)
  // -----------------------------------------------------------------

  const booksPerPage = 40;
  
  console.log(`Starting script to fetch ${totalBooksToFetch} books for term: "${searchTerm}"...`);

  let allBooksToInsert = [];

  for (let i = 0; i < Math.ceil(totalBooksToFetch / booksPerPage); i++) {
    const startIndex = i * booksPerPage;
    console.log(`Fetching page ${i + 1} (startIndex: ${startIndex})...`);
    
    const googleBooks = await fetchGoogleBooks(searchTerm, startIndex);
    if (googleBooks.length === 0) {
        console.log('No more books found from Google. Stopping.');
        break;
    }

    const booksForSupabase = transformBookData(googleBooks);
    
    allBooksToInsert.push(...booksForSupabase);
    
    // Wait a moment to avoid hitting API rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (allBooksToInsert.length === 0) {
    console.log('No books found or an error occurred. Exiting.');
    return;
  }

  console.log(`...Fetched ${allBooksToInsert.length} valid books. Now inserting into Supabase...`);

  // Insert data into your 'books' table
  // 'onConflict: 'isbn'' tells Supabase to ignore duplicates based on the ISBN.
  // This is based on your SQL migration file.
  const { data, error } = await supabase
    .from('books')
    .insert(allBooksToInsert, { onConflict: 'isbn' }); // Use onConflict to avoid errors on duplicate books

  if (error) {
    console.error('Error inserting data into Supabase:', error.message);
  } else {
    console.log(`Successfully processed ${allBooksToInsert.length} books!`);
    console.log("Check your 'books' table in the Supabase dashboard.");
  }
}

// Run the main function
main().catch(console.error);
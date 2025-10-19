import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Book } from '../types';

export function useBooks(searchTerm?: string, genre?: string, page = 1, limit = 12) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    // console.log('useBooks useEffect triggered. Fetching books...'); // Optional: Remove log
    fetchBooks();
  }, [searchTerm, genre, page, limit]);

  const fetchBooks = async () => {
    // console.log('fetchBooks started...'); // Optional: Remove log
    try {
      setLoading(true);
      setError(null);

      // --- Reverted Query ---
      let query = supabase
        .from('books')
        .select('*, reviews(rating)', { count: 'exact' }); // <-- Put reviews(rating) back

      // Re-apply filters
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
      }
      if (genre && genre !== 'all') {
        query = query.eq('genre', genre);
      }
      // --- End Reverted Query ---

      // Apply range and order
      query = query
        .range((page - 1) * limit, page * limit - 1)
        .order('created_at', { ascending: false });

      // console.log('Query built. About to execute await...'); // Optional: Remove log

      const { data, error: fetchError, count } = await query;

      // console.log('Await finished. Checking for errors...'); // Optional: Remove log

      if (fetchError) {
         console.error('Supabase fetch error:', fetchError); // Keep error log
         throw fetchError;
      }

      // console.log('Supabase query successful. Data:', data, 'Count:', count); // Optional: Remove log

      // --- Reverted Rating Calculation ---
      const booksWithRatings = data?.map(book => {
        const reviews = book.reviews || []; // Use reviews again
        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0
          ? reviews.reduce((sum: number, review: any) => sum + review.rating, 0) / totalReviews
          : 0;

        return {
          ...book,
          reviews: undefined, // Still remove nested array
          average_rating: Math.round(averageRating * 10) / 10,
          total_reviews: totalReviews,
        };
      }) || [];
      // --- End Reverted Rating Calculation ---

      setBooks(booksWithRatings); // Use this data again
      setTotalCount(count || 0);
      // console.log('Books state updated.'); // Optional: Remove log

    } catch (err) {
      console.error('Error in fetchBooks catch block:', err); // Keep error log
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      // console.log('fetchBooks finally block. Setting loading to false.'); // Optional: Remove log
      setLoading(false);
    }
  };

  return { books, loading, error, totalCount, refetch: fetchBooks };
}

// useBook function reverted to original state
export function useBook(id: string) {
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchBook();
    }
  }, [id]);

  const fetchBook = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('books')
        .select('*, reviews(rating)') // Include reviews(rating)
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Calculate average rating and total reviews
      const reviews = data.reviews || []; // Use reviews
      const totalReviews = reviews.length;
      const averageRating = totalReviews > 0
        ? reviews.reduce((sum: number, review: any) => sum + review.rating, 0) / totalReviews
        : 0;

      setBook({
        ...data,
        reviews: undefined, // Remove nested array
        average_rating: Math.round(averageRating * 10) / 10,
        total_reviews: totalReviews,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return { book, loading, error, refetch: fetchBook };
}
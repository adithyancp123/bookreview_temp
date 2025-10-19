import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookGrid } from '../components/Books/BookGrid';
import { BookFilters } from '../components/Books/BookFilters';
import { useBooks } from '../hooks/useBooks';

export function Books() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedGenre, setSelectedGenre] = useState(searchParams.get('genre') || 'all');
  const [sortBy, setSortBy] = useState('newest'); // Note: Sorting logic is in useBooks, ensure it uses this state if needed.
  const [page, setPage] = useState(1);

  const searchTerm = searchParams.get('search') || '';
  // Pass state variables to the hook
  const { books, loading, error, totalCount } = useBooks(searchTerm, selectedGenre, page, 12);

  const totalPages = Math.ceil(totalCount / 12);

  // Update selectedGenre if URL parameter changes
  useEffect(() => {
    const genre = searchParams.get('genre');
    if (genre) {
      setSelectedGenre(genre);
    } else {
      setSelectedGenre('all'); // Reset if genre param is removed
    }
  }, [searchParams]);

  const handleGenreChange = (genre: string) => {
    setSelectedGenre(genre);
    setPage(1); // Reset page when genre changes

    const newParams = new URLSearchParams(searchParams);
    if (genre === 'all') {
      newParams.delete('genre');
    } else {
      newParams.set('genre', genre);
    }
    setSearchParams(newParams);
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    setPage(1); // Reset page when sort changes
    // Add logic here or in useBooks to actually apply the sorting based on 'sortBy' value
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {searchTerm ? `Search Results for "${searchTerm}"` : 'Browse Books'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {totalCount > 0
              ? `Showing ${(page - 1) * 12 + 1}-${Math.min(page * 12, totalCount)} of ${totalCount} books`
              : 'Discover your next favorite read'
            }
          </p>
          {/* Test button removed */}
        </div>

        <BookFilters
          selectedGenre={selectedGenre}
          onGenreChange={handleGenreChange}
          sortBy={sortBy}
          onSortChange={handleSortChange}
        />

        {/* Pass props to BookGrid */}
        <BookGrid books={books} loading={loading} error={error} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-12">
            <nav className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Basic pagination number logic */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = 1;
                if (totalPages <= 5) {
                   pageNum = i + 1;
                } else if (page <= 3) {
                   pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                   pageNum = totalPages - 4 + i;
                } else {
                   pageNum = page - 2 + i;
                }

                if (pageNum < 1 || pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      pageNum === page
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
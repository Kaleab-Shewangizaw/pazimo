import React from "react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemName?: string;
  itemsPerPage?: number;
  startIndex?: number;
  endIndex?: number;
}

export default function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemName = "items",
  itemsPerPage = 10,
  startIndex,
  endIndex,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const start = startIndex ?? (currentPage - 1) * itemsPerPage;
  const end = endIndex ?? start + itemsPerPage;

  return (
    <div className="px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-black rounded-b-xl">
      <div className="text-sm text-gray-700 dark:text-gray-300">
        Showing {start + 1} to {Math.min(end, totalItems)} of {totalItems}{" "}
        {itemName}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors duration-200"
        >
          Previous
        </button>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors duration-200"
        >
          Next
        </button>
      </div>
    </div>
  );
}
import React from 'react';

// Reusable pagination styled similar to TikCash: numbered pills, Prev/Next, and a "Showing X–Y of total" label.
// Props:
// - page: current page number (1-based)
// - onChange: (nextPage:number) => void
// - limit: items per page (default 10)
// - total: total number of items (optional). If not provided, pass `pages`.
// - pages: total pages (optional, used when total is unknown). If both provided, `total` takes precedence.
// - showLabel: whether to show "Showing X–Y of total" (or "Page X of Y" when total unknown). Default true.
// - className: extra class names for the container.
// - align: 'center' | 'between' controls layout. Default 'center'.
export default function Pagination({
  page = 1,
  onChange = () => {},
  limit = 10,
  total,
  pages,
  showLabel = true,
  className = '',
  align = 'center',
}) {
  const totalPages = React.useMemo(() => {
    if (Number.isFinite(total) && total >= 0) return Math.max(1, Math.ceil(total / (limit || 10)));
    if (Number.isFinite(pages) && pages > 0) return pages;
    return 1;
  }, [total, pages, limit]);

  const clampedPage = Math.min(Math.max(1, page || 1), totalPages);
  const startIndex = (clampedPage - 1) * (limit || 10) + 1;
  const endIndex = Number.isFinite(total)
    ? Math.min(total, clampedPage * (limit || 10))
    : clampedPage * (limit || 10);

  const canPrev = clampedPage > 1;
  const canNext = clampedPage < totalPages;

  // Build a window of page numbers with ellipses when many pages
  const windowSize = 5; // show up to 5 numbered buttons around current
  let start = Math.max(1, clampedPage - Math.floor(windowSize / 2));
  let end = start + windowSize - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - windowSize + 1);
  }

  const pagesList = [];
  if (start > 1) {
    pagesList.push(1);
    if (start > 2) pagesList.push('ellipsis-left');
  }
  for (let i = start; i <= end; i++) pagesList.push(i);
  if (end < totalPages) {
    if (end < totalPages - 1) pagesList.push('ellipsis-right');
    pagesList.push(totalPages);
  }

  const containerAlign = align === 'between' ? 'justify-between' : 'justify-center';

  // Base styles updated: rectangular (rounded-md) outline buttons, active is filled blue with thin border.
  const btnBase = 'px-3 py-1.5 rounded-md border text-sm transition-colors';
  const btnNumber = 'bg-transparent border-blue-500/60 text-blue-300 hover:bg-blue-500/10 hover:border-blue-500 hover:text-blue-200';
  const btnActive = 'bg-blue-600 text-white border-blue-600';
  const btnDisabled = 'bg-transparent border-slate-700 text-slate-500 cursor-not-allowed opacity-60';
  const btnNav = 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700/40 hover:text-white';

  return (
    <div className={`w-full flex items-center ${containerAlign} gap-3 ${className}`}>
      {showLabel && (
        <div className="text-xs md:text-sm text-gray-300">
          {Number.isFinite(total) && total >= 0
            ? `Showing ${total === 0 ? 0 : startIndex}-${Math.max(startIndex, endIndex)} of ${total}`
            : `Page ${clampedPage} of ${totalPages}`}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => canPrev && onChange(clampedPage - 1)}
          disabled={!canPrev}
          className={`${btnBase} ${canPrev ? btnNav : btnDisabled}`}
        >
          ‹
        </button>
        {pagesList.map((p, idx) => {
          if (typeof p !== 'number') {
            return (
              <span key={`${p}-${idx}`} className="px-2 text-gray-500 select-none">
                …
              </span>
            );
          }
          const isActive = p === clampedPage;
          return (
            <button
              key={p}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onChange(p)}
              className={`${btnBase} ${isActive ? btnActive : btnNumber}`}
            >
              {p}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Next page"
          onClick={() => canNext && onChange(clampedPage + 1)}
          disabled={!canNext}
          className={`${btnBase} ${canNext ? btnNav : btnDisabled}`}
        >
          ›
        </button>
      </div>
    </div>
  );
}

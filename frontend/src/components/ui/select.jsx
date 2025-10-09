import React, { useState } from 'react';

export const Select = ({ value, onValueChange, children }) => {
  return <div data-select-value={value} onChange={(e) => onValueChange?.(e.target.value)}>{children}</div>;
};

export const SelectTrigger = ({ children, className = '' }) => (
  <div className={`rounded-md border border-white/10 bg-slate-900 text-white px-3 py-2 flex items-center justify-between ${className}`}>
    <div className="flex-1">{children}</div>
    <svg className="w-4 h-4 text-gray-300 ml-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

export const SelectValue = ({ value, placeholder }) => (
  <span className="text-gray-300">{value || placeholder}</span>
);

export const SelectContent = ({ children, className = '' }) => (
  <div className={`mt-2 rounded-md border border-white/10 bg-slate-900 p-2 ${className}`}>{children}</div>
);

export const SelectItem = ({ value, children, onClick }) => (
  <div className="cursor-pointer rounded px-3 py-2 hover:bg-white/10" onClick={() => onClick?.(value)} data-value={value}>
    {children}
  </div>
);

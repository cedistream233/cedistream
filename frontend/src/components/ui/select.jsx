import React, { useState } from 'react';

export const Select = ({ value, onValueChange, children }) => {
  return <div data-select-value={value} onChange={(e) => onValueChange?.(e.target.value)}>{children}</div>;
};

export const SelectTrigger = ({ children, className = '' }) => (
  <div className={`rounded-md border border-white/10 bg-slate-900 text-white px-3 py-2 ${className}`}>{children}</div>
);

export const SelectValue = ({ placeholder }) => <span className="text-gray-300">{placeholder}</span>;

export const SelectContent = ({ children, className = '' }) => (
  <div className={`mt-2 rounded-md border border-white/10 bg-slate-900 p-2 ${className}`}>{children}</div>
);

export const SelectItem = ({ value, children, onClick }) => (
  <div className="cursor-pointer rounded px-3 py-2 hover:bg-white/10" onClick={() => onClick?.(value)} data-value={value}>
    {children}
  </div>
);

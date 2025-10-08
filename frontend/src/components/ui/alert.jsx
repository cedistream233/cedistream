import React from 'react';

export const Alert = ({ className = '', children }) => (
  <div className={`rounded-md border border-yellow-400/20 bg-yellow-400/10 p-4 ${className}`}>{children}</div>
);

export const AlertDescription = ({ children }) => (
  <div className="text-yellow-200 text-sm">{children}</div>
);

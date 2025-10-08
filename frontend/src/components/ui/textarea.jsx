import React from 'react';

export const Textarea = ({ className = '', ...props }) => (
  <textarea
    className={`w-full rounded-md border border-white/10 bg-slate-900 text-white px-3 py-2 outline-none focus:ring-2 focus:ring-purple-600 min-h-[120px] ${className}`}
    {...props}
  />
);

export default Textarea;

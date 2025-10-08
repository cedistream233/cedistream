import React from 'react';

export const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full rounded-md border border-white/10 bg-slate-900 text-white px-3 py-2 outline-none focus:ring-2 focus:ring-purple-600 ${className}`}
    {...props}
  />
);

export default Input;

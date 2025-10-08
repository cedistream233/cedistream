import React from 'react';

export const Label = ({ className = '', children, htmlFor, ...props }) => (
  <label htmlFor={htmlFor} className={`block text-sm font-medium text-gray-300 mb-2 ${className}`} {...props}>
    {children}
  </label>
);

export default Label;

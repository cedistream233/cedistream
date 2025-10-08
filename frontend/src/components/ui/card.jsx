import React from 'react';

export const Card = ({ className = '', children, ...props }) => (
  <div className={`rounded-xl border border-purple-900/30 bg-slate-900/40 backdrop-blur-sm shadow-sm transition hover:shadow-md hover:border-purple-500/40 ${className}`} {...props}>
    {children}
  </div>
);

export const CardContent = ({ className = '', children, ...props }) => (
  <div className={`p-4 md:p-5 ${className}`} {...props}>
    {children}
  </div>
);

export default Card;

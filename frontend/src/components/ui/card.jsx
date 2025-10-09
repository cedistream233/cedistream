import React from 'react';

export const Card = ({ className = '', children, ...props }) => (
  <div className={`rounded-xl border border-purple-900/30 bg-slate-900/40 backdrop-blur-sm shadow-sm transition hover:shadow-md hover:border-purple-500/40 ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ className = '', children, ...props }) => (
  <div className={`flex flex-col space-y-1.5 p-4 md:p-5 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className = '', children, ...props }) => (
  <h3 className={`text-lg font-semibold leading-none tracking-tight text-white ${className}`} {...props}>
    {children}
  </h3>
);

export const CardContent = ({ className = '', children, ...props }) => (
  <div className={`p-4 md:p-5 ${className}`} {...props}>
    {children}
  </div>
);

export default Card;

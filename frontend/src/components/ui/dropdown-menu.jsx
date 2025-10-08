import React from 'react';

export const DropdownMenu = ({ children }) => <div className="relative inline-block text-left">{children}</div>;
export const DropdownMenuTrigger = ({ asChild, children, ...props }) => (
  asChild ? React.cloneElement(children, { ...props }) : <button {...props}>{children}</button>
);
export const DropdownMenuContent = ({ children, align = 'start', className = '' }) => (
  <div className={`absolute mt-2 min-w-[12rem] rounded-md border border-white/10 bg-slate-900 p-2 shadow-lg ${align === 'end' ? 'right-0' : 'left-0'} ${className}`}>
    {children}
  </div>
);
export const DropdownMenuItem = ({ children, className = '', ...props }) => (
  <div className={`cursor-pointer select-none rounded-sm px-3 py-2 text-sm text-gray-200 hover:bg-white/10 ${className}`} {...props}>
    {children}
  </div>
);

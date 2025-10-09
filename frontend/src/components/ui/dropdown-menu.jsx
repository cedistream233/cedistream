import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

const MenuContext = createContext(null);

export const DropdownMenu = ({ children }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative inline-block text-left">
      <MenuContext.Provider value={{ open, setOpen }}>{children}</MenuContext.Provider>
    </div>
  );
};

export const DropdownMenuTrigger = ({ asChild, children, ...props }) => {
  const ctx = useContext(MenuContext);
  const toggle = (e) => {
    if (props.onClick) props.onClick(e);
    if (ctx) ctx.setOpen(!ctx.open);
  };
  if (asChild) {
    return React.cloneElement(children, { ...props, onClick: toggle });
  }
  return (
    <button type="button" {...props} onClick={toggle}>
      {children}
    </button>
  );
};

export const DropdownMenuContent = ({ children, align = 'start', className = '' }) => {
  const ctx = useContext(MenuContext);
  if (!ctx || !ctx.open) return null;
  return (
    <div className={`absolute mt-2 min-w-[12rem] rounded-md border border-white/10 bg-slate-900 p-2 shadow-lg ${align === 'end' ? 'right-0' : 'left-0'} ${className}`}>
      {children}
    </div>
  );
};

export const DropdownMenuItem = ({ children, className = '', asChild, ...props }) => {
  const ctx = useContext(MenuContext);
  const handleClick = (e) => {
    if (props.onClick) props.onClick(e);
    if (ctx) ctx.setOpen(false);
  };
  if (asChild) {
    return React.cloneElement(children, {
      className: `cursor-pointer select-none rounded-sm px-3 py-2 text-sm text-gray-200 hover:bg-white/10 ${className}`,
      ...props,
      onClick: handleClick,
    });
  }
  return (
    <div className={`cursor-pointer select-none rounded-sm px-3 py-2 text-sm text-gray-200 hover:bg-white/10 ${className}`} {...props} onClick={handleClick}>
      {children}
    </div>
  );
};

export const DropdownMenuSeparator = ({ className = '' }) => (
  <div className={`my-1 h-px bg-slate-700 ${className}`} />
);

import React, { useState, useContext, createContext } from 'react';

const TabsContext = createContext();

export const Tabs = ({ defaultValue, value, onValueChange, children, className = '' }) => {
  const [internal, setInternal] = useState(defaultValue);
  const current = value !== undefined ? value : internal;
  const setValue = (v) => {
    if (onValueChange) onValueChange(v);
    if (value === undefined) setInternal(v);
  };
  return (
    <TabsContext.Provider value={{ value: current, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children, className = '' }) => (
  <div className={`inline-flex items-center rounded-md border border-white/10 bg-slate-900 p-1 ${className}`}>
    {children}
  </div>
);

export const TabsTrigger = ({ value, children, className = '' }) => {
  const ctx = useContext(TabsContext);
  const active = ctx?.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx?.setValue(value)}
      className={`px-4 py-2 text-sm rounded-md transition-colors ${active ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-white/10' } ${className}`}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, className = '' }) => {
  const ctx = useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return <div className={className}>{children}</div>;
};

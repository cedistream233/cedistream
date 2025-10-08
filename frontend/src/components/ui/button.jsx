import React from 'react';

const variantClasses = {
  primary: 'bg-gradient-to-r from-primary-600 to-pink-600 text-white shadow-glow hover:from-primary-500 hover:to-pink-500',
  secondary: 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700/70',
  outline: 'border border-slate-600 text-white hover:bg-slate-800/60',
  ghost: 'bg-transparent text-gray-300 hover:text-white hover:bg-slate-800/60',
  white: 'bg-white text-slate-900 hover:bg-gray-100 shadow',
};

const sizeClasses = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
};

export const Button = ({
  asChild = false,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const Comp = asChild ? 'span' : 'button';
  const base = 'inline-flex items-center justify-center rounded-md font-medium tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const variantCls = variantClasses[variant] || variantClasses.primary;
  const sizeCls = sizeClasses[size] || sizeClasses.md;
  return (
    <Comp className={`${base} ${variantCls} ${sizeCls} ${className}`} {...props}>
      {children}
    </Comp>
  );
};

export default Button;

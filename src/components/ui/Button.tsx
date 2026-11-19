import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const variantClass = variant === 'accent' ? 'btn-accent' : variant === 'outline' ? 'btn-outline' : 'btn-primary';
  const sizeClass =
    size === 'sm' ? 'btn-sm px-3 py-1.5 text-xs' : size === 'lg' ? 'btn-lg px-6 py-3 text-base' : '';

  return (
    <button className={`btn min-w-0 max-w-full ${variantClass} ${sizeClass} ${className}`} {...props}>
      {children}
    </button>
  );
};

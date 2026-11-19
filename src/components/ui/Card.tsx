import React from 'react';

interface CardProps {
  title?: string;
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, className = '', children }) => {
  return (
    <div className={`card min-w-0 max-w-full ${className}`}>
      {title && <h3 className="card-title">{title}</h3>}
      {children}
    </div>
  );
};

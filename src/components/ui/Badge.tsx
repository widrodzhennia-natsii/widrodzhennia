import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  icon?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, icon }) => {
  return (
    <div className="resource-badge">
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </div>
  );
};

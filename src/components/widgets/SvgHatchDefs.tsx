import React, { useId } from 'react';

/**
 * Shared SVG Hatch Patterns for 100% WCAG clarity in mono-light / mono-dark themes
 * All fills and strokes strictly read from global CSS custom properties.
 */
export const useWidgetHatchIds = () => {
  const raw = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return {
    diagA: `hatch_diag_a_${raw}`,
    diagB: `hatch_diag_b_${raw}`,
    dots: `hatch_dots_${raw}`,
    cross: `hatch_cross_${raw}`,
  };
};

export const SvgHatchDefs: React.FC<{ ids: ReturnType<typeof useWidgetHatchIds> }> = ({ ids }) => (
  <defs>
    <pattern id={ids.diagA} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="var(--hl-bg)" />
      <line x1="0" y1="0" x2="0" y2="8" stroke="var(--accent)" strokeWidth="1.35" strokeOpacity="0.48" />
    </pattern>
    <pattern id={ids.diagB} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
      <rect width="8" height="8" fill="var(--ok-bg)" />
      <line x1="0" y1="0" x2="0" y2="8" stroke="var(--ok-border)" strokeWidth="1.35" strokeOpacity="0.48" />
    </pattern>
    <pattern id={ids.dots} width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="var(--surface-alt)" />
      <circle cx="4" cy="4" r="1.2" fill="var(--accent)" fillOpacity="0.45" />
    </pattern>
    <pattern id={ids.cross} width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill="var(--hl-bg)" />
      <path d="M 0 5 L 10 5 M 5 0 L 5 10" stroke="var(--hl-border)" strokeWidth="1.05" strokeOpacity="0.45" />
    </pattern>
  </defs>
);

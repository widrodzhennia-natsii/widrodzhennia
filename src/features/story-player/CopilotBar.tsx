import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { RichBlockText } from '../../components/ui/RichBlockText';

interface CopilotBarProps {
  guideText?: string;
}

export const CopilotBar: React.FC<CopilotBarProps> = ({ guideText }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!guideText) return null;

  return (
    <div className="guidance-box space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-extrabold flex items-center gap-1.5 text-xs">
          <span>🤝 Co-pilot: Порада наставнику та батькам</span>
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen((p) => !p)}>
          {isOpen ? 'Сховати' : 'Показати'}
        </Button>
      </div>

      {isOpen && (
        <div className="font-medium leading-relaxed pt-2 border-t border-[var(--hl-border)] text-xs">
          <RichBlockText text={guideText} />
        </div>
      )}
    </div>
  );
};

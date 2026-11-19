import React from 'react';
import { Card } from '../ui/Card';

interface StoryPanelProps {
  chapterTitle: string;
  chapterDescription?: string;
  speakerName?: string;
  contextStory?: string;
}

export const StoryPanel: React.FC<StoryPanelProps> = ({
  chapterTitle,
  chapterDescription,
  speakerName,
  contextStory,
}) => {
  if (!chapterDescription && !contextStory) {
    return null;
  }

  return (
    <Card title={chapterTitle || 'Матеріали уроку'}>
      {chapterDescription && (
        <p className="text-xs text-[var(--color-muted)] leading-relaxed">{chapterDescription}</p>
      )}

      {contextStory && contextStory !== chapterDescription && (
        <div className="mt-3 p-3 bg-[var(--color-bg)] rounded-[var(--radius-sm)] border border-[var(--color-border)] text-xs space-y-1">
          {speakerName && (
            <span className="font-extrabold text-[var(--color-primary-dark)] block">
              {speakerName}
            </span>
          )}
          <p className="text-[var(--color-text)] leading-relaxed">{contextStory}</p>
        </div>
      )}
    </Card>
  );
};

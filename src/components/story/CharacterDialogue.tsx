import React from 'react';

interface CharacterDialogueProps {
  speakerName: string;
  avatarIcon?: string;
  message: string;
}

export const CharacterDialogue: React.FC<CharacterDialogueProps> = ({
  speakerName,
  avatarIcon = '👤',
  message,
}) => {
  return (
    <div className="flex items-start gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-[var(--radius-md)] shadow-sm">
      <div
        className="w-12 h-12 rounded-full border flex items-center justify-center text-2xl shrink-0 shadow-xs"
        style={{
          backgroundColor: 'var(--color-success-bg)',
          borderColor: 'var(--color-success-border)',
        }}
      >
        {avatarIcon}
      </div>
      <div className="space-y-1">
        <h4 className="text-xs font-bold text-[var(--color-primary-dark)] uppercase tracking-wide">
          {speakerName}
        </h4>
        <p className="text-sm text-[var(--color-text)] leading-relaxed italic">
          "{message}"
        </p>
      </div>
    </div>
  );
};

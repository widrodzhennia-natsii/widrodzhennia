import React from 'react';

interface IslandSceneProps {
  stageName: string;
}

export const IslandScene: React.FC<IslandSceneProps> = ({ stageName }) => {
  return (
    <div className="card space-y-2.5 p-4">
      <div className="surface-subtle px-3.5 py-2.5 rounded-[var(--radius-sm)]">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] block leading-tight">
          Локація уроку
        </span>
        <span className="text-xs font-extrabold text-[var(--primary-dark)] truncate block">
          📍 {stageName}
        </span>
      </div>

      <p className="text-[11px] text-[var(--text-muted)] font-semibold">
        Послідовно проходьте блоки уроку, щоб просуватися далі.
      </p>
    </div>
  );
};

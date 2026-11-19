import React from 'react';

interface NotebookWorkspaceProps {
  notebookPrompt: string;
  conceptTitle: string;
  exampleProblem: string;
  exampleSolution: string;
}

export const NotebookWorkspace: React.FC<NotebookWorkspaceProps> = ({
  notebookPrompt,
  conceptTitle,
  exampleProblem,
  exampleSolution,
}) => {
  return (
    <div className="notebook-paper my-3 space-y-2">
      <div className="flex items-center justify-between pb-1 border-b border-[var(--color-notebook-line)]">
        <div className="flex items-center gap-2">
          <span className="text-xl">📓</span>
          <h4 className="text-xs font-bold text-[var(--color-primary-dark)] uppercase tracking-wide">
            Робочий Зошит (Покроковий алгоритм розв'язання)
          </h4>
        </div>
        <span className="text-xs font-semibold text-[var(--color-muted)]">5 клас • Математика</span>
      </div>

      <p className="text-sm font-bold text-[var(--color-text)] pt-1">
        {notebookPrompt}
      </p>

      {/* Step-by-step resolution guide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
        <div className="p-2 bg-[var(--surface)] rounded-[var(--radius-sm)] border border-[var(--color-border)]">
          <span className="font-bold text-[var(--color-muted)] block mb-0.5">💡 Логіка розбору:</span>
          <p className="text-[var(--color-text)] font-medium">{conceptTitle}</p>
        </div>

        <div className="p-2 bg-[var(--surface)] rounded-[var(--radius-sm)] border border-[var(--color-border)]">
          <span className="font-bold text-[var(--color-muted)] block mb-0.5">✍️ Приклад розв'язання:</span>
          <p className="text-[var(--color-text)] font-semibold">{exampleProblem}</p>
          <p className="font-mono text-[var(--color-primary)] font-bold">{exampleSolution}</p>
        </div>
      </div>

      <p className="text-[11px] text-[var(--color-muted)] leading-tight pt-1">
        ⚠️ Порада: Обчисли вираз у своєму зошиті або усно. Самостійний розрахунок — найкращий спосіб розвитку логіки!
      </p>
    </div>
  );
};

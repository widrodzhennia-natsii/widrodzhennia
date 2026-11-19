import React, { useState } from 'react';

export interface MindMapBranch {
  id: string;
  label: string;
  role?: 'thesis' | 'evidence' | 'counter' | 'conclusion' | 'branch';
  items: string[];
}

export interface ArgumentMindMapSpec {
  title: string;
  mode: 'argument' | 'mindmap';
  rootLabel: string;
  branches: MindMapBranch[];
}

interface ArgumentMindMapProps {
  spec: ArgumentMindMapSpec;
  renderRichText?: (text: string) => React.ReactNode;
}

const ROLE_META: Record<NonNullable<MindMapBranch['role']>, { icon: string; badge: string; toneClass: string }> = {
  thesis: {
    icon: '📌',
    badge: 'Теза',
    toneClass: 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]',
  },
  evidence: {
    icon: '🔎',
    badge: 'Докази',
    toneClass: 'bg-[var(--surface)] border-[var(--border-hover)] text-[var(--text)]',
  },
  counter: {
    icon: '⚖️',
    badge: 'Контраргумент',
    toneClass: 'bg-[var(--warn-bg)] border-[var(--warn-border)] text-[var(--warn-text)]',
  },
  conclusion: {
    icon: '🎯',
    badge: 'Висновок',
    toneClass: 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]',
  },
  branch: {
    icon: '🌿',
    badge: 'Гілка',
    toneClass: 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)]',
  },
};

export const ArgumentMindMap: React.FC<ArgumentMindMapProps> = ({ spec, renderRichText }) => {
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});

  const toggleBranch = (id: string) => {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => setCollapsedIds({});
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    spec.branches.forEach((b) => {
      if (b.items.length > 0) next[b.id] = true;
    });
    setCollapsedIds(next);
  };

  const renderText = (txt: string) => (renderRichText ? renderRichText(txt) : txt);

  return (
    <div className="w-full space-y-2.5 text-left" role="region" aria-label={spec.title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-extrabold text-[var(--primary-dark)]">
          {spec.mode === 'argument' ? '🧭 Карта аргументів' : '🧠 Інтелект-карта'} · {spec.title}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold">
          <button
            type="button"
            onClick={expandAll}
            className="px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer"
          >
            + Розгорнути
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer"
          >
            − Згорнути
          </button>
        </div>
      </div>

      {/* Root / Central Thesis Node */}
      <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--hl-bg)] border-2 border-[var(--hl-border)] text-[var(--hl-text)] text-xs sm:text-sm font-extrabold">
        <span className="mr-1.5" aria-hidden="true">
          {spec.mode === 'argument' ? '📌' : '🌐'}
        </span>
        {renderText(spec.rootLabel)}
      </div>

      {/* Connected Sub-Branches */}
      <div className="pl-3 sm:pl-4 border-l-2 border-dashed border-[var(--border-hover)] space-y-2">
        {spec.branches.map((branch, idx) => {
          const isCollapsed = Boolean(collapsedIds[branch.id]);
          const meta = ROLE_META[branch.role || 'branch'];
          const hasChildren = branch.items.length > 0;

          return (
            <div key={branch.id} className={`rounded-[var(--radius-sm)] border p-2.5 space-y-1.5 ${meta.toneClass}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[10px] font-extrabold opacity-75 shrink-0">
                    {idx + 1}.
                  </span>
                  <span aria-hidden="true">{meta.icon}</span>
                  <span className="text-xs font-extrabold">{renderText(branch.label)}</span>
                </div>

                {hasChildren && (
                  <button
                    type="button"
                    onClick={() => toggleBranch(branch.id)}
                    aria-expanded={!isCollapsed}
                    className="px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-[10px] font-bold shrink-0 cursor-pointer hover:border-[var(--accent)]"
                  >
                    {isCollapsed ? `+ (${branch.items.length})` : '−'}
                  </button>
                )}
              </div>

              {hasChildren && !isCollapsed && (
                <ul className="pl-3 border-l border-[var(--border-hover)] space-y-1">
                  {branch.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="text-xs font-semibold leading-snug flex items-start gap-1.5">
                      <span className="font-mono text-[10px] opacity-75 pt-0.5 shrink-0">→</span>
                      <span className="flex-1 min-w-0">{renderText(item)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

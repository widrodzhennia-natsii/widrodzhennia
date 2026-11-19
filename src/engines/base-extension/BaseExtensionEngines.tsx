import React, { useEffect, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';

/* -------------------------------------------------------------------------- */
/* 1. THESIS OUTLINE BUILDER (Структурний конструктор текстів-опор)           */
/* -------------------------------------------------------------------------- */

export interface OutlineNodeSpec {
  id: string;
  role: 'thesis' | 'argument' | 'fact' | 'conclusion';
  text: string;
}

export interface ThesisOutlineConfig {
  topic?: string;
  cards?: OutlineNodeSpec[];
  instruction?: string;
}

const DEFAULT_OUTLINE_CARDS: OutlineNodeSpec[] = [
  { id: 'c3', role: 'fact', text: 'Наприклад, розчинення солі прискорюється при помішуванні й нагріванні.' },
  { id: 'c4', role: 'conclusion', text: 'Отже, температура напряму керує кінетичною енергією молекул.' },
  { id: 'c1', role: 'thesis', text: 'Швидкість фізичних і хімічних процесів залежить від умов середовища.' },
  { id: 'c2', role: 'argument', text: 'Вища температура змушує частинки рухатися швидше та частіше зіштовхуватися.' },
];

const ROLE_ORDER: Record<OutlineNodeSpec['role'], number> = {
  thesis: 0,
  argument: 1,
  fact: 2,
  conclusion: 3,
};

const ROLE_LABELS: Record<OutlineNodeSpec['role'], string> = {
  thesis: '1. Теза',
  argument: '2. Аргумент',
  fact: '3. Факт / Приклад',
  conclusion: '4. Висновок',
};

export const ThesisOutlineBuilderEngine: React.FC<EngineProps<ThesisOutlineConfig>> = ({
  config,
  onStateChange,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const source = config.cards && config.cards.length > 0 ? config.cards : DEFAULT_OUTLINE_CARDS;
  const [cards, setCards] = useState<OutlineNodeSpec[]>(source);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);

  useEffect(() => {
    setCards(source);
    setFeedback(null);
    setIsCorrect(false);
  }, [config]);

  useEffect(() => {
    onStateChange?.({ order: cards.map((c) => c.role) });
  }, [cards, onStateChange]);

  const move = (idx: number, dir: -1 | 1) => {
    if (isReadOnly) return;
    const next = idx + dir;
    if (next < 0 || next >= cards.length) return;
    const copy = [...cards];
    const tmp = copy[idx];
    copy[idx] = copy[next];
    copy[next] = tmp;
    setCards(copy);
    setFeedback(null);
  };

  const handleCheck = () => {
    let valid = true;
    for (let i = 1; i < cards.length; i++) {
      if (ROLE_ORDER[cards[i].role] < ROLE_ORDER[cards[i - 1].role]) {
        valid = false;
        break;
      }
    }
    setIsCorrect(valid);
    if (valid) {
      setFeedback('✅ Логічну структуру опорного конспекту зібрано бездоганно: Теза → Аргумент → Факт → Висновок!');
      onSubmitAnswer?.(cards.map((c) => c.id));
    } else {
      setFeedback('🧩 Перевірте логіку: спершу сформулюйте Тезу, потім Аргумент, далі Факт і в кінці Висновок.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--text)]">
        {config.instruction || `📝 Зберіть логічний ланцюжок тексту-опори${config.topic ? ` («${config.topic}»)` : ''}.`}
      </div>

      <div className="space-y-2">
        {cards.map((card, idx) => (
          <div
            key={card.id}
            className="flex items-center justify-between gap-2 p-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"
          >
            <div className="space-y-0.5 min-w-0">
              <span className="inline-block text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-[var(--hl-bg)] text-[var(--hl-text)] border border-[var(--hl-border)]">
                {ROLE_LABELS[card.role]}
              </span>
              <p className="text-xs font-semibold text-[var(--text)]">{card.text}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isReadOnly || idx === 0}
                onClick={() => move(idx, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isReadOnly || idx === cards.length - 1}
                onClick={() => move(idx, 1)}
              >
                ↓
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="accent" size="md" disabled={isReadOnly} onClick={handleCheck}>
          ✓ Перевірити структуру
        </Button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-[var(--radius-md)] border text-xs font-bold ${
            isCorrect
              ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
              : 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
          }`}
        >
          {feedback}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. DENSITY & MASS LAB (Лабораторні терези густини та маси ρ = m / V)       */
/* -------------------------------------------------------------------------- */

export interface DensityMassConfig {
  targetDensity?: number;
  tolerance?: number;
  instruction?: string;
}

const MATERIALS = [
  { id: 'wood', label: 'Дерево (дуб)', rho: 0.7 },
  { id: 'ice', label: 'Лід', rho: 0.9 },
  { id: 'water', label: 'Вода', rho: 1.0 },
  { id: 'aluminum', label: 'Алюміній', rho: 2.7 },
  { id: 'iron', label: 'Залізо', rho: 7.8 },
];

export const DensityMassLabEngine: React.FC<EngineProps<DensityMassConfig>> = ({
  config,
  onStateChange,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const targetDensity = config.targetDensity ?? 2.7;
  const tolerance = config.tolerance ?? 0.25;

  const [massG, setMassG] = useState(54);
  const [volumeCm3, setVolumeCm3] = useState(20);
  const [selectedMatId, setSelectedMatId] = useState('aluminum');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isOk, setIsOk] = useState(false);

  const rho = volumeCm3 > 0 ? massG / volumeCm3 : 0;
  const sinks = rho > 1.0;

  useEffect(() => {
    onStateChange?.({ massG, volumeCm3, rho: Number(rho.toFixed(2)) });
  }, [massG, volumeCm3, rho, onStateChange]);

  const applyPreset = (mat: (typeof MATERIALS)[number]) => {
    if (isReadOnly) return;
    setSelectedMatId(mat.id);
    setMassG(Math.round(mat.rho * volumeCm3));
    setFeedback(null);
  };

  const handleCheck = () => {
    const match = Math.abs(rho - targetDensity) <= tolerance;
    setIsOk(match);
    if (match) {
      setFeedback(`✅ Точно! ρ = ${massG} / ${volumeCm3} = ${rho.toFixed(2)} г/см³ (ціль ${targetDensity} г/см³).`);
      onSubmitAnswer?.(Number(rho.toFixed(2)));
    } else {
      setFeedback(`⚖️ Зараз ρ = ${rho.toFixed(2)} г/см³. Змініть масу або об’єм, щоб наблизитися до ${targetDensity} г/см³.`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--text)]">
        {config.instruction || `🧪 Доберіть масу (m) і об’єм (V) зразка, щоб густина ρ = m / V дорівнювала ${targetDensity} г/см³.`}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 items-center p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex justify-center">
          <svg viewBox="0 0 180 150" className="w-44 h-36" role="img" aria-label="Мензурка з водою і тілом">
            <rect x="45" y="18" width="90" height="118" rx="6" fill="var(--surface-alt)" stroke="var(--text)" strokeWidth="2.5" />
            {/* Water level rises with volume */}
            <rect
              x="47"
              y={Math.max(26, 95 - volumeCm3 * 0.45)}
              width="86"
              height={134 - Math.max(26, 95 - volumeCm3 * 0.45)}
              fill="var(--hl-bg)"
              stroke="var(--hl-border)"
              strokeWidth="1"
            />
            {/* Submerged / floating block */}
            <rect
              x="72"
              y={sinks ? 105 : Math.max(28, 86 - volumeCm3 * 0.45)}
              width="36"
              height="24"
              rx="4"
              fill="var(--accent)"
              stroke="var(--text)"
              strokeWidth="2"
            />
            <text x="90" y={sinks ? 121 : Math.max(44, 102 - volumeCm3 * 0.45)} textAnchor="middle" fontSize="10" fontWeight="900" fill="var(--accent-text)">
              {rho.toFixed(1)}
            </text>
            <text x="90" y="146" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--text-muted)">
              {sinks ? 'Тоне у воді (> 1.0)' : 'Плаває (≤ 1.0)'}
            </text>
          </svg>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {MATERIALS.map((m) => (
              <Button
                key={m.id}
                type="button"
                size="sm"
                variant={selectedMatId === m.id ? 'primary' : 'outline'}
                disabled={isReadOnly}
                onClick={() => applyPreset(m)}
                className="text-[11px]"
              >
                {m.label}
              </Button>
            ))}
          </div>

          <label className="block space-y-1 text-xs font-bold">
            <div className="flex justify-between">
              <span>Маса (m):</span>
              <span className="font-mono">{massG} г</span>
            </div>
            <input
              type="range"
              min={5}
              max={200}
              step={1}
              disabled={isReadOnly}
              value={massG}
              onChange={(e) => setMassG(Number(e.target.value))}
              className="settings-range"
            />
          </label>

          <label className="block space-y-1 text-xs font-bold">
            <div className="flex justify-between">
              <span>Об’єм (V):</span>
              <span className="font-mono">{volumeCm3} см³</span>
            </div>
            <input
              type="range"
              min={5}
              max={60}
              step={1}
              disabled={isReadOnly}
              value={volumeCm3}
              onChange={(e) => setVolumeCm3(Number(e.target.value))}
              className="settings-range"
            />
          </label>

          <div className="p-2 rounded border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-mono font-black text-center">
            ρ = {massG} / {volumeCm3} = {rho.toFixed(2)} г/см³
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="accent" size="md" disabled={isReadOnly} onClick={handleCheck}>
          ✓ Зафіксувати вимір густини
        </Button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-[var(--radius-md)] border text-xs font-bold ${
            isOk
              ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
              : 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
          }`}
        >
          {feedback}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. ECO BALANCE SIM (Симулятор екологічного балансу екосистеми)             */
/* -------------------------------------------------------------------------- */

export interface EcoBalanceConfig {
  minStability?: number;
  instruction?: string;
}

export const EcoBalanceSimEngine: React.FC<EngineProps<EcoBalanceConfig>> = ({
  config,
  onStateChange,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const minStability = config.minStability ?? 80;
  const [treesPct, setTreesPct] = useState(50);
  const [waterSavePct, setWaterSavePct] = useState(40);
  const [cleanEnergyPct, setCleanEnergyPct] = useState(45);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isBalanced, setIsBalanced] = useState(false);

  const stability = Math.round((treesPct * 0.35 + waterSavePct * 0.35 + cleanEnergyPct * 0.3));
  const co2Index = Math.max(5, Math.round(100 - (treesPct * 0.5 + cleanEnergyPct * 0.45)));

  useEffect(() => {
    onStateChange?.({ treesPct, waterSavePct, cleanEnergyPct, stability });
  }, [treesPct, waterSavePct, cleanEnergyPct, stability, onStateChange]);

  const handleCheck = () => {
    const ok = stability >= minStability && treesPct >= 60 && waterSavePct >= 60;
    setIsBalanced(ok);
    if (ok) {
      setFeedback(`🌱 Екосистему збалансовано! Стійкість ${stability}% (CO₂ знижено до ${co2Index}).`);
      onSubmitAnswer?.(stability);
    } else {
      setFeedback(
        `🌍 Поточна стійкість ${stability}% (ціль ≥ ${minStability}%). Підніміть озеленення та збереження води принаймні до 60%.`
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--text)]">
        {config.instruction ||
          `🌿 Досягніть індексу стійкості екосистеми ≥ ${minStability}%, збалансувавши лісонасадження, воду й чисту енергію.`}
      </div>

      <div className="grid sm:grid-cols-3 gap-2">
        <div className="p-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-center">
          <div className="text-[11px] font-bold text-[var(--text-muted)]">Стійкість біому</div>
          <div className="text-xl font-black font-mono text-[var(--primary-dark)]">{stability}%</div>
        </div>
        <div className="p-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-center">
          <div className="text-[11px] font-bold text-[var(--text-muted)]">Індекс CO₂</div>
          <div className="text-xl font-black font-mono text-[var(--text)]">{co2Index} од.</div>
        </div>
        <div className="p-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-center">
          <div className="text-[11px] font-bold text-[var(--text-muted)]">Стан води</div>
          <div className="text-sm font-black text-[var(--text)]">
            {waterSavePct >= 60 ? '💧 Чиста' : '⚠️ Виснаження'}
          </div>
        </div>
      </div>

      <div className="space-y-2.5 p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
        {[
          { label: '🌳 Відновлення лісів і зелених смуг', val: treesPct, set: setTreesPct },
          { label: '💧 Раціональне водокористування', val: waterSavePct, set: setWaterSavePct },
          { label: '☀️ Частка відновлюваної енергії', val: cleanEnergyPct, set: setCleanEnergyPct },
        ].map((item) => (
          <label key={item.label} className="block space-y-1 text-xs font-bold">
            <div className="flex justify-between">
              <span>{item.label}</span>
              <span className="font-mono">{item.val}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              disabled={isReadOnly}
              value={item.val}
              onChange={(e) => {
                item.set(Number(e.target.value));
                setFeedback(null);
              }}
              className="settings-range"
            />
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="accent" size="md" disabled={isReadOnly} onClick={handleCheck}>
          ✓ Перевірити екобаланс
        </Button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-[var(--radius-md)] border text-xs font-bold ${
            isBalanced
              ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
              : 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
          }`}
        >
          {feedback}
        </div>
      )}
    </div>
  );
};

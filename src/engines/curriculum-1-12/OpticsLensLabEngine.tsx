import React, { useEffect, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';

export interface OpticsLensConfig {
  focalLengthCm?: number;
  targetImageDistCm?: number;
  instruction?: string;
}

export const OpticsLensLabEngine: React.FC<EngineProps<OpticsLensConfig>> = ({
  config,
  onStateChange,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const [lensType, setLensType] = useState<'converging' | 'diverging'>('converging');
  const [focalCm, setFocalCm] = useState(config.focalLengthCm ?? 20);
  const [objectDistCm, setObjectDistCm] = useState(40);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);

  // Thin lens formula: 1/f = 1/F - 1/d  -> f = (F * d) / (d - F)
  const signedF = lensType === 'converging' ? focalCm : -focalCm;
  const denom = objectDistCm - signedF;
  const imageDistCm = Math.abs(denom) < 0.001 ? Infinity : (signedF * objectDistCm) / denom;
  const magnification = Number.isFinite(imageDistCm) ? Math.abs(imageDistCm / objectDistCm) : 0;

  useEffect(() => {
    onStateChange?.({ lensType, focalCm, objectDistCm, imageDistCm });
  }, [lensType, focalCm, objectDistCm, imageDistCm, onStateChange]);

  const targetImageDist = config.targetImageDistCm ?? 40;

  const handleCheck = () => {
    if (Number.isFinite(imageDistCm) && Math.abs(imageDistCm - targetImageDist) <= 3) {
      setIsCorrect(true);
      setFeedback(
        `✅ Фокусування точне! Зображення на відстані f = ${imageDistCm.toFixed(1)} см, збільшення Γ = ${magnification.toFixed(2)}×.`
      );
      onSubmitAnswer?.(Number(imageDistCm.toFixed(1)));
    } else {
      setIsCorrect(false);
      setFeedback(
        `🔬 Зараз f = ${
          Number.isFinite(imageDistCm) ? `${imageDistCm.toFixed(1)} см` : '∞ (паралельний пучок)'
        }. Підберіть d та F, щоб отримати f ≈ ${targetImageDist} см.`
      );
    }
  };

  // Map optical coordinates to SVG (center lens x=180, optical axis y=90)
  const scale = 2.0; // 1 cm -> 2 px
  const lensX = 180;
  const axisY = 90;
  const objX = Math.max(22, lensX - objectDistCm * scale);
  const objH = 26;
  const fLeftX = lensX - focalCm * scale;
  const fRightX = lensX + focalCm * scale;
  const imgX = Number.isFinite(imageDistCm)
    ? Math.max(20, Math.min(340, lensX + imageDistCm * scale))
    : 340;
  const imgH = Number.isFinite(imageDistCm)
    ? Math.min(48, objH * magnification) * (imageDistCm > 0 ? 1 : -1)
    : objH;

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--text)]">
        {config.instruction ||
          `🔦 Використовуючи формулу тонкої лінзи (1/F = 1/d + 1/f), налаштуйте F і відстань предмета d, щоб отримати зображення на відстані f ≈ ${targetImageDist} см.`}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={lensType === 'converging' ? 'primary' : 'outline'}
            disabled={isReadOnly}
            onClick={() => setLensType('converging')}
          >
            🔍 Збиральна (+F)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={lensType === 'diverging' ? 'primary' : 'outline'}
            disabled={isReadOnly}
            onClick={() => setLensType('diverging')}
          >
            🪞 Розсіювальна (−F)
          </Button>
        </div>
        <span className="font-mono text-xs font-black text-[var(--primary-dark)]">
          f = {Number.isFinite(imageDistCm) ? `${imageDistCm.toFixed(1)} см` : '∞'} · Γ = {magnification.toFixed(2)}×
        </span>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 flex justify-center">
        <svg viewBox="0 0 360 180" className="w-full max-w-[460px] h-auto" role="img" aria-label="Побудова променів у лінзі">
          {/* Optical axis */}
          <line x1="12" y1={axisY} x2="348" y2={axisY} stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4 4" />

          {/* Focal points */}
          <circle cx={fLeftX} cy={axisY} r="3.5" fill="var(--text)" />
          <text x={fLeftX} y={axisY + 14} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="var(--text-muted)">F</text>
          <circle cx={fRightX} cy={axisY} r="3.5" fill="var(--text)" />
          <text x={fRightX} y={axisY + 14} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="var(--text-muted)">F</text>

          {/* Lens */}
          <line x1={lensX} y1="22" x2={lensX} y2="158" stroke="var(--primary-dark)" strokeWidth="3.5" />
          <text x={lensX} y="16" textAnchor="middle" fontSize="10" fontWeight="900" fill="var(--primary-dark)">
            {lensType === 'converging' ? '▲▼' : '▼▲'}
          </text>

          {/* Object arrow */}
          <line x1={objX} y1={axisY} x2={objX} y2={axisY - objH} stroke="var(--text)" strokeWidth="3" />
          <circle cx={objX} cy={axisY - objH} r="3.5" fill="var(--text)" />
          <text x={objX} y={axisY + 15} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="var(--text)">d={objectDistCm}</text>

          {/* Principal rays */}
          <line x1={objX} y1={axisY - objH} x2={lensX} y2={axisY - objH} stroke="var(--accent)" strokeWidth="2" />
          <line x1={lensX} y1={axisY - objH} x2={imgX} y2={axisY + imgH} stroke="var(--accent)" strokeWidth="2" />
          <line x1={objX} y1={axisY - objH} x2={imgX} y2={axisY + imgH} stroke="var(--ok-border)" strokeWidth="1.5" strokeDasharray="3 2" />

          {/* Image arrow */}
          {Number.isFinite(imageDistCm) && (
            <>
              <line
                x1={imgX}
                y1={axisY}
                x2={imgX}
                y2={axisY + imgH}
                stroke="var(--accent)"
                strokeWidth="3"
                strokeDasharray={imageDistCm < 0 ? '4 2' : undefined}
              />
              <circle cx={imgX} cy={axisY + imgH} r="3.5" fill="var(--accent)" />
            </>
          )}
        </svg>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block space-y-1 text-xs font-bold">
          <div className="flex justify-between">
            <span>Фокусна відстань (|F|):</span>
            <span className="font-mono">{focalCm} см</span>
          </div>
          <input
            type="range"
            min={10}
            max={40}
            step={2}
            disabled={isReadOnly}
            value={focalCm}
            onChange={(e) => setFocalCm(Number(e.target.value))}
            className="settings-range"
          />
        </label>

        <label className="block space-y-1 text-xs font-bold">
          <div className="flex justify-between">
            <span>Відстань до предмета (d):</span>
            <span className="font-mono">{objectDistCm} см</span>
          </div>
          <input
            type="range"
            min={12}
            max={75}
            step={2}
            disabled={isReadOnly}
            value={objectDistCm}
            onChange={(e) => setObjectDistCm(Number(e.target.value))}
            className="settings-range"
          />
        </label>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="accent" size="md" disabled={isReadOnly} onClick={handleCheck}>
          ✓ Зафіксувати фокус
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

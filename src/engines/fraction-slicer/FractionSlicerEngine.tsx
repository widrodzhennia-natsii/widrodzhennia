import React, { useState, useEffect, useRef } from 'react';
import { EngineProps } from '../adapter';
import { useThemeStore } from '../../core/state/useThemeStore';
import { createCanvasHatchPattern, readThemeColors } from '../../utils/themeColors';

export interface FractionSlicerConfig {
  targetNumerator?: number;
  targetDenominator?: number;
  itemType?: 'wooden_beam' | 'bread_loaf' | 'bar';
  instruction?: string;
  customSuccessText?: string;
}

export const FractionSlicerEngine: React.FC<EngineProps<FractionSlicerConfig>> = ({
  config,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const themeMode = useThemeStore((s) => s.themeMode);
  const targetNum = config.targetNumerator ?? 3;
  const targetDen = config.targetDenominator ?? 4;

  const [denominator, setDenominator] = useState<number>(targetDen);
  const [selectedSlices, setSelectedSlices] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setDenominator(targetDen);
    setSelectedSlices([]);
    setFeedback(null);
  }, [config, targetDen]);

  const drawScene = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const palette = readThemeColors();
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = palette.surface;
    ctx.fillRect(0, 0, width, height);

    const beamX = 40;
    const beamY = 40;
    const beamWidth = width - 80;
    const beamHeight = 80;

    ctx.fillStyle = palette.surfaceAlt;
    ctx.fillRect(beamX, beamY, beamWidth, beamHeight);
    ctx.strokeStyle = palette.text;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(beamX, beamY, beamWidth, beamHeight);

    const sliceWidth = beamWidth / denominator;
    const selectedFill = palette.isMono
      ? createCanvasHatchPattern(ctx, palette.accentText, palette.accent, 8, 2)
      : createCanvasHatchPattern(ctx, palette.okBorder, palette.okBg, 10, 2);

    for (let i = 0; i < denominator; i++) {
      const sliceX = beamX + i * sliceWidth;
      const isSelected = selectedSlices.includes(i);

      if (isSelected) {
        ctx.fillStyle = selectedFill;
        ctx.fillRect(sliceX + 2, beamY + 2, sliceWidth - 4, beamHeight - 4);
      } else {
        ctx.fillStyle = palette.surface;
        ctx.fillRect(sliceX + 2, beamY + 2, sliceWidth - 4, beamHeight - 4);
      }

      if (i > 0) {
        ctx.strokeStyle = palette.borderHover;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sliceX, beamY);
        ctx.lineTo(sliceX, beamY + beamHeight);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (isSelected && palette.isMono) {
        ctx.fillStyle = palette.accent;
        ctx.fillRect(sliceX + sliceWidth / 2 - 18, beamY + beamHeight / 2 - 10, 36, 20);
        ctx.fillStyle = palette.accentText;
      } else {
        ctx.fillStyle = isSelected ? palette.okText : palette.text;
      }
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`1/${denominator}`, sliceX + sliceWidth / 2, beamY + beamHeight / 2 + 4);
    }
  };

  useEffect(() => {
    drawScene();
  }, [denominator, selectedSlices, themeMode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isReadOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const beamX = 40;
    const beamY = 40;
    const beamWidth = canvas.width - 80;
    const beamHeight = 80;

    if (clickX >= beamX && clickX <= beamX + beamWidth && clickY >= beamY && clickY <= beamY + beamHeight) {
      const sliceWidth = beamWidth / denominator;
      const sliceIdx = Math.floor((clickX - beamX) / sliceWidth);

      if (sliceIdx >= 0 && sliceIdx < denominator) {
        if (selectedSlices.includes(sliceIdx)) {
          setSelectedSlices((prev) => prev.filter((i) => i !== sliceIdx));
        } else {
          setSelectedSlices((prev) => [...prev, sliceIdx]);
        }
        setFeedback(null);
      }
    }
  };

  const currentNum = selectedSlices.length;
  const isEquivalent = currentNum > 0 && currentNum / denominator === targetNum / targetDen;
  const isCorrect = (currentNum === targetNum && denominator === targetDen) || isEquivalent;

  const handleVerify = () => {
    if (isCorrect) {
      setFeedback(
        config.customSuccessText ||
          `Чудово! Дріб ${currentNum}/${denominator} відповідає цільовому значенню ${targetNum}/${targetDen}!`
      );
      if (onSubmitAnswer) onSubmitAnswer(`${currentNum}/${denominator}`);
    } else {
      setFeedback(`Поточний дріб: ${currentNum}/${denominator}. Потрібно утворити дріб ${targetNum}/${targetDen}!`);
    }
  };

  return (
    <div className="p-5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-[var(--radius-md)] space-y-4 shadow-card">
      <div className="text-center space-y-1">
        <h4 className="text-sm font-extrabold text-[var(--primary-dark)] uppercase tracking-wide">
          🧩 Інтерактивний тренажер звичайних дробів
        </h4>
        <p className="text-xs text-[var(--text-muted)] font-medium">
          {config.instruction || `Утворіть дріб ${targetNum}/${targetDen} шляхом нарізання та натискання на частки:`}
        </p>
      </div>

      <div className="bg-[var(--bg)] rounded-[var(--radius-md)] border border-[var(--border)] p-2 flex justify-center">
        <canvas
          ref={canvasRef}
          width={480}
          height={160}
          onClick={handleCanvasClick}
          className="w-full max-w-full h-auto aspect-[3/1] bg-[var(--surface)] rounded border border-[var(--border)] cursor-pointer"
        />
      </div>

      {!isReadOnly && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[var(--bg)] rounded border border-[var(--border)] text-xs font-bold">
            <div className="flex items-center gap-2">
              <span>Кількість часток (Знаменник D):</span>
              <button
                type="button"
                onClick={() => { setDenominator((prev) => Math.max(2, prev - 1)); setSelectedSlices([]); setFeedback(null); }}
                className="btn btn-outline w-7 h-7 p-0 text-xs font-bold"
              >
                -
              </button>
              <span className="font-mono text-sm text-[var(--primary-dark)]">{denominator}</span>
              <button
                type="button"
                onClick={() => { setDenominator((prev) => Math.min(12, prev + 1)); setSelectedSlices([]); setFeedback(null); }}
                className="btn btn-outline w-7 h-7 p-0 text-xs font-bold"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span>Обрано часток (Чисельник N):</span>
              <span className="font-mono text-base text-[var(--ok-text)] font-extrabold">{currentNum}</span>
            </div>
          </div>

          <div className="status-panel status-panel--success text-center">
            Поточний утворений дріб: <span className="font-mono text-sm font-extrabold">{currentNum} / {denominator}</span>
            {isEquivalent && (
              <span className="ml-2 font-mono">
                (Еквівалентно {targetNum}/{targetDen} ✨)
              </span>
            )}
          </div>

          {feedback && (
            <div className={`status-panel ${isCorrect ? 'status-panel--success' : 'status-panel--warning'}`}>
              {feedback}
            </div>
          )}

          <button
            type="button"
            onClick={handleVerify}
            className="btn btn-primary w-full text-xs font-bold py-2.5"
          >
            Підтвердити дріб
          </button>
        </div>
      )}
    </div>
  );
};

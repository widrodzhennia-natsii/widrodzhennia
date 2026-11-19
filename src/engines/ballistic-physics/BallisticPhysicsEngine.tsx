import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { EngineProps } from '../adapter';
import { soundEngine } from '../../services/soundEngineService';
import { musicalSynth } from '../../core/audio/musical-synth';
import { useThemeStore } from '../../core/state/useThemeStore';
import { useLayoutPrefsStore } from '../../core/state/useLayoutPrefsStore';
import { createCanvasHatchPattern, readThemeColors } from '../../utils/themeColors';
import { ReactionZone } from '../../core/contracts/campaign.contract';
import { ReactionBubble, evaluateReactionZones } from '../../components/widgets/ReactionBubble';
import { SafeCanvasStage } from '../../components/canvas/SafeCanvasStage';

export interface BallisticTarget {
  id: string | number;
  distanceMeters: number;
  label?: string;
}

export interface BallisticStageModal {
  id: string;
  triggerOnHitCount: number;
  icon?: string;
  title: string;
  subtitle?: string;
  body: string;
  callout?: string;
  buttonLabel?: string;
  reinforceTargets?: BallisticTarget[];
}

export interface BallisticPhysicsConfig {
  title?: string;
  instruction?: string;
  themePreset?: 'river' | 'fortress' | 'field' | 'space' | 'lab' | 'day_river' | 'night_sky' | 'sunset_steppe' | 'cozy_parchment';
  launcherLabel?: string;
  targetLabel?: string;
  projectileSymbol?: string;
  targetSymbol?: string;
  gravity?: number;
  windSpeedMs?: number;
  airDragCoeff?: number;
  targetDistanceMeters?: number;
  targetDistance?: number;
  toleranceMeters?: number;
  maxAttempts?: number;
  initialAngle?: number;
  initialPower?: number;
  correctAngle?: number;
  correctPower?: number;
  targets?: BallisticTarget[];
  stages?: BallisticStageModal[];
  successMessage?: string;
  customSuccessText?: string;
  failureMessage?: string;
  customUndershootText?: string;
  customOvershootText?: string;
}

export const BallisticPhysicsEngine: React.FC<EngineProps<BallisticPhysicsConfig>> = ({
  config,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const themeMode = useThemeStore((s) => s.themeMode);
  const prolongedAnimations = useLayoutPrefsStore((s) => s.prolongedAnimations);
  const isStageVisibleRef = useRef<boolean>(true);
  const gravity = Number(config.gravity) > 0 ? Number(config.gravity) : 9.81;
  const windSpeedMs = !isNaN(Number(config.windSpeedMs)) ? Number(config.windSpeedMs) : 0;
  const airDragCoeff = Number(config.airDragCoeff) >= 0 ? Number(config.airDragCoeff) : 0;

  const baseDistanceMeters = Number(config.targetDistanceMeters ?? config.targetDistance ?? 480);
  const toleranceMeters = Number(config.toleranceMeters ?? 35);

  const [angle, setAngle] = useState<number>(Number(config.initialAngle ?? config.correctAngle ?? 42));
  const [power, setPower] = useState<number>(Number(config.initialPower ?? config.correctPower ?? 72));
  const [isFlying, setIsFlying] = useState<boolean>(false);
  const [attemptsUsed, setAttemptsUsed] = useState<number>(0);
  const [hitTargetIds, setHitTargetIds] = useState<Array<string | number>>([]);
  const [extraTargets, setExtraTargets] = useState<BallisticTarget[]>([]);
  const [activeStage, setActiveStage] = useState<BallisticStageModal | null>(null);
  const [triggeredStageIds, setTriggeredStageIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string>(
    config.instruction ||
      `Налаштуйте кут підйому та початкову швидкість для ураження цілі на відстані ${baseDistanceMeters} м.`
  );
  const [feedbackType, setFeedbackType] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [activeReaction, setActiveReaction] = useState<ReactionZone | null>(null);

  const [lastImpactMeters, setLastImpactMeters] = useState<{ x: number; y: number } | null>(null);
  const [lastTrailMeters, setLastTrailMeters] = useState<Array<{ x: number; y: number }>>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const configSignature = useMemo(() => JSON.stringify(config ?? {}), [config]);

  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setAngle(Number(config.initialAngle ?? config.correctAngle ?? 42));
    setPower(Number(config.initialPower ?? config.correctPower ?? 72));
    setIsFlying(false);
    setAttemptsUsed(0);
    setHitTargetIds([]);
    setExtraTargets([]);
    setActiveStage(null);
    setTriggeredStageIds([]);
    setLastImpactMeters(null);
    setLastTrailMeters([]);
    setFeedback(
      config.instruction ||
        `Налаштуйте кут підйому та початкову швидкість для ураження цілі на відстані ${baseDistanceMeters} м.`
    );
    setFeedbackType('neutral');
    setActiveReaction(null);
  }, [configSignature, baseDistanceMeters]);

  const baseTargets: BallisticTarget[] = useMemo(
    () =>
      Array.isArray(config.targets) && config.targets.length > 0
        ? config.targets.map((t) => ({
            ...t,
            distanceMeters: Number(t.distanceMeters || 400),
          }))
        : [
            {
              id: 'primary-target',
              distanceMeters: baseDistanceMeters,
              label: config.targetLabel || `Ціль (${baseDistanceMeters} м)`,
            },
          ],
    [config.targets, config.targetLabel, baseDistanceMeters]
  );

  const allTargets = useMemo(
    () => [...baseTargets, ...extraTargets],
    [baseTargets, extraTargets]
  );
  const maxTargetDist = useMemo(
    () => Math.max(800, ...allTargets.map((t) => t.distanceMeters + 120)),
    [allTargets]
  );

  const CANNON_X = 72;
  const CANNON_Y = 216;
  const BARREL_PIVOT_X = CANNON_X;
  const BARREL_PIVOT_Y = CANNON_Y - 10;
  const BARREL_LENGTH = 40;
  const GROUND_Y = 264;
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 280;

  const pxPerMeter = (CANVAS_WIDTH - CANNON_X - 55) / maxTargetDist;

  const metersToCanvasX = useCallback(
    (meters: number) => CANNON_X + meters * pxPerMeter,
    [pxPerMeter]
  );

  const metersToCanvasY = useCallback(
    (meters: number) => GROUND_Y - meters * pxPerMeter,
    [pxPerMeter]
  );

  const getMuzzleCanvasPos = useCallback(
    (deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return {
        x: BARREL_PIVOT_X + Math.cos(rad) * BARREL_LENGTH,
        y: BARREL_PIVOT_Y - Math.sin(rad) * BARREL_LENGTH,
      };
    },
    [BARREL_PIVOT_X, BARREL_PIVOT_Y]
  );

  const playShotSound = () => {
    musicalSynth.setVolume(soundEngine.getVolume());
    musicalSynth.setMuted(soundEngine.getIsMuted());
    musicalSynth.playExerciseCue('launch');
  };

  const playImpactSound = () => {
    musicalSynth.setVolume(soundEngine.getVolume());
    musicalSynth.setMuted(soundEngine.getIsMuted());
    musicalSynth.playExerciseCue('impact');
  };

  const drawScene = useCallback(
    (
      ballPos?: { x: number; y: number },
      trail: Array<{ x: number; y: number }> = []
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const theme = readThemeColors();
      const preset = config.themePreset || 'river';
      const isWater = preset === 'river' || preset === 'fortress' || preset === 'day_river';
      const isSpace = preset === 'space' || preset === 'night_sky';

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 1. Sky / Background driven 100% by CSS Variables
      const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      skyGrad.addColorStop(0, isSpace ? theme.surfaceAlt : theme.bg);
      skyGrad.addColorStop(1, theme.surface);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y);

      // Subtle atmospheric dots or clouds using theme tokens
      if (isSpace) {
        ctx.fillStyle = theme.textMuted;
        [
          [120, 42],
          [240, 28],
          [380, 65],
          [510, 35],
          [660, 55],
          [730, 24],
        ].forEach(([sx, sy]) => {
          ctx.beginPath();
          ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (preset !== 'lab') {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = theme.surfaceAlt;
        ctx.beginPath();
        ctx.arc(170, 44, 16, 0, Math.PI * 2);
        ctx.arc(190, 38, 20, 0, Math.PI * 2);
        ctx.arc(212, 44, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Ground / Water surface (hatched pattern for monochrome & textured clarity)
      ctx.fillStyle = isWater
        ? createCanvasHatchPattern(ctx, theme.borderHover, theme.surfaceAlt, 10, 1.5)
        : theme.surfaceAlt;
      ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

      ctx.strokeStyle = theme.borderHover;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
      ctx.stroke();

      // Distance scale ticks
      ctx.fillStyle = theme.text;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      for (let m = 100; m < maxTargetDist; m += 100) {
        const tx = metersToCanvasX(m);
        if (tx < CANVAS_WIDTH - 20) {
          ctx.fillRect(tx, GROUND_Y - 3, 1, 6);
          ctx.fillText(`${m}м`, tx, GROUND_Y + 13);
        }
      }

      // 3. Launch Platform
      ctx.fillStyle = theme.border;
      ctx.strokeStyle = theme.text;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT);
      ctx.lineTo(0, CANNON_Y - 36);
      ctx.lineTo(88, CANNON_Y);
      ctx.lineTo(118, GROUND_Y + 8);
      ctx.lineTo(126, CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.moveTo(0, CANNON_Y - 36);
      ctx.lineTo(88, CANNON_Y);
      ctx.lineTo(94, CANNON_Y + 5);
      ctx.lineTo(0, CANNON_Y - 22);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = theme.primaryDark;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(config.launcherLabel || 'Балістична позиція', 10, CANNON_Y - 46);

      // 4. Targets
      allTargets.forEach((target) => {
        const isHit = hitTargetIds.includes(target.id);
        const targetX = metersToCanvasX(target.distanceMeters);
        const targetY = isHit ? GROUND_Y + 5 : GROUND_Y - 6;

        ctx.save();
        if (isHit) {
          ctx.translate(targetX, targetY);
          ctx.rotate(0.2);
          ctx.translate(-targetX, -targetY);
        }

        if (config.targetSymbol) {
          ctx.font = '26px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(isHit ? '💥' : config.targetSymbol, targetX, targetY - 8);
        } else if (isWater) {
          // Vessel silhouette using theme tokens
          ctx.fillStyle = isHit ? theme.textMuted : theme.accent;
          ctx.strokeStyle = theme.text;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(targetX - 22, targetY);
          ctx.lineTo(targetX + 28, targetY);
          ctx.lineTo(targetX + 20, targetY + 14);
          ctx.lineTo(targetX - 15, targetY + 14);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          if (!isHit) {
            ctx.fillStyle = theme.text;
            ctx.fillRect(targetX - 4, targetY - 38, 3, 38);
            ctx.fillStyle = theme.surface;
            ctx.strokeStyle = theme.borderHover;
            ctx.beginPath();
            ctx.moveTo(targetX - 2, targetY - 36);
            ctx.quadraticCurveTo(targetX + 14, targetY - 22, targetX - 2, targetY - 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.fillStyle = theme.errBg;
            ctx.strokeStyle = theme.errBorder;
            ctx.beginPath();
            ctx.arc(targetX, targetY - 8, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = theme.errText;
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💥', targetX, targetY - 4);
          }
        } else {
          ctx.fillStyle = isHit ? theme.okBorder : theme.errBorder;
          ctx.beginPath();
          ctx.arc(targetX, GROUND_Y - 15, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = theme.surface;
          ctx.beginPath();
          ctx.arc(targetX, GROUND_Y - 15, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = isHit ? theme.okBorder : theme.accent;
          ctx.beginPath();
          ctx.arc(targetX, GROUND_Y - 15, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // 4.5 Anti-overlap target labels (vertical stagger tiers when horizontal gaps < 92px)
      const labelEntries = allTargets
        .map((target) => {
          const isHit = hitTargetIds.includes(target.id);
          return {
            id: target.id,
            x: metersToCanvasX(target.distanceMeters),
            baseY: (isHit ? GROUND_Y + 5 : GROUND_Y - 6) - 46,
            text: target.label || `${config.targetLabel || 'Ціль'} (${target.distanceMeters}м)`,
          };
        })
        .sort((a, b) => a.x - b.x);

      let prevTierEndX = [-Infinity, -Infinity, -Infinity];
      labelEntries.forEach((entry) => {
        const halfW = Math.max(36, Math.min(72, entry.text.length * 3.1));
        let chosenTier = 0;
        for (let t = 0; t < 3; t++) {
          if (entry.x - halfW > prevTierEndX[t] + 6) {
            chosenTier = t;
            break;
          }
          chosenTier = (t + 1) % 3;
        }
        prevTierEndX[chosenTier] = entry.x + halfW;

        const labelY = Math.max(18, entry.baseY - chosenTier * 15);
        ctx.save();
        if (chosenTier > 0) {
          ctx.strokeStyle = theme.borderHover;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(entry.x, entry.baseY + 4);
          ctx.lineTo(entry.x, labelY + 3);
          ctx.stroke();
        }
        ctx.fillStyle = theme.text;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(entry.text, entry.x, labelY);
        ctx.restore();
      });

      // 5. Launcher barrel & carriage centered accurately on pivot
      const angleRad = (angle * Math.PI) / 180;
      ctx.save();
      ctx.translate(BARREL_PIVOT_X, BARREL_PIVOT_Y);
      ctx.rotate(-angleRad);
      // Main barrel extending from slight breech (-8) to exact muzzle tip (BARREL_LENGTH)
      ctx.fillStyle = theme.text;
      ctx.fillRect(-8, -6, BARREL_LENGTH + 8, 12);
      // Muzzle collar ring right at the barrel mouth
      ctx.fillStyle = theme.accent;
      ctx.fillRect(BARREL_LENGTH - 4, -7.5, 4, 15);
      ctx.restore();

      // Carriage wheel centered under the pivot
      ctx.beginPath();
      ctx.arc(BARREL_PIVOT_X, CANNON_Y - 4, 10, 0, Math.PI * 2);
      ctx.fillStyle = theme.accent;
      ctx.fill();
      ctx.strokeStyle = theme.text;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Trunnion pivot pin
      ctx.beginPath();
      ctx.arc(BARREL_PIVOT_X, BARREL_PIVOT_Y, 3, 0, Math.PI * 2);
      ctx.fillStyle = theme.surface;
      ctx.fill();

      // 6. Active or Saved Trail (stored in meters so scale shifts keep alignment)
      const activeTrail = ballPos
        ? trail
        : lastTrailMeters.map((pt) => ({
            x: metersToCanvasX(pt.x),
            y: metersToCanvasY(Math.max(0, pt.y)),
          }));
      for (let i = 0; i < activeTrail.length; i++) {
        const pt = activeTrail[i];
        ctx.save();
        ctx.globalAlpha = Math.max(0.15, i / Math.max(1, activeTrail.length)) * 0.7;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (i / Math.max(1, activeTrail.length)) * 4 + 1, 0, Math.PI * 2);
        ctx.fillStyle = theme.accent;
        ctx.fill();
        ctx.restore();
      }

      // 7. Active or Saved Projectile / Impact position
      const activeBall =
        ballPos ||
        (lastImpactMeters
          ? {
              x: metersToCanvasX(lastImpactMeters.x),
              y: metersToCanvasY(Math.max(0, lastImpactMeters.y)),
            }
          : null);
      if (activeBall) {
        if (config.projectileSymbol && ballPos) {
          ctx.font = '18px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(config.projectileSymbol, activeBall.x, activeBall.y + 6);
        } else {
          ctx.beginPath();
          ctx.arc(activeBall.x, activeBall.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = ballPos ? theme.text : theme.errText;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(activeBall.x - 3, activeBall.y + 2, 3, 0, Math.PI * 2);
          ctx.fillStyle = theme.hlBorder;
          ctx.fill();
        }
      }
    },
    [
      angle,
      allTargets,
      config,
      hitTargetIds,
      maxTargetDist,
      metersToCanvasX,
      metersToCanvasY,
      lastTrailMeters,
      lastImpactMeters,
      themeMode,
      BARREL_PIVOT_X,
      BARREL_PIVOT_Y,
    ]
  );

  // Redraw synchronously whenever scene state changes (hits, new targets, sliders, theme, reset)
  useLayoutEffect(() => {
    if (!isFlying) {
      drawScene();
    }
  }, [isFlying, drawScene]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const launchProjectile = () => {
    if (isFlying || isReadOnly) return;
    setIsFlying(true);
    setAttemptsUsed((prev) => prev + 1);
    setActiveReaction(null);
    playShotSound();
    setFeedback('Політ снаряда по балістичній траєкторії...');
    setFeedbackType('neutral');

    const preset = config.themePreset || 'river';
    const isWater = preset === 'river' || preset === 'fortress' || preset === 'day_river';
    const angleRad = (angle * Math.PI) / 180;
    const muzzle = getMuzzleCanvasPos(angle);
    let xMeters = (muzzle.x - CANNON_X) / pxPerMeter;
    let yMeters = (GROUND_Y - muzzle.y) / pxPerMeter;
    let vx = Math.cos(angleRad) * power;
    let vy = Math.sin(angleRad) * power;

    const trailMeters: Array<{ x: number; y: number }> = [{ x: xMeters, y: yMeters }];
    let lastTime = performance.now();
    let frameCount = 0;

    const activePool = allTargets.filter((t) => !hitTargetIds.includes(t.id));
    const searchTargets = activePool.length > 0 ? activePool : allTargets;

    const checkDirectTargetTouch = (curX: number, curY: number): BallisticTarget | undefined => {
      const px = metersToCanvasX(curX);
      const py = metersToCanvasY(Math.max(0, curY));
      return searchTargets.find((t) => {
        if (toleranceMeters <= 12 && Math.abs(curX - t.distanceMeters) > toleranceMeters) {
          return false;
        }
        const tX = metersToCanvasX(t.distanceMeters);
        if (config.targetSymbol) {
          return Math.hypot(px - tX, py - (GROUND_Y - 20)) <= 16;
        }
        if (isWater) {
          const hitsHull =
            px >= tX - 22 && px <= tX + 28 && py >= GROUND_Y - 9 && py <= GROUND_Y + 6;
          const hitsSail =
            px >= tX - 6 && px <= tX + 14 && py >= GROUND_Y - 42 && py <= GROUND_Y - 8;
          return hitsHull || hitsSail;
        }
        return Math.hypot(px - tX, py - (GROUND_Y - 15)) <= 16;
      });
    };

    const handleTargetHit = (matchedTarget: BallisticTarget, hitX: number, hitY: number) => {
      setIsFlying(false);
      playImpactSound();
      setLastImpactMeters({ x: hitX, y: Math.max(0, hitY) });
      setLastTrailMeters([...trailMeters]);

      const updatedHits = hitTargetIds.includes(matchedTarget.id)
        ? hitTargetIds
        : [...hitTargetIds, matchedTarget.id];
      setHitTargetIds(updatedHits);

      const remainingCount = Math.max(0, allTargets.length - updatedHits.length);
      setFeedback(
        config.successMessage ||
          config.customSuccessText ||
          (remainingCount > 0
            ? `Пряме влучання! Ціль (${matchedTarget.label || `${matchedTarget.distanceMeters} м`}) уражено. Залишилось цілей: ${remainingCount}.`
            : `Пряме влучання! Ціль (${matchedTarget.label || `${matchedTarget.distanceMeters} м`}) уражено на дальності ${Math.round(hitX)} м.`)
      );
      setFeedbackType('success');
      setActiveReaction(
        evaluateReactionZones(config.reactionZones, {
          outcome: 'hit',
          value: Math.round(hitX),
          target: matchedTarget.distanceMeters,
          diff: Math.round(Math.abs(hitX - matchedTarget.distanceMeters)),
          angle,
          power,
          attemptsUsed: attemptsUsed + 1,
        })
      );

      if (Array.isArray(config.stages) && config.stages.length > 0) {
        const nextStage = config.stages.find(
          (st) => st.triggerOnHitCount === updatedHits.length && !triggeredStageIds.includes(st.id)
        );
        if (nextStage) {
          setTriggeredStageIds((prev) => [...prev, nextStage.id]);
          setActiveStage(nextStage);
        }
      }
    };

    const stepPhysics = (now: number) => {
      try {
        if (!isStageVisibleRef.current) {
          animationRef.current = null;
          setIsFlying(false);
          return;
        }
        frameCount++;
        const realDt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;
        const speedMultiplier = prolongedAnimations ? 2.8 : 4.5;
        const totalSimDt = realDt * speedMultiplier;
        const subSteps = Math.max(1, Math.ceil(totalSimDt / 0.015));
        const dt = totalSimDt / subSteps;

        let touchedTarget: BallisticTarget | undefined;
        let groundReached = false;

        for (let s = 0; s < subSteps; s++) {
          const prevX = xMeters;
          const prevY = yMeters;

          const relVx = vx - windSpeedMs;
          const speed = Math.hypot(relVx, vy);
          const dragAx = -airDragCoeff * speed * relVx;
          const dragAy = -airDragCoeff * speed * vy;

          vx += dragAx * dt;
          vy += (-gravity + dragAy) * dt;

          xMeters += vx * dt;
          yMeters += vy * dt;

          if (xMeters > 45) {
            touchedTarget = checkDirectTargetTouch(xMeters, yMeters);
            if (touchedTarget) {
              trailMeters.push({ x: xMeters, y: Math.max(0, yMeters) });
              break;
            }
          }

          if (yMeters <= 0) {
            const frac = prevY > 0 ? prevY / (prevY - yMeters) : 1;
            xMeters = prevX + (xMeters - prevX) * frac;
            yMeters = 0;
            groundReached = true;
            trailMeters.push({ x: xMeters, y: 0 });
            break;
          }
        }

        if (!touchedTarget && !groundReached) {
          trailMeters.push({ x: xMeters, y: Math.max(0, yMeters) });
        }
        if (trailMeters.length > 75) trailMeters.shift();

        if (touchedTarget) {
          handleTargetHit(touchedTarget, xMeters, yMeters);
          return;
        }

        if (groundReached) {
          const splashTolerance = Math.min(toleranceMeters, isWater ? 24 : 16);
          const splashHit = searchTargets.find(
            (t) => Math.abs(xMeters - t.distanceMeters) <= splashTolerance
          );
          if (splashHit) {
            handleTargetHit(splashHit, xMeters, 0);
            return;
          }

          setIsFlying(false);
          playImpactSound();
          setLastImpactMeters({ x: xMeters, y: 0 });
          setLastTrailMeters([...trailMeters]);

          const nearest = searchTargets[0]?.distanceMeters ?? baseDistanceMeters;
          const diff = Math.abs(xMeters - nearest);
          const isNearMiss = diff <= toleranceMeters * 2.5;
          const outcome = xMeters < nearest ? 'undershoot' : 'overshoot';

          if (outcome === 'undershoot') {
            setFeedback(
              config.customUndershootText ||
                config.failureMessage ||
                `Недоліт (${Math.round(xMeters)} м із потрібних ${nearest} м). Збільште початкову швидкість або скоригуйте кут.`
            );
          } else {
            setFeedback(
              config.customOvershootText ||
                config.failureMessage ||
                `Переліт (${Math.round(xMeters)} м замість ${nearest} м). Зменште початкову швидкість або змініть кут.`
            );
          }
          setFeedbackType('error');

          setActiveReaction(
            evaluateReactionZones(config.reactionZones, {
              outcome: isNearMiss ? 'near_miss' : outcome,
              value: Math.round(xMeters),
              target: nearest,
              diff: Math.round(diff),
              angle,
              power,
              attemptsUsed: attemptsUsed + 1,
            })
          );
          return;
        }

        if (xMeters > maxTargetDist + 120 || frameCount > 450) {
          setIsFlying(false);
          setLastImpactMeters({ x: xMeters, y: Math.max(0, yMeters) });
          setLastTrailMeters([...trailMeters]);

          const nearest = searchTargets[0]?.distanceMeters ?? baseDistanceMeters;
          const diff = Math.abs(xMeters - nearest);
          setFeedback(
            config.customOvershootText ||
              config.failureMessage ||
              `Переліт (${Math.round(xMeters)} м замість ${nearest} м). Зменште початкову швидкість або змініть кут.`
          );
          setFeedbackType('error');
          setActiveReaction(
            evaluateReactionZones(config.reactionZones, {
              outcome: 'overshoot',
              value: Math.round(xMeters),
              target: nearest,
              diff: Math.round(diff),
              angle,
              power,
              attemptsUsed: attemptsUsed + 1,
            })
          );
          return;
        }

        const px = metersToCanvasX(xMeters);
        const py = metersToCanvasY(Math.max(0, yMeters));
        const trailPx = trailMeters.map((pt) => ({
          x: metersToCanvasX(pt.x),
          y: metersToCanvasY(Math.max(0, pt.y)),
        }));
        drawScene({ x: px, y: py }, trailPx);

        animationRef.current = requestAnimationFrame(stepPhysics);
      } catch (err) {
        console.error('Ballistic simulation crash prevented:', err);
        setIsFlying(false);
        setFeedback('Помилка симуляції траєкторії. Спробуйте змінити параметри.');
        setFeedbackType('error');
      }
    };

    animationRef.current = requestAnimationFrame((now) => {
      lastTime = now;
      stepPhysics(now);
    });
  };

  const handleCloseStage = () => {
    if (activeStage?.reinforceTargets && activeStage.reinforceTargets.length > 0) {
      const existingIds = new Set(allTargets.map((t) => t.id));
      const additions = activeStage.reinforceTargets.filter((t) => !existingIds.has(t.id));
      if (additions.length > 0) {
        setExtraTargets((prev) => [...prev, ...additions]);
        setFeedbackType('neutral');
        setFeedback(
          `З’явилися нові цілі (+${additions.length})! Налаштуйте кут і швидкість для наступного пострілу.`
        );
      }
    }
    setActiveStage(null);
  };

  return (
    <div className="p-4 sm:p-6 bg-[var(--surface)] border-2 border-[var(--border)] rounded-[var(--radius-md)] space-y-4 shadow-card text-[var(--text)] relative">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-[var(--primary-dark)] uppercase tracking-wide flex items-center gap-1.5">
          <span>🎯</span> <span>{config?.title || 'Універсальний балістичний рушій'}</span>
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text)] font-mono font-bold">
          <span className="surface-subtle px-2.5 py-1 rounded-[var(--radius-sm)]">
            g = {gravity} м/с²
          </span>
          {windSpeedMs !== 0 && (
            <span className="surface-subtle px-2.5 py-1 rounded-[var(--radius-sm)]">
              Вітер: {windSpeedMs > 0 ? `+${windSpeedMs}` : windSpeedMs} м/с
            </span>
          )}
          <span className="surface-subtle px-2.5 py-1 rounded-[var(--radius-sm)]">
            Уражено: {hitTargetIds.length}/{allTargets.length}
          </span>
          {attemptsUsed > 0 && (
            <button
              type="button"
              onClick={() => {
                setAttemptsUsed(0);
                setLastImpactMeters(null);
                setLastTrailMeters([]);
                setActiveReaction(null);
                setFeedback('Спроби скинуто. Налаштуйте параметри для нового пострілу.');
                setFeedbackType('neutral');
              }}
              className="text-[10px] text-[var(--primary-dark)] underline hover:text-[var(--accent)] cursor-pointer"
            >
              🔄 Скинути
            </button>
          )}
        </div>
      </div>

      {/* Responsive SafeCanvasStage with external non-clipping overlay & 0% CPU idle sleep */}
      <SafeCanvasStage
        isIdleSleeping={!isFlying}
        onVisibilityChange={(visible) => {
          isStageVisibleRef.current = visible;
          if (!visible && animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
            setIsFlying(false);
          }
        }}
        mobileHint={`Кут ${angle}° · Швидкість ${power} м/с · Цілі: ${hitTargetIds.length}/${allTargets.length}`}
        mobileFullHelp={
          config.instruction ||
          `Налаштуйте кут підйому (5°–85°) та початкову швидкість (30–120 м/с), щоб уразити всі цілі (прискорення вільного падіння g = ${gravity} м/с²${windSpeedMs !== 0 ? `, вітер ${windSpeedMs} м/с` : ''}).`
        }
        overlaySlot={
          activeReaction ? <ReactionBubble reaction={activeReaction} /> : null
        }
      >
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-auto aspect-[20/7] block"
          />

          {/* Optional YAML-driven Stage Overlay */}
          {activeStage && (
            <div className="absolute inset-0 bg-[var(--modal-scrim)] backdrop-blur-xs flex items-center justify-center p-4 z-30 animate-fadeIn">
              <div className="p-4 sm:p-5 bg-[var(--surface)] border-2 border-[var(--hl-border)] rounded-[var(--radius-lg)] text-[var(--text)] text-center space-y-3 max-w-md shadow-2xl max-h-full overflow-y-auto">
                <div className="text-lg sm:text-xl font-black text-[var(--primary-dark)] flex items-center justify-center gap-2">
                  {activeStage.icon && <span>{activeStage.icon}</span>}
                  <span>{activeStage.title}</span>
                </div>

                <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] space-y-2 text-xs text-left">
                  {activeStage.subtitle && (
                    <p className="font-extrabold text-[var(--primary-dark)]">
                      {activeStage.subtitle}
                    </p>
                  )}
                  <p className="font-medium text-[var(--text)] leading-relaxed">
                    {activeStage.body}
                  </p>
                  {activeStage.callout && (
                    <p className="guidance-box">
                      {activeStage.callout}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCloseStage}
                  className="btn btn-accent btn-block text-xs"
                >
                  {activeStage.buttonLabel || 'Продовжити'}
                </button>
              </div>
            </div>
          )}
        </div>
      </SafeCanvasStage>

      {/* Interactive Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 surface-subtle p-4 rounded-[var(--radius-sm)] items-center">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[var(--text-muted)]">
            Кут запуску: <span className="text-[var(--primary-dark)] font-extrabold">{angle}°</span>
          </label>
          <input
            type="range"
            min="5"
            max="85"
            disabled={isFlying || isReadOnly}
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
            className="accent-[var(--accent)] cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[var(--text-muted)]">
            Початкова швидкість: <span className="text-[var(--primary-dark)] font-extrabold">{power} м/с</span>
          </label>
          <input
            type="range"
            min="30"
            max="120"
            disabled={isFlying || isReadOnly}
            value={power}
            onChange={(e) => setPower(Number(e.target.value))}
            className="accent-[var(--accent)] cursor-pointer"
          />
        </div>

        <button
          type="button"
          disabled={isFlying || isReadOnly}
          onClick={launchProjectile}
          className="btn btn-accent text-xs py-3 px-6"
        >
          {isFlying ? '⏳ Політ снаряда...' : '🚀 Запустити траєкторію'}
        </button>
      </div>

      {/* STATUS BANNER */}
      <div className="min-h-12 flex items-center justify-center flex-col gap-2">
        <div
          className={`w-full status-panel text-center transition-all ${
            feedbackType === 'success'
              ? 'status-panel--success'
              : feedbackType === 'error'
              ? 'status-panel--warning'
              : 'status-panel--neutral'
          }`}
        >
          {feedback}
        </div>

        {feedbackType === 'success' &&
          !activeStage &&
          allTargets.length > 0 &&
          hitTargetIds.length >= allTargets.length &&
          onSubmitAnswer && (
            <button
              type="button"
              onClick={() =>
                onSubmitAnswer({
                  angle,
                  power,
                  targetId: hitTargetIds[hitTargetIds.length - 1],
                  hitTargetIds,
                })
              }
              className="btn btn-primary text-xs py-2 px-5 animate-pulse cursor-pointer"
            >
              🎯 Продовжити навчальний матеріал ➔
            </button>
          )}
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { IndentedDiagramSvg } from '../../core/diagrams/IndentedDiagramSvg';
import { useProfileStore } from '../../core/state/useProfileStore';
import { useFeedbackStore } from '../../core/state/useFeedbackStore';
import {
  FAMILY_COOP_MISSIONS,
  TEAM_ROLE_BLUEPRINTS,
  TEAM_TRANSPORT_BLUEPRINTS,
} from './coopMissions';
import { useCoopSessionStore } from './useCoopSessionStore';

interface CoopTableViewProps {
  onClose?: () => void;
}

export const CoopTableView: React.FC<CoopTableViewProps> = ({ onClose }) => {
  const {
    activeTab,
    pilotName,
    navigatorName,
    isRolesSwapped,
    activeMissionIndex,
    activeStepIndex,
    navigatorHintRevealed,
    completedStepIds,
    completedMissionIds,
    teamActiveRole,
    teamTransport,
    setActiveTab,
    setPlayerNames,
    swapRoles,
    selectMission,
    selectStep,
    toggleNavigatorHint,
    markStepCompleted,
    rotateTeamRolePreview,
    setTeamTransportPreview,
  } = useCoopSessionStore();

  const { addTraitPoints, addResources, addJournalEntry } = useProfileStore();
  const { notify } = useFeedbackStore();

  const mission = FAMILY_COOP_MISSIONS[activeMissionIndex] || FAMILY_COOP_MISSIONS[0];
  const step = mission.steps[activeStepIndex] || mission.steps[0];

  const [numericInput, setNumericInput] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<string>('');
  const [sliderValue, setSliderValue] = useState<number>(step.sliderConfig?.initial ?? 50);
  const [stepFeedback, setStepFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setNumericInput('');
    setSelectedChoice('');
    setSliderValue(step.sliderConfig?.initial ?? 50);
    setStepFeedback(null);
  }, [mission.id, step.id, step.sliderConfig?.initial]);

  const effectiveNavigator = isRolesSwapped ? pilotName : navigatorName;
  const effectivePilot = isRolesSwapped ? navigatorName : pilotName;
  const isCurrentStepDone = completedStepIds.includes(step.id);

  const handleSubmitPilotAction = (e: React.FormEvent) => {
    e.preventDefault();

    let isCorrect = false;
    if (step.controlType === 'numeric') {
      const normalized = Number(numericInput.replace(',', '.').trim());
      const expected = Number(step.expectedAnswer);
      const tol = step.tolerance ?? 0.01;
      isCorrect = Number.isFinite(normalized) && Math.abs(normalized - expected) <= tol;
    } else if (step.controlType === 'slider') {
      const expected = Number(step.expectedAnswer);
      const tol = step.tolerance ?? 0;
      isCorrect = Math.abs(sliderValue - expected) <= tol;
    } else {
      isCorrect = selectedChoice === String(step.expectedAnswer);
    }

    if (!isCorrect) {
      setStepFeedback({
        ok: false,
        text: `Спробуйте узгодити рішення ще раз: Штурман (${effectiveNavigator}) може перевірити умову або відкрити підказку.`,
      });
      return;
    }

    const missionJustCompleted = markStepCompleted(step.id, mission.id, mission.steps.length);
    setStepFeedback({
      ok: true,
      text: step.successReflection,
    });

    if (missionJustCompleted) {
      addTraitPoints('collaboration', mission.rewardPoints.collaboration);
      addTraitPoints('leadership', mission.rewardPoints.leadership);
      addResources({ energy: mission.rewardPoints.energy });
      addJournalEntry({
        taskTitle: `Co-op «${mission.title}»`,
        reflectionText: `Спільне проходження (${effectiveNavigator} та ${effectivePilot}): отримано +${mission.rewardPoints.collaboration} до співпраці та +${mission.rewardPoints.leadership} до лідерства.`,
        traitBoosted: 'collaboration',
      });
      notify(
        `Місію «${mission.title}» пройдено разом! +${mission.rewardPoints.collaboration} Співпраця, +${mission.rewardPoints.leadership} Лідерство, +${mission.rewardPoints.energy} Енергії`,
        'success'
      );
    } else {
      notify('Етап пройдено! Можете помінятися ролями й перейти до наступного кроку.', 'success');
    }
  };

  return (
    <div className="space-y-4 text-xs sm:text-sm">
      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'family' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('family')}
          >
            🚀 Сімейний Co-op «Пілот і Штурман»
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'team_blueprint' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('team_blueprint')}
          >
            👥 Командний стіл (2–4 ролі · Каркас)
          </Button>
        </div>

        {onClose && (
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            Закрити
          </Button>
        )}
      </div>

      {activeTab === 'family' ? (
        <div className="space-y-4">
          {/* Player Names & Role Swap Bar */}
          <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                  {isRolesSwapped ? '🧭 Зараз Штурман' : '🚀 Зараз Пілот'} (Учасник 1)
                </label>
                <input
                  type="text"
                  value={pilotName}
                  onChange={(e) => setPlayerNames(e.target.value, navigatorName)}
                  className="input-field py-1.5 text-xs w-full"
                  placeholder="Ім’я першого гравця"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                  {isRolesSwapped ? '🚀 Зараз Пілот' : '🧭 Зараз Штурман'} (Учасник 2)
                </label>
                <input
                  type="text"
                  value={navigatorName}
                  onChange={(e) => setPlayerNames(pilotName, e.target.value)}
                  className="input-field py-1.5 text-xs w-full"
                  placeholder="Ім’я другого гравця"
                />
              </div>
            </div>

            <Button type="button" size="sm" variant="accent" onClick={swapRoles} className="shrink-0">
              ⇄ Помінятися ролями
            </Button>
          </div>

          {/* Mission Picker */}
          <div className="flex flex-wrap gap-1.5">
            {FAMILY_COOP_MISSIONS.map((m, idx) => {
              const isDone = completedMissionIds.includes(m.id);
              return (
                <Button
                  key={m.id}
                  type="button"
                  size="sm"
                  variant={activeMissionIndex === idx ? 'primary' : 'outline'}
                  onClick={() => selectMission(idx)}
                >
                  {isDone ? '✓ ' : ''}
                  {m.title}
                </Button>
              );
            })}
          </div>

          {/* Mission Info + Step Indicator */}
          <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-[var(--primary-dark)]">{mission.title}</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {mission.subjectLabel} · {mission.difficultyLabel} — {mission.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mission.steps.map((st, sIdx) => {
                  const stDone = completedStepIds.includes(st.id);
                  return (
                    <Button
                      key={st.id}
                      type="button"
                      size="sm"
                      variant={activeStepIndex === sIdx ? 'accent' : 'outline'}
                      onClick={() => selectStep(sIdx)}
                    >
                      {stDone ? '✓ ' : ''}
                      Етап {sIdx + 1}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Dual Role Split: Navigator Deck + Pilot Console */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            {/* NAVIGATOR ZONE */}
            <div className="card space-y-3 flex flex-col justify-between bg-[var(--surface)]">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
                  <span className="font-extrabold text-xs sm:text-sm text-[var(--primary-dark)]">
                    🧭 Зона Штурмана — {effectiveNavigator}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--hl-bg)] text-[var(--hl-text)]">
                    Карта та стратегія
                  </span>
                </div>

                <div className="text-xs font-extrabold text-[var(--text)]">{step.title}</div>
                <p className="text-xs sm:text-sm leading-relaxed text-[var(--text)]">
                  {step.navigatorBriefing}
                </p>

                {step.navigatorDiagram && (
                  <IndentedDiagramSvg
                    sourceText={step.navigatorDiagram}
                    title="Навігаційна схема"
                  />
                )}
              </div>

              <div className="pt-2 border-t border-[var(--border)] space-y-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={toggleNavigatorHint}
                >
                  {navigatorHintRevealed
                    ? '🔽 Сховати підказку Штурмана'
                    : '💡 Відкрити підказку для усного пояснення'}
                </Button>

                {navigatorHintRevealed && (
                  <div className="p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs leading-relaxed">
                    <strong>Порада для {effectiveNavigator}:</strong> {step.navigatorStrategyHint}
                  </div>
                )}
              </div>
            </div>

            {/* PILOT CONSOLE */}
            <form
              onSubmit={handleSubmitPilotAction}
              className="card space-y-3 flex flex-col justify-between bg-[var(--surface)]"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
                  <span className="font-extrabold text-xs sm:text-sm text-[var(--primary-dark)]">
                    🚀 Пульт Пілота — {effectivePilot}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text)]">
                    Керування дією
                  </span>
                </div>

                <p className="text-xs sm:text-sm font-bold leading-relaxed text-[var(--text)]">
                  {step.pilotPrompt}
                </p>

                {step.controlType === 'numeric' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={numericInput}
                      onChange={(e) => setNumericInput(e.target.value)}
                      placeholder="Введіть число..."
                      className="input-field py-2 text-sm font-mono flex-1"
                    />
                    {step.unit && (
                      <span className="font-mono font-bold text-xs text-[var(--text-muted)]">
                        {step.unit}
                      </span>
                    )}
                  </div>
                )}

                {step.controlType === 'slider' && step.sliderConfig && (
                  <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>Поточне значення регулятора:</span>
                      <span className="font-mono text-base text-[var(--primary-dark)] tabular-nums">
                        {sliderValue} {step.sliderConfig.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={step.sliderConfig.min}
                      max={step.sliderConfig.max}
                      step={step.sliderConfig.step}
                      value={sliderValue}
                      onChange={(e) => setSliderValue(Number(e.target.value))}
                      className="w-full accent-[var(--accent)]"
                    />
                    <div className="flex justify-between text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                      <span>
                        {step.sliderConfig.min} {step.sliderConfig.unit}
                      </span>
                      <span>
                        {step.sliderConfig.max} {step.sliderConfig.unit}
                      </span>
                    </div>
                  </div>
                )}

                {step.controlType === 'choices' && step.options && (
                  <div className="grid grid-cols-1 gap-2">
                    {step.options.map((opt, idx) => (
                      <Button
                        key={opt}
                        type="button"
                        size="sm"
                        variant={selectedChoice === opt ? 'primary' : 'outline'}
                        onClick={() => setSelectedChoice(opt)}
                        className="justify-start text-left"
                      >
                        <span className="font-mono mr-1.5">{String.fromCharCode(65 + idx)}.</span>
                        <span>{opt}</span>
                      </Button>
                    ))}
                  </div>
                )}

                {stepFeedback && (
                  <div
                    className={`status-panel text-xs ${
                      stepFeedback.ok ? 'status-panel--success' : 'status-panel--warning'
                    }`}
                  >
                    {stepFeedback.text}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
                <Button type="submit" variant="primary" size="sm">
                  ✅ Підтвердити маневр
                </Button>

                {isCurrentStepDone && activeStepIndex < mission.steps.length - 1 && (
                  <Button
                    type="button"
                    variant="accent"
                    size="sm"
                    onClick={() => selectStep(activeStepIndex + 1)}
                  >
                    Наступний етап →
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* TEAM CO-OP STRUCTURAL FOUNDATION (2–4 ROLES WITH ROTATION) */
        <div className="space-y-4">
          <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-[var(--primary-dark)]">
                  👥 Командна офлайн-гра (2–4 учасники з ротацією ролей)
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Закладена типізована основа згідно з <code>TEAM_COOP_FUTURE_PLAN.md</code>. QR-протокол і
                  Web Bluetooth винесено на етап окремої деталізації.
                </p>
              </div>
              <Button type="button" size="sm" variant="accent" onClick={rotateTeamRolePreview}>
                🔄 Симулювати ротацію ролі
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TEAM_ROLE_BLUEPRINTS.map((roleInfo) => {
              const isActive = teamActiveRole === roleInfo.role;
              return (
                <div
                  key={roleInfo.role}
                  className="p-3 rounded-[var(--radius-sm)] border space-y-1.5 transition-all"
                  style={{
                    borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                    backgroundColor: isActive ? 'var(--hl-bg)' : 'var(--surface)',
                    color: isActive ? 'var(--hl-text)' : 'var(--text)',
                  }}
                >
                  <div className="flex items-center justify-between gap-1 font-extrabold text-xs">
                    <span>
                      {roleInfo.icon} {roleInfo.title}
                    </span>
                    {isActive && <span className="text-[10px]">Активна</span>}
                  </div>
                  <p className="text-[11px] leading-snug opacity-90">{roleInfo.responsibility}</p>
                  <div className="text-[10px] font-bold opacity-80 pt-1 border-t border-[var(--border)]">
                    Фокус: {roleInfo.rotationFocus}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <h4 className="font-extrabold text-xs text-[var(--primary-dark)] uppercase">
              Архітектура режимів без центрального сервера:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TEAM_TRANSPORT_BLUEPRINTS.map((tr) => {
                const selected = teamTransport === tr.transport;
                return (
                  <button
                    key={tr.transport}
                    type="button"
                    onClick={() => setTeamTransportPreview(tr.transport)}
                    className="p-3 rounded-[var(--radius-sm)] border text-left space-y-1 transition-all cursor-pointer"
                    style={{
                      borderColor: selected ? 'var(--accent)' : 'var(--border)',
                      backgroundColor: selected ? 'var(--surface-alt)' : 'var(--surface)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 font-extrabold text-xs text-[var(--primary-dark)]">
                      <span>
                        {tr.icon} {tr.title}
                      </span>
                      <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                        {tr.statusLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] leading-snug">{tr.summary}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

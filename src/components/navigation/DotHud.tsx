/**
 * DOT HUD — Bar + Clock + Alerts + Override system
 * 
 * Integrates with DotHosContext for real-time HOS tracking.
 * Two parallel states: DOT real (truth) + override (driver's choice).
 * Never blocks the map. Always shows the truth.
 * 
 * Fixes applied:
 * 1) Break warning math (needsBreak=true → breakRem=0, wins minRem)
 * 2) Alert triggers on violation type change (not only from 'none')
 * 3) Correct useEffect dependencies for alert logic
 * 4) Break reset UX (progress text when resting)
 * 5) Safer barFill (clamped)
 * 6) Separate dismiss X (short quiet, no override) vs Ignore (override + 30m quiet)
 * 7) Stop Now integration hook
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDotHosSafe } from '@/contexts/DotHosContext';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle, Square, X, RotateCcw, Coffee, Truck, Shield } from 'lucide-react';

// === Constants ===
const DRIVE_LIMIT_SEC = 11 * 3600;
const SHIFT_LIMIT_SEC = 14 * 3600;
const BREAK_REQUIRED_AFTER_SEC = 8 * 3600;
const BREAK_DURATION_SEC = 30 * 60;
const WARN_THRESHOLD_SEC = 15 * 60;
const QUIET_MINUTES = 30;
const DISMISS_QUIET_MINUTES = 5;

const OVERRIDE_STORAGE_KEY = 'dot_hud_override';

// === Types ===
interface OverrideState {
  overrideActive: boolean;
  quietUntilTs: number;
  overtimeStartTs: number | null;
}

type ViolationType = 'none' | 'break_due' | 'drive_exceeded' | 'shift_exceeded';
type BarVisual = 'green' | 'yellow' | 'red_blink' | 'red_fixed';

// === Helpers ===
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function fmtHM(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function loadOverride(): OverrideState {
  try {
    const raw = localStorage.getItem(OVERRIDE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { overrideActive: false, quietUntilTs: 0, overtimeStartTs: null };
}

function saveOverride(ov: OverrideState) {
  try {
    localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(ov));
  } catch { /* ignore */ }
}

// === Pure computation functions ===

function computeWarning(state: any): { warn: boolean; label: string; remainingSec: number } {
  if (!state) return { warn: false, label: '', remainingSec: 0 };

  const driveRem = state.drivingRemainingSec;
  const shiftRem = state.dutyRemainingSec;

  // Airbag 1: only count break as satisfied when actually resting
  const isResting = state.currentStatus === 'OFF_DUTY' || state.currentStatus === 'SLEEPER';
  const breakSatisfied = isResting && (state.restContinuousSec ?? 0) >= BREAK_DURATION_SEC;

  const breakRem = state.needsBreak
    ? 0
    : Math.max(0, BREAK_REQUIRED_AFTER_SEC - (state.breakDrivingSinceLastBreakSec ?? 0));

  // If needsBreak → 0 (urgent). If satisfied → Infinity (ignore). Otherwise → countdown.
  const breakCandidate = state.needsBreak ? 0 : (breakSatisfied ? Infinity : breakRem);

  const minRem = Math.min(driveRem, shiftRem, breakCandidate);
  const warn = minRem <= WARN_THRESHOLD_SEC && minRem > 0;

  let label = '';
  if (minRem === 0 && state.needsBreak) label = 'break';
  else if (minRem === breakCandidate) label = 'break';
  else if (minRem === driveRem) label = 'drive limit';
  else label = 'shift limit';

  return { warn, label, remainingSec: Math.max(0, minRem === Infinity ? 0 : minRem) };
}

function computeBarFill(state: any): number {
  if (!state) return 0;

  const driveFrac = clamp01((state.drivingTodaySec ?? 0) / DRIVE_LIMIT_SEC);

  // Fix B: use dutyWindowSec (consumed), fallback to computed from remaining
  const dutyConsumed = (state.dutyWindowSec ?? null) !== null
    ? state.dutyWindowSec
    : (SHIFT_LIMIT_SEC - (state.dutyRemainingSec ?? SHIFT_LIMIT_SEC));
  const shiftFrac = clamp01(dutyConsumed / SHIFT_LIMIT_SEC);

  const breakFrac = state.needsBreak
    ? 1
    : clamp01((state.breakDrivingSinceLastBreakSec ?? 0) / BREAK_REQUIRED_AFTER_SEC);

  return clamp01(Math.max(driveFrac, shiftFrac, breakFrac));
}

function getBreakClockText(state: any): { text: string; urgent: boolean } {
  if (!state) return { text: 'Break: —', urgent: false };

  if (state.needsBreak) return { text: 'Necessário ⚠️', urgent: true };

  const restSec = state.restContinuousSec ?? 0;
  const isResting = state.currentStatus === 'OFF_DUTY' || state.currentStatus === 'SLEEPER';

  // Actively resting but break not yet complete
  if (isResting && restSec > 0 && restSec < BREAK_DURATION_SEC) {
    return { text: `em progresso ${fmtHM(restSec)} / 00:30`, urgent: false };
  }

  // Break completed (must be resting to count)
  if (isResting && (state.breakDrivingSinceLastBreakSec ?? 0) === 0 && restSec >= BREAK_DURATION_SEC) {
    return { text: 'OK ✅', urgent: false };
  }

  // Countdown to when break will be required
  const remaining = Math.max(0, BREAK_REQUIRED_AFTER_SEC - (state.breakDrivingSinceLastBreakSec ?? 0));
  return { text: `em ${fmtHM(remaining)}`, urgent: remaining <= WARN_THRESHOLD_SEC };
}

// === Component ===
const DotHud = memo(function DotHud({ onStopNow }: { onStopNow?: () => void }) {
  const dotHos = useDotHosSafe();

  const [override, setOverride] = useState<OverrideState>(loadOverride);
  const [showClock, setShowClock] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [showResetMenu, setShowResetMenu] = useState(false);
  const [lastViolation, setLastViolation] = useState<ViolationType>('none');

  // Long-press refs
  const pressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  // Blink state
  const [blinkOn, setBlinkOn] = useState(true);

  // Airbag 2: force re-render every second during violation so overtimeText stays live
  const [, forceTick] = useState(0);

  const state = dotHos?.state;

  // Compute violation
  const violation: ViolationType = useMemo(() => {
    if (!state) return 'none';
    if (state.dutyRemainingSec <= 0) return 'shift_exceeded';
    if (state.drivingRemainingSec <= 0) return 'drive_exceeded';
    if (state.needsBreak) return 'break_due';
    return 'none';
  }, [state]);

  useEffect(() => {
    if (violation === 'none' || !override.overtimeStartTs) return;
    const t = setInterval(() => forceTick(v => (v + 1) % 1_000_000), 1000);
    return () => clearInterval(t);
  }, [violation, override.overtimeStartTs]);

  const warning = useMemo(() => computeWarning(state), [state]);

  // Bar visual state
  const barVisual: BarVisual = useMemo(() => {
    if (override.overrideActive && violation !== 'none') return 'red_fixed';
    if (violation !== 'none') return 'red_blink';
    if (warning.warn) return 'yellow';
    return 'green';
  }, [override.overrideActive, violation, warning.warn]);

  // Bar fill (fix #5 — clamped)
  const barFill = useMemo(() => computeBarFill(state), [state]);

  // Break clock text (fix #4)
  const breakInfo = useMemo(() => getBreakClockText(state), [state]);

  // Blink animation for red_blink
  useEffect(() => {
    if (barVisual !== 'red_blink') {
      setBlinkOn(true);
      return;
    }
    const timer = setInterval(() => setBlinkOn(v => !v), 500);
    return () => clearInterval(timer);
  }, [barVisual]);

  // Override persistence
  const updateOverride = useCallback((updater: (prev: OverrideState) => OverrideState) => {
    setOverride(prev => {
      const next = updater(prev);
      saveOverride(next);
      return next;
    });
  }, []);

  // Overtime tracking
  useEffect(() => {
    if (violation !== 'none') {
      updateOverride(prev => ({
        ...prev,
        overtimeStartTs: prev.overtimeStartTs ?? Date.now(),
      }));
    } else {
      updateOverride(prev => {
        if (!prev.overtimeStartTs) return prev;
        return { ...prev, overtimeStartTs: null };
      });
    }
  }, [violation, updateOverride]);

  // Fix C: alert effect using functional setLastViolation to avoid dep loop
  useEffect(() => {
    const inQuiet = override.quietUntilTs > 0 && Date.now() < override.quietUntilTs;

    setLastViolation(prev => {
      if (
        violation !== 'none' &&
        !inQuiet &&
        violation !== prev &&
        !override.overrideActive
      ) {
        setShowAlert(true);
      }

      if (violation === 'none') {
        setShowAlert(false);
      }

      return violation;
    });
  }, [violation, override.quietUntilTs, override.overrideActive]);

  // Overtime text
  const overtimeText = useMemo(() => {
    if (violation === 'none' || !override.overtimeStartTs) return null;
    const sec = Math.max(0, Math.floor((Date.now() - override.overtimeStartTs) / 1000));
    return `Overtime: +${fmtHM(sec)}`;
  }, [violation, override.overtimeStartTs]);

  // Handlers
  const closeAll = useCallback(() => {
    setShowActions(false);
    setShowAlert(false);
    setShowResetMenu(false);
  }, []);

  // Fix #6: separate dismiss (X) vs ignore
  const dismissAlert = useCallback(() => {
    const quietUntil = Date.now() + DISMISS_QUIET_MINUTES * 60 * 1000;
    updateOverride(prev => ({ ...prev, quietUntilTs: quietUntil })); // NO overrideActive
    setShowAlert(false);
  }, [updateOverride]);

  const ignoreAlert = useCallback(() => {
    const quietUntil = Date.now() + QUIET_MINUTES * 60 * 1000;
    updateOverride(prev => ({ ...prev, overrideActive: true, quietUntilTs: quietUntil }));
    setShowAlert(false);
  }, [updateOverride]);

  // Fix #7: Stop Now integration
  const handleStopNow = useCallback(() => {
    setShowAlert(false);
    closeAll();
    onStopNow?.();
  }, [onStopNow, closeAll]);

  const handleReset = useCallback((choice: 'break' | 'new_shift' | 'manual') => {
    if (!dotHos) return;

    if (choice === 'break') {
      dotHos.setStatus('OFF_DUTY');
      updateOverride(prev => ({ ...prev, overrideActive: false }));
    } else if (choice === 'new_shift') {
      dotHos.performFullReset();
      updateOverride(() => ({ overrideActive: false, quietUntilTs: 0, overtimeStartTs: null }));
    } else {
      // Manual non-compliant: override stays true
      updateOverride(prev => ({ ...prev, overrideActive: true }));
    }
    closeAll();
  }, [dotHos, updateOverride, closeAll]);

  // Touch handlers for tap/long-press
  const onPressStart = useCallback(() => {
    longPressFired.current = false;
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setShowActions(true);
      setShowResetMenu(false);
    }, 600);
  }, []);

  const onPressEnd = useCallback(() => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    if (!longPressFired.current) {
      setShowClock(v => !v);
    }
  }, []);

  if (!dotHos || !state) return null;

  // Color classes
  const barBgClass = barVisual === 'green' ? 'bg-green-900/40'
    : barVisual === 'yellow' ? 'bg-yellow-900/40'
    : 'bg-red-900/40';

  const barFillClass = barVisual === 'green' ? 'bg-green-500'
    : barVisual === 'yellow' ? 'bg-yellow-500'
    : barVisual === 'red_fixed' ? 'bg-red-600'
    : blinkOn ? 'bg-red-500' : 'bg-red-300';

  const ringClass = barVisual === 'red_blink' && !blinkOn ? 'ring-2 ring-red-400/75' : '';

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-1.5" style={{ minWidth: 140 }}>

      {/* === DOT BAR === */}
      <div
        onMouseDown={onPressStart}
        onMouseUp={onPressEnd}
        onTouchStart={onPressStart}
        onTouchEnd={onPressEnd}
        className="flex items-center gap-2 cursor-pointer select-none"
        role="button"
        aria-label="DOT Hours of Service"
      >
        <div className={cn(
          "relative w-28 h-3 rounded-full overflow-hidden shadow-lg backdrop-blur-sm border border-white/20",
          barBgClass, ringClass
        )}>
          <div
            className={cn("absolute top-0 left-0 h-full rounded-full transition-all duration-1000", barFillClass)}
            style={{ width: `${Math.max(6, Math.floor(barFill * 100))}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/80 drop-shadow-md">DOT</span>
      </div>

      {/* === DOT CLOCK (mini panel) === */}
      {showClock && (
        <div className="bg-gray-900/92 backdrop-blur-md text-white rounded-xl px-3 py-2.5 shadow-2xl border border-white/10 w-56">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-extrabold tracking-wide flex items-center gap-1">
              <Clock className="w-3 h-3" /> DOT
            </span>
            {override.overrideActive && (
              <span className="text-[9px] font-bold text-red-400 flex items-center gap-0.5">
                <Shield className="w-2.5 h-2.5" /> Override
              </span>
            )}
          </div>

          <div className="space-y-0.5 text-[11px] font-medium text-white/90">
            <div className="flex justify-between">
              <span>Drive:</span>
              <span className={cn(state.drivingRemainingSec <= WARN_THRESHOLD_SEC && 'text-yellow-400 font-bold')}>
                {fmtHM(state.drivingTodaySec)} / {fmtHM(DRIVE_LIMIT_SEC)}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Break:</span>
              <span className={cn(breakInfo.urgent && 'text-red-400 font-bold')}>
                {breakInfo.text}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Shift:</span>
              <span className={cn(state.dutyRemainingSec <= WARN_THRESHOLD_SEC && 'text-yellow-400 font-bold')}>
                {fmtHM(state.dutyWindowSec)} / {fmtHM(SHIFT_LIMIT_SEC)}
              </span>
            </div>

            {overtimeText && (
              <div className="text-red-400 font-extrabold pt-0.5">
                {overtimeText}
              </div>
            )}
          </div>

          {/* Warning banner inside clock */}
          {warning.warn && violation === 'none' && (
            <div className="mt-1.5 text-[10px] text-yellow-400 font-bold bg-yellow-500/10 rounded px-1.5 py-0.5">
              ⚠ {fmtHM(warning.remainingSec)} para {warning.label}
            </div>
          )}
        </div>
      )}

      {/* === VIOLATION ALERT === */}
      {showAlert && violation !== 'none' && (
        <div className="bg-gray-900/95 backdrop-blur-md text-white rounded-xl px-3 py-3 shadow-2xl border border-red-500/30 w-56 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Tempo DOT estourado
            </span>
            {/* Fix #6: X = dismiss (short quiet, no override) */}
            <button onClick={dismissAlert} className="p-0.5 hover:bg-white/10 rounded" aria-label="Dispensar">
              <X className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>
          <p className="text-[11px] text-white/80 mb-3">
            {violation === 'break_due' ? 'Break de 30 min necessário'
              : violation === 'drive_exceeded' ? 'Limite de 11h de direção excedido'
              : 'Limite de 14h de shift excedido'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleStopNow}
              className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-colors"
            >
              Parar agora
            </button>
            {/* Fix #6: Ignorar = override + 30min quiet */}
            <button
              onClick={ignoreAlert}
              className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-colors"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}

      {/* === ACTIONS MENU (long press) === */}
      {showActions && (
        <div className="bg-gray-900/95 backdrop-blur-md text-white rounded-xl px-3 py-3 shadow-2xl border border-white/10 w-60 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" /> Ações DOT
            </span>
            <button onClick={closeAll} className="p-0.5 hover:bg-white/10 rounded">
              <X className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>

          <div className="space-y-2">
            <button onClick={handleStopNow} className="w-full text-left text-[11px] font-semibold py-2 px-2.5 rounded-lg bg-green-500/15 border border-green-500/25 text-green-400 hover:bg-green-500/25 transition-colors flex items-center gap-2">
              <Square className="w-3 h-3" /> Parar agora
            </button>

            <button onClick={ignoreAlert} className="w-full text-left text-[11px] font-semibold py-2 px-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" /> Ignorar alerta (silenciar {QUIET_MINUTES}min)
            </button>

            <button onClick={() => { setShowResetMenu(true); setShowActions(false); }} className="w-full text-left text-[11px] font-semibold py-2 px-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2">
              <RotateCcw className="w-3 h-3" /> Reiniciar contagem...
            </button>
          </div>

          <p className="text-[9px] text-white/40 mt-2">Toque longo na barra abre este menu</p>
        </div>
      )}

      {/* === RESET MENU === */}
      {showResetMenu && (
        <div className="bg-gray-900/95 backdrop-blur-md text-white rounded-xl px-3 py-3 shadow-2xl border border-white/10 w-60 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
            </span>
            <button onClick={closeAll} className="p-0.5 hover:bg-white/10 rounded">
              <X className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>

          <div className="space-y-2">
            <button onClick={() => handleReset('break')} className="w-full text-left text-[11px] font-semibold py-2 px-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2">
              <Coffee className="w-3 h-3 text-amber-400" /> Fiz o break de 30 min
            </button>

            <button onClick={() => handleReset('new_shift')} className="w-full text-left text-[11px] font-semibold py-2 px-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2">
              <Truck className="w-3 h-3 text-blue-400" /> Iniciei novo turno
            </button>

            <div className="border-t border-white/10 pt-2 mt-1">
              <button onClick={() => handleReset('manual')} className="w-full text-left text-[11px] font-semibold py-2 px-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2">
                <AlertTriangle className="w-3 h-3" /> Reset manual (não conforme DOT)
              </button>
              <p className="text-[9px] text-white/40 mt-1 px-1">
                Reset visual permitido. Overtime continuará sendo registrado.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default DotHud;

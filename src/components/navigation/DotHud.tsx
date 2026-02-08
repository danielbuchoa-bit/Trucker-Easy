/**
 * DOT HUD (Support Mode) – NOT a logbook.
 * - Minimal alerts (Quiet default)
 * - Visual-only override (does not change official logbook)
 * - "Stop now" is the primary value hook (onStopNow)
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDotHosSafe } from "@/contexts/DotHosContext";
// === Config ===
const DRIVE_LIMIT_SEC = 11 * 3600;
const SHIFT_LIMIT_SEC = 14 * 3600;
const BREAK_REQUIRED_AFTER_SEC = 8 * 3600;
const BREAK_DURATION_SEC = 30 * 60;
const WARN_THRESHOLD_SEC = 15 * 60;

const UI_STORAGE_KEY = "dotHud_support_ui_v2";
const QUIET_SNOOZE_MINUTES_DEFAULT = 30;
const DISMISS_QUIET_MINUTES_DEFAULT = 60;

// === Types ===
type HudMode = "quiet" | "normal" | "hardcore";
type ViolationType = "none" | "break_due" | "drive_exceeded" | "shift_exceeded";
type BarVisual = "green" | "yellow" | "red_blink" | "red_fixed";

interface SupportUiState {
  mode: HudMode;
  quietUntilTs: number;
  ackedViolation: ViolationType;
  overrideActive: boolean;
  lastWarnAtTs: number;
  lastViolateAtTs: number;
}

// === Helpers ===
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function fmtHM(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function loadUiState(): SupportUiState {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    mode: "quiet",
    quietUntilTs: 0,
    ackedViolation: "none",
    overrideActive: false,
    lastWarnAtTs: 0,
    lastViolateAtTs: 0,
  };
}

function saveUiState(s: SupportUiState) {
  try { localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// === Pure computation ===

function computeViolation(state: any): ViolationType {
  if (!state) return "none";
  if ((state.dutyRemainingSec ?? 1) <= 0) return "shift_exceeded";
  if ((state.drivingRemainingSec ?? 1) <= 0) return "drive_exceeded";
  if (state.needsBreak) return "break_due";
  return "none";
}

function computeWarning(state: any): { warn: boolean; label: string; remainingSec: number } {
  if (!state) return { warn: false, label: "", remainingSec: 0 };

  const driveRem = state.drivingRemainingSec ?? DRIVE_LIMIT_SEC;
  const shiftRem = state.dutyRemainingSec ?? SHIFT_LIMIT_SEC;

  const breakRem = state.needsBreak
    ? 0
    : Math.max(0, BREAK_REQUIRED_AFTER_SEC - (state.breakDrivingSinceLastBreakSec ?? 0));

  const isResting = state.currentStatus === "OFF_DUTY" || state.currentStatus === "SLEEPER";
  const breakSatisfied = isResting && (state.restContinuousSec ?? 0) >= BREAK_DURATION_SEC;

  const breakCandidate = state.needsBreak ? 0 : (breakSatisfied ? Infinity : breakRem);
  const minRem = Math.min(driveRem, shiftRem, breakCandidate);
  const warn = minRem <= WARN_THRESHOLD_SEC && minRem > 0;

  let label = "";
  if (minRem === 0 && state.needsBreak) label = "break";
  else if (minRem === breakCandidate) label = "break";
  else if (minRem === driveRem) label = "drive limit";
  else label = "shift limit";

  return { warn, label, remainingSec: Math.max(0, minRem === Infinity ? 0 : minRem) };
}

function computeDutyElapsed(state: any): { seconds: number; hasSignal: boolean } {
  if (!state) return { seconds: 0, hasSignal: false };

  const hasWindow = state.dutyWindowSec != null && state.dutyWindowSec > 0;
  const hasRemaining = state.dutyRemainingSec != null;

  const fallback = Math.max(0, SHIFT_LIMIT_SEC - (state.dutyRemainingSec ?? SHIFT_LIMIT_SEC));
  const dutyElapsed = hasWindow ? state.dutyWindowSec : fallback;

  return { seconds: dutyElapsed, hasSignal: hasWindow || hasRemaining };
}

function computeBarFill(state: any): number {
  if (!state) return 0;

  const driveFrac = clamp01((state.drivingTodaySec ?? 0) / DRIVE_LIMIT_SEC);

  const duty = computeDutyElapsed(state);
  const shiftFrac = clamp01(duty.seconds / SHIFT_LIMIT_SEC);

  const breakFrac = state.needsBreak
    ? 1
    : clamp01((state.breakDrivingSinceLastBreakSec ?? 0) / BREAK_REQUIRED_AFTER_SEC);

  return clamp01(Math.max(driveFrac, shiftFrac, breakFrac));
}

function getBreakText(state: any): string {
  if (!state) return "Break: —";

  const isResting = state.currentStatus === "OFF_DUTY" || state.currentStatus === "SLEEPER";
  const restSec = state.restContinuousSec ?? 0;

  if (state.needsBreak) return "Break: Necessário ⚠️";

  if (isResting && restSec > 0 && restSec < BREAK_DURATION_SEC) {
    return `Break: em progresso ${fmtHM(restSec)} / 00:30`;
  }

  if (isResting && restSec >= BREAK_DURATION_SEC && (state.breakDrivingSinceLastBreakSec ?? 0) === 0) {
    return "Break: OK ✅";
  }

  const remaining = Math.max(0, BREAK_REQUIRED_AFTER_SEC - (state.breakDrivingSinceLastBreakSec ?? 0));
  return `Break: em ${fmtHM(remaining)}`;
}

// === Alert policy ===

function shouldShowWarning(ui: SupportUiState, warning: { warn: boolean }, violation: ViolationType): boolean {
  if (!warning.warn || violation !== "none") return false;
  const now = Date.now();
  if (ui.quietUntilTs > now) return false;

  if (ui.mode === "quiet") return (now - ui.lastWarnAtTs) > 60 * 60 * 1000;
  if (ui.mode === "normal") return (now - ui.lastWarnAtTs) > 20 * 60 * 1000;
  return (now - ui.lastWarnAtTs) > 10 * 60 * 1000;
}

function shouldShowViolation(ui: SupportUiState, violation: ViolationType): boolean {
  if (violation === "none") return false;
  const now = Date.now();
  if (ui.quietUntilTs > now) return false;

  if (ui.ackedViolation !== violation) return true;

  if (ui.mode === "quiet") return false;
  if (ui.mode === "normal") return (now - ui.lastViolateAtTs) > 45 * 60 * 1000;
  return (now - ui.lastViolateAtTs) > 20 * 60 * 1000;
}

// === Component ===
const DotHud = memo(function DotHud({ onStopNow }: { onStopNow?: () => void }) {
  const dotHos = useDotHosSafe();
  const state = dotHos?.state;

  const [ui, setUi] = useState<SupportUiState>(loadUiState);
  const [showClock, setShowClock] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertKind, setAlertKind] = useState<"warning" | "violation">("warning");

  const pressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const [blinkOn, setBlinkOn] = useState(true);

  const violation = useMemo(() => computeViolation(state), [state]);
  const warning = useMemo(() => computeWarning(state), [state]);
  const barFill = useMemo(() => computeBarFill(state), [state]);

  const barVisual: BarVisual = useMemo(() => {
    if (ui.overrideActive && violation !== "none") return "red_fixed";
    if (violation !== "none") return "red_blink";
    if (warning.warn) return "yellow";
    return "green";
  }, [ui.overrideActive, violation, warning.warn]);

  // Blink animation
  useEffect(() => {
    if (barVisual !== "red_blink") { setBlinkOn(true); return; }
    const t = window.setInterval(() => setBlinkOn(v => !v), 600);
    return () => window.clearInterval(t);
  }, [barVisual]);

  // Persist UI state
  const updateUi = useCallback((updater: (prev: SupportUiState) => SupportUiState) => {
    setUi(prev => {
      const next = updater(prev);
      saveUiState(next);
      return next;
    });
  }, []);

  // Alert decision logic (minimal nagging)
  useEffect(() => {
    if (!state) return;

    const showV = shouldShowViolation(ui, violation);
    const showW = shouldShowWarning(ui, warning, violation);

    if (showV) {
      setAlertKind("violation");
      setShowAlert(true);
      updateUi(prev => ({ ...prev, lastViolateAtTs: Date.now() }));
      return;
    }

    if (showW) {
      setAlertKind("warning");
      setShowAlert(true);
      updateUi(prev => ({ ...prev, lastWarnAtTs: Date.now() }));
      return;
    }

    if (violation === "none" && !warning.warn) setShowAlert(false);
  }, [state, violation, warning.warn, ui, updateUi]);

  // Clear override when compliant again
  useEffect(() => {
    if (violation === "none" && ui.overrideActive) {
      updateUi(prev => ({ ...prev, overrideActive: false, ackedViolation: "none" }));
    }
  }, [violation, ui.overrideActive, updateUi]);

  // === Handlers ===
  const dismissX = useCallback(() => {
    const minutes = ui.mode === "quiet" ? DISMISS_QUIET_MINUTES_DEFAULT : 20;
    updateUi(prev => ({ ...prev, quietUntilTs: Date.now() + minutes * 60 * 1000 }));
    setShowAlert(false);
  }, [ui.mode, updateUi]);

  const ignore = useCallback(() => {
    const minutes = ui.mode === "quiet" ? QUIET_SNOOZE_MINUTES_DEFAULT : 15;
    updateUi(prev => ({
      ...prev,
      overrideActive: true,
      ackedViolation: violation !== "none" ? violation : prev.ackedViolation,
      quietUntilTs: Date.now() + minutes * 60 * 1000,
      lastViolateAtTs: Date.now(),
    }));
    setShowAlert(false);
  }, [ui.mode, updateUi, violation]);

  const ackSeen = useCallback(() => {
    updateUi(prev => ({
      ...prev,
      ackedViolation: violation !== "none" ? violation : prev.ackedViolation,
      quietUntilTs: Date.now() + 30 * 60 * 1000,
    }));
    setShowAlert(false);
  }, [updateUi, violation]);

  const stopNow = useCallback(() => {
    setShowAlert(false);
    updateUi(prev => ({
      ...prev,
      ackedViolation: violation !== "none" ? violation : prev.ackedViolation,
      quietUntilTs: Date.now() + 20 * 60 * 1000,
    }));
    onStopNow?.();
  }, [onStopNow, updateUi, violation]);

  // Tap toggles clock; long press cycles modes
  const onPressStart = useCallback(() => {
    longPressFired.current = false;
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      updateUi(prev => ({
        ...prev,
        mode: prev.mode === "quiet" ? "normal" : prev.mode === "normal" ? "hardcore" : "quiet",
      }));
    }, 650);
  }, [updateUi]);

  const onPressEnd = useCallback(() => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    if (!longPressFired.current) setShowClock(v => !v);
  }, []);

  if (!dotHos || !state) return null;

  // === Visual classes ===
  const barBgClass = barVisual === "green" ? "bg-green-900/40"
    : barVisual === "yellow" ? "bg-yellow-900/40"
    : "bg-red-900/40";

  const barFillClass = barVisual === "green" ? "bg-green-500"
    : barVisual === "yellow" ? "bg-yellow-500"
    : ui.overrideActive ? "bg-red-600"
    : blinkOn ? "bg-red-500" : "bg-red-300";

  const ringClass = barVisual === "red_blink" && !blinkOn ? "ring-2 ring-red-400/70" : "";

  const modeLabel = ui.mode === "quiet" ? "Quiet" : ui.mode === "normal" ? "Normal" : "Hardcore";

  const driveLine = `Drive: ${fmtHM(state.drivingTodaySec ?? 0)} / ${fmtHM(DRIVE_LIMIT_SEC)}`;

  const duty = computeDutyElapsed(state);
  const shiftLine = duty.hasSignal
    ? `Shift: ${fmtHM(duty.seconds)} / ${fmtHM(SHIFT_LIMIT_SEC)}`
    : `Shift: — / ${fmtHM(SHIFT_LIMIT_SEC)}`;

  const breakLine = getBreakText(state);

  return (
    <div className="fixed top-[82px] right-[12px] z-[999] select-none">
      {/* === DOT BAR === */}
      <div
        onMouseDown={onPressStart}
        onMouseUp={onPressEnd}
        onTouchStart={onPressStart}
        onTouchEnd={onPressEnd}
        className={`w-[150px] ${ringClass}`}
        style={{ cursor: "pointer" }}
        title="Tap: mostrar/esconder • Toque longo: Quiet→Normal→Hardcore"
      >
        <div className={`h-[10px] rounded-full ${barBgClass} overflow-hidden border border-white/10`}>
          <div className={`h-full ${barFillClass}`} style={{ width: `${Math.max(6, Math.round(barFill * 100))}%` }} />
        </div>

        {/* === CLOCK (compact support) === */}
        {showClock && (
          <div className="mt-2 w-[260px] rounded-xl bg-black/75 border border-white/10 px-3 py-2 text-white">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-extrabold">DOT (Support)</div>
              <div className="text-[10px] opacity-80">
                {modeLabel}{ui.overrideActive && violation !== "none" ? " · Override" : ""}
              </div>
            </div>

            <div className="mt-1 text-[11px] opacity-90">{driveLine}</div>
            <div className="mt-1 text-[11px] opacity-90">{breakLine}</div>
            <div className="mt-1 text-[11px] opacity-90">{shiftLine}</div>

            {warning.warn && violation === "none" && (
              <div className="mt-2 text-[11px] font-bold text-yellow-400">
                ⚠ {fmtHM(warning.remainingSec)} para {warning.label}
              </div>
            )}

            {violation !== "none" && (
              <div className="mt-2 text-[11px] font-extrabold text-red-400">
                {violation === "break_due"
                  ? "Break necessário"
                  : violation === "drive_exceeded"
                    ? "Limite de direção excedido"
                    : "Limite de shift excedido"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* === DISCREET ALERT (rare, minimal) === */}
      {showAlert && (
        <div className="mt-2 w-[260px] rounded-xl bg-black/80 border border-white/10 px-3 py-2 text-white">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-extrabold">
              {alertKind === "warning" ? "Atenção DOT" : "DOT estourou"}
            </div>
            <button
              onClick={dismissX}
              className="text-[12px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
              title="Fechar e silenciar (sem override)"
            >
              ✕
            </button>
          </div>

          <div className="mt-1 text-[11px] opacity-90">
            {alertKind === "warning"
              ? `Faltam ${fmtHM(warning.remainingSec)} para ${warning.label}.`
              : violation === "break_due"
                ? "Break de 30 min necessário."
                : violation === "drive_exceeded"
                  ? "Limite de 11h excedido."
                  : "Limite de 14h excedido."}
          </div>

          <div className="mt-2 flex gap-2">
            <button
              onClick={stopNow}
              className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-green-500/15 border border-green-500/25 hover:bg-green-500/25"
            >
              Parar agora
            </button>

            {alertKind === "violation" ? (
              <button
                onClick={ignore}
                className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-red-500/15 border border-red-500/25 hover:bg-red-500/25 text-red-300"
                title="Override visual + silenciar"
              >
                Ignorar
              </button>
            ) : (
              <button
                onClick={ackSeen}
                className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                title="Marcar como visto"
              >
                Entendi
              </button>
            )}
          </div>

          <div className="mt-2 text-[10px] opacity-70">
            Suporte visual apenas. Não altera seu logbook oficial.
          </div>
        </div>
      )}
    </div>
  );
});

export default DotHud;

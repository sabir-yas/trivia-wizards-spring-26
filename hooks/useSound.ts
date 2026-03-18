"use client";

import { useRef, useCallback } from "react";

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
}

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  function ctx(): AudioContext | null {
    if (!ctxRef.current) ctxRef.current = getAudioContext();
    return ctxRef.current;
  }

  // Low-level helpers
  function playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    gainValue = 0.3,
    startTime?: number,
    fadeOut = true,
  ) {
    const ac = ctx();
    if (!ac) return;
    const t = startTime ?? ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    gain.gain.setValueAtTime(gainValue, t);
    if (fadeOut) gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration);
  }

  function playNoise(duration: number, gainValue = 0.15, startTime?: number) {
    const ac = ctx();
    if (!ac) return;
    const t = startTime ?? ac.currentTime;
    const bufferSize = ac.sampleRate * duration;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const gain = ac.createGain();
    source.connect(gain);
    gain.connect(ac.destination);
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.start(t);
    source.stop(t + duration);
  }

  // ── Sound effects ──────────────────────────────────────────────

  /** Single countdown tick — subtle click */
  const tick = useCallback(() => {
    playTone(880, 0.08, "square", 0.12);
  }, []);

  /** Urgent tick for last 5 seconds */
  const urgentTick = useCallback(() => {
    playTone(1200, 0.1, "square", 0.2);
  }, []);

  /** Timer expired — descending buzz */
  const timerExpired = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    playTone(300, 0.6, "sawtooth", 0.25, t);
    playTone(200, 0.4, "sawtooth", 0.2, t + 0.15);
  }, []);

  /** Round start — ascending fanfare */
  const roundStart = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      playTone(freq, 0.25, "triangle", 0.28, t + i * 0.15);
    });
    // Bass hit
    playTone(130, 0.4, "sine", 0.3, t);
  }, []);

  /** Round ended — descending resolution */
  const roundEnd = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    const notes = [784, 659, 523]; // G5 E5 C5
    notes.forEach((freq, i) => {
      playTone(freq, 0.3, "triangle", 0.25, t + i * 0.18);
    });
  }, []);

  /** Question revealed — short upward sting */
  const questionStart = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    playTone(440, 0.1, "square", 0.15, t);
    playTone(660, 0.15, "square", 0.18, t + 0.1);
  }, []);

  /** Answer correct — triumphant ascending */
  const correctAnswer = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    playTone(523, 0.15, "triangle", 0.25, t);
    playTone(784, 0.15, "triangle", 0.25, t + 0.12);
    playTone(1047, 0.3, "triangle", 0.3, t + 0.24);
  }, []);

  /** Answer wrong — descending wah-wah */
  const wrongAnswer = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    playTone(400, 0.2, "sawtooth", 0.2, t);
    playTone(300, 0.3, "sawtooth", 0.2, t + 0.18);
  }, []);

  /** Answer locked in (kiosk) — soft confirmation blip */
  const answerLocked = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    playTone(660, 0.08, "sine", 0.2, t);
    playTone(880, 0.12, "sine", 0.2, t + 0.08);
  }, []);

  /** New team joined — cheerful ding */
  const teamJoined = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    playTone(880, 0.12, "sine", 0.2, t);
    playTone(1108, 0.18, "sine", 0.18, t + 0.1);
  }, []);

  /** Game over / final results — full fanfare */
  const gameOver = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    // Chord arpeggiated
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      playTone(freq, 0.5 - i * 0.04, "triangle", 0.22, t + i * 0.1);
    });
    // Noise hit at start
    playNoise(0.12, 0.18, t);
    // Bass rumble
    playTone(65, 0.6, "sine", 0.3, t);
  }, []);

  /** Answer reveal shown — dramatic reveal chord */
  const answerReveal = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    playTone(392, 0.08, "square", 0.12, t);
    playTone(494, 0.08, "square", 0.12, t + 0.06);
    playTone(587, 0.08, "square", 0.12, t + 0.12);
    playTone(784, 0.3, "sine", 0.22, t + 0.2);
  }, []);

  return {
    tick,
    urgentTick,
    timerExpired,
    roundStart,
    roundEnd,
    questionStart,
    correctAnswer,
    wrongAnswer,
    answerLocked,
    teamJoined,
    gameOver,
    answerReveal,
  };
}

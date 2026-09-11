'use client';

import * as React from 'react';

export type VoiceCaptureStatus =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'transcribing'
  | 'error'
  | 'denied'
  | 'unsupported';

const AUTO_STOP_MS = 30_000;
const COUNTDOWN_FROM_S = 25;

interface UseVoiceCaptureOptions {
  /** Fired once with the plain, editable transcript — never auto-submitted. */
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

/**
 * Records in the browser, transcribes on the server, and hands back plain
 * text — the mic never decides anything on its own. Amplitude is read
 * imperatively (`getAmplitude`) rather than pushed through React state, so
 * `ThinkingOrbs`' own rAF loop can animate at 60fps without re-rendering
 * this hook's owner every frame.
 */
export function useVoiceCapture({ onTranscript, onError }: UseVoiceCaptureOptions) {
  const [status, setStatus] = React.useState<VoiceCaptureStatus>('idle');
  /** Seconds left before the 30s auto-stop; null until the last 5 seconds. */
  const [countdown, setCountdown] = React.useState<number | null>(null);

  const streamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const sampleBufferRef = React.useRef<Uint8Array<ArrayBuffer> | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const autoStopTimerRef = React.useRef<number | null>(null);
  const countdownTimerRef = React.useRef<number | null>(null);
  const mountedRef = React.useRef(true);

  const isSupported =
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  /** Root-mean-square of the live waveform, 0–1. Called from `ThinkingOrbs`' own animation loop. */
  const getAmplitude = React.useCallback((): number => {
    const analyser = analyserRef.current;
    const buffer = sampleBufferRef.current;
    if (!analyser || !buffer) return 0;
    analyser.getByteTimeDomainData(buffer);
    let sumSquares = 0;
    for (const value of buffer) {
      const centered = (value - 128) / 128;
      sumSquares += centered * centered;
    }
    return Math.min(1, Math.sqrt(sumSquares / buffer.length) * 4);
  }, []);

  const releaseHardware = React.useCallback(() => {
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    // Closing releases the hardware the analyser was reading; see the brief's UX spec.
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    analyserRef.current = null;
    sampleBufferRef.current = null;
    if (mountedRef.current) setCountdown(null);
  }, []);

  const finish = React.useCallback(
    async (discard: boolean) => {
      const recorder = recorderRef.current;
      if (!recorder) return;

      await new Promise<void>((resolve) => {
        if (recorder.state === 'inactive') {
          resolve();
          return;
        }
        recorder.addEventListener('stop', () => resolve(), { once: true });
        recorder.stop();
      });
      releaseHardware();

      if (discard) {
        chunksRef.current = [];
        if (mountedRef.current) setStatus('idle');
        return;
      }

      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      if (mountedRef.current) setStatus('transcribing');

      try {
        const body = new FormData();
        body.append('audio', blob, 'speech');
        const response = await fetch('/api/assistant/transcribe', { method: 'POST', body });
        const payload = (await response.json().catch(() => null)) as
          | { text?: unknown; message?: unknown }
          | null;
        if (!response.ok) {
          throw new Error(
            (payload && typeof payload.message === 'string' && payload.message) ||
              'Could not transcribe that recording.',
          );
        }
        if (mountedRef.current) setStatus('idle');
        onTranscript(typeof payload?.text === 'string' ? payload.text : '');
      } catch (error) {
        if (mountedRef.current) setStatus('error');
        onError?.(error instanceof Error ? error.message : 'Could not transcribe that recording.');
      }
    },
    [onError, onTranscript, releaseHardware],
  );

  const start = React.useCallback(async () => {
    if (!isSupported) {
      setStatus('unsupported');
      return;
    }
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const AudioContextCtor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sampleBufferRef.current = new Uint8Array(analyser.fftSize);

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus('listening');

      let elapsedSeconds = 0;
      countdownTimerRef.current = window.setInterval(() => {
        elapsedSeconds += 1;
        const remaining = Math.round(AUTO_STOP_MS / 1000) - elapsedSeconds;
        setCountdown(remaining <= COUNTDOWN_FROM_S ? Math.max(0, remaining) : null);
      }, 1000);
      autoStopTimerRef.current = window.setTimeout(() => {
        void finish(false);
      }, AUTO_STOP_MS);
    } catch (error) {
      releaseHardware();
      if (!mountedRef.current) return;
      if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
        setStatus('denied');
      } else {
        setStatus('error');
        onError?.('Could not access the microphone.');
      }
    }
  }, [finish, isSupported, onError, releaseHardware]);

  const stop = React.useCallback(() => {
    void finish(false);
  }, [finish]);

  const cancel = React.useCallback(() => {
    void finish(true);
  }, [finish]);

  const reset = React.useCallback(() => {
    if (status === 'error' || status === 'denied') setStatus('idle');
  }, [status]);

  React.useEffect(
    () => () => {
      mountedRef.current = false;
      releaseHardware();
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [releaseHardware],
  );

  return { status, countdown, isSupported, getAmplitude, start, stop, cancel, reset };
}

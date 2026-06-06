import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// Wrapper de Web Speech API (SpeechRecognition) con estado observable para UI.
export type SpeechState =
  | { status: 'idle' }
  | { status: 'unsupported'; message: string }
  | { status: 'listening'; transcript: string; interim: string }
  | { status: 'error'; message: string };

type SpeechRecognitionCtor = new () => SpeechRecognition;

@Injectable({ providedIn: 'root' })
export class WebSpeechService {
  private recognition: SpeechRecognition | null = null;
  private readonly stateSubject = new BehaviorSubject<SpeechState>({ status: 'idle' });
  readonly state$ = this.stateSubject.asObservable();
  private shouldContinue = false;
  private manualStop = false;
  private startedAt = 0;

  private getCtor(): SpeechRecognitionCtor | null {
    const w = window as any;
    return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SpeechRecognitionCtor | null;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && !!this.getCtor();
  }

  async requestMicPermission(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
  }

  start(lang = 'es-ES'): void {
    if (!this.isSupported()) {
      this.stateSubject.next({
        status: 'unsupported',
        message: 'Tu navegador no soporta reconocimiento de voz (Web Speech API).'
      });
      return;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_) {}
      this.recognition = null;
    }

    const Ctor = this.getCtor()!;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = '';
    let interimText = '';
    this.shouldContinue = true;
    this.manualStop = false;
    this.startedAt = Date.now();

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      interimText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const text = String(res[0]?.transcript || '').trim();
        if (res.isFinal) {
          finalText = `${finalText} ${text}`.trim();
        } else {
          interimText = `${interimText} ${text}`.trim();
        }
      }
      this.stateSubject.next({ status: 'listening', transcript: finalText, interim: interimText });
    };

    rec.onerror = (e: any) => {
      const code = String(e?.error || '').toLowerCase();
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        this.shouldContinue = false;
        this.stateSubject.next({
          status: 'error',
          message: 'Permiso de micrófono denegado. Actívalo en la configuración del navegador.'
        });
        return;
      }
      if (code === 'no-speech' || code === 'aborted') {
        return;
      }
      if (code === 'audio-capture') {
        this.shouldContinue = false;
        this.stateSubject.next({ status: 'error', message: 'No se detectó un micrófono disponible.' });
        return;
      }
      if (code === 'network') {
        this.shouldContinue = false;
        const isBrave = typeof navigator !== 'undefined' && /brave/i.test(navigator.userAgent);
        this.stateSubject.next({
          status: 'error',
          message: isBrave
            ? 'Brave bloqueó el reconocimiento de voz (error de red). Desactiva Shields para este sitio o usa Chrome/Edge.'
            : 'El reconocimiento de voz falló por red. Verifica tu conexión o usa Chrome/Edge.'
        });
        return;
      }
      if (code === 'language-not-supported') {
        this.shouldContinue = false;
        this.stateSubject.next({ status: 'error', message: 'Idioma de reconocimiento no soportado.' });
        return;
      }
      this.shouldContinue = false;
      this.stateSubject.next({ status: 'error', message: 'Falló el reconocimiento de voz.' });
    };

    rec.onend = () => {
      const s = this.stateSubject.getValue();
      if (this.manualStop || !this.shouldContinue) {
        if (s.status === 'listening') this.stateSubject.next({ status: 'idle' });
        return;
      }

      const elapsed = Date.now() - this.startedAt;
      const delayMs = elapsed < 1200 ? 350 : 250;

      setTimeout(() => {
        try {
          rec.start();
        } catch (_) {
          this.shouldContinue = false;
          this.stateSubject.next({ status: 'idle' });
        }
      }, delayMs);
    };

    this.recognition = rec;
    this.stateSubject.next({ status: 'listening', transcript: '', interim: '' });
    try {
      rec.start();
    } catch (_) {
      this.shouldContinue = false;
      this.stateSubject.next({ status: 'error', message: 'No se pudo iniciar el micrófono.' });
    }
  }

  stop(): void {
    if (!this.recognition) return;
    this.manualStop = true;
    this.shouldContinue = false;
    try {
      this.recognition.stop();
    } catch (_) {}
    this.recognition = null;
    this.stateSubject.next({ status: 'idle' });
  }
}

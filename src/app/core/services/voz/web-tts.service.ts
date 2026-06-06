import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WebTtsService {
  isSupported(): boolean {
    return typeof window !== 'undefined' && !!(window as any).speechSynthesis && !!(window as any).SpeechSynthesisUtterance;
  }

  stop(): void {
    if (!this.isSupported()) return;
    try {
      (window as any).speechSynthesis.cancel();
    } catch (_) {}
  }

  speak(text: string, lang = 'es-ES'): void {
    const clean = String(text || '').trim();
    if (!clean) return;
    if (!this.isSupported()) return;
    try {
      const u = new (window as any).SpeechSynthesisUtterance(clean);
      u.lang = lang;
      u.rate = 1.0;
      u.pitch = 1.0;
      (window as any).speechSynthesis.cancel();
      (window as any).speechSynthesis.speak(u);
    } catch (_) {}
  }
}


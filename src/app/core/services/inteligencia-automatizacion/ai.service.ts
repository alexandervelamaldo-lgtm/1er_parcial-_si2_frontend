import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../autenticacion-acceso/auth.service';

export type AiConsentResponse = { consent: boolean; consented_at: string | null };

export type AiTextAction = 'redactar' | 'corregir' | 'traducir' | 'resumir';

export type AiTextGenerateRequest = {
  action: AiTextAction;
  text: string;
  target_language?: string | null;
  tone?: string | null;
  length?: string | null;
};

export type AiTextGenerateResponse = { output: string; provider: string; latency_ms: number };

export type AiVoiceReportNarrationRequest = {
  report_name: string;
  period?: string;
  format?: string;
  audience?: string;
  highlights?: string[];
  stats?: Record<string, any>;
};

export type AiVoiceReportNarrationResponse = { narration: string; provider: string; latency_ms: number };

export type AiChatRole = 'user' | 'assistant';

export type AiChatMessage = { role: AiChatRole; content: string };

export type AiChatRequest = { message: string; history: AiChatMessage[] };

export type AiChatResponse = { reply: string; provider: string; model: string; latency_ms: number };

export type AiImageAnalyzeResponse = {
  allowed: boolean;
  categories: string[];
  reason: string | null;
  ocr_text: string | null;
  alt_text: string | null;
  labels: string[];
  severity: string | null;        // LEVE | MODERADO | SEVERO | CRITICO
  provider: string;
  latency_ms: number;
};

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  getConsent() {
    return this.http.get<AiConsentResponse>(`${environment.apiUrl}/ai/consent`, {
      headers: this.auth.getAuthHeaders()
    });
  }

  setConsent(consent: boolean) {
    return this.http.post<AiConsentResponse>(
      `${environment.apiUrl}/ai/consent`,
      { consent },
      { headers: this.auth.getAuthHeaders() }
    );
  }

  generateText(payload: AiTextGenerateRequest) {
    return this.http.post<AiTextGenerateResponse>(`${environment.apiUrl}/ai/text/generate`, payload, {
      headers: this.auth.getAuthHeaders()
    });
  }

  /**
   * Envía un mensaje al chatbot (Groq) junto con el historial reciente de
   * la conversación, para que el modelo mantenga contexto entre turnos.
   */
  chat(payload: AiChatRequest) {
    return this.http.post<AiChatResponse>(`${environment.apiUrl}/ai/chat`, payload, {
      headers: this.auth.getAuthHeaders()
    });
  }

  voiceReportNarration(payload: AiVoiceReportNarrationRequest) {
    return this.http.post<AiVoiceReportNarrationResponse>(`${environment.apiUrl}/ai/voice-report/narration`, payload, {
      headers: this.auth.getAuthHeaders()
    });
  }

  /**
   * Analyzes an attached image via the backend's Vision pipeline.
   * Use this when the user uploads a photo as evidence of vehicle damage —
   * the response includes a damage severity (LEVE/MODERADO/SEVERO/CRITICO),
   * detected labels and an alt_text summary for the chip UI.
   *
   * The backend auto-grants AI consent on first call, so the UI does not
   * need a separate consent dialog.
   */
  analyzeImage(file: File) {
    const form = new FormData();
    form.append('archivo', file);
    // We must drop the Content-Type so the browser sets the multipart boundary.
    const headers = this.auth.getAuthHeaders().delete('Content-Type');
    return this.http.post<AiImageAnalyzeResponse>(
      `${environment.apiUrl}/ai/image/analyze`,
      form,
      { headers }
    );
  }
}

import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { LocalReportService } from '../../../core/services/reportes/local-report.service';
import { EmergencyReportRow, buildTodayEmergencyDataset } from '../../../core/services/reportes/sample-emergencies';
import { parseVoiceReportCommand } from '../../../core/services/reportes/voice-command.parser';
import { AiService } from '../../../core/services/inteligencia-automatizacion/ai.service';
import { SpeechState, WebSpeechService } from '../../../core/services/voz/web-speech.service';
import { WebTtsService } from '../../../core/services/voz/web-tts.service';
import { AppIconComponent } from '../app-icon/app-icon.component';

@Component({
  selector: 'app-voice-report',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  template: `
    <section class="voice-card" aria-label="Reportes por comando de voz">
      <div class="voice-header">
        <div>
          <h3><app-icon name="mic" [size]="18" /> Reportes por comando de voz</h3>
          <p class="hint">
            Di por ejemplo: <strong>"génrame el PDF de hoy"</strong>, <strong>"exporta el excel de hoy"</strong>,
            <strong>"dame el reporte txt de hoy"</strong>. Agrega <strong>"con voz"</strong> para narración.
          </p>
        </div>

        <button
          class="mic"
          type="button"
          [class.is-on]="isListening()"
          [class.is-error]="status() === 'error'"
          (click)="toggleMic()"
          [attr.aria-pressed]="isListening()"
        >
          <app-icon name="mic" [size]="16" />
          {{ isListening() ? 'Detener' : 'Hablar' }}
        </button>
      </div>

      <div class="voice-body">
        <div class="row">
          <span class="k">Estado</span>
          <span class="v">
            <ng-container [ngSwitch]="status()">
              <span *ngSwitchCase="'idle'">Inactivo</span>
              <span *ngSwitchCase="'listening'">Escuchando…</span>
              <span *ngSwitchCase="'unsupported'">{{ message() }}</span>
              <span *ngSwitchCase="'error'">{{ message() }}</span>
            </ng-container>
          </span>
        </div>

        <div class="row" *ngIf="status() === 'listening'">
          <span class="k">Transcripción</span>
          <span class="v mono">
            {{ transcript() }} <span class="muted">{{ interim() }}</span>
          </span>
        </div>

        <div class="row">
          <span class="k">Comando</span>
          <span class="v">
            <ng-container *ngIf="command() as c; else noCmd">
              Detectado: <strong>{{ c.period }}</strong> · <strong>{{ c.format }}</strong>
              <span *ngIf="c.narrate" class="status-chip outline">voz</span>
            </ng-container>
            <ng-template #noCmd>—</ng-template>
          </span>
        </div>

        <div class="actions">
          <button class="btn-secondary" type="button" (click)="generatePdf()" [disabled]="busy()">
            Generar PDF (local)
          </button>
          <button class="btn-secondary" type="button" (click)="generateExcel()" [disabled]="busy()">
            Generar Excel (local)
          </button>
          <button class="btn-secondary" type="button" (click)="generateTxt()" [disabled]="busy()">
            Generar TXT (local)
          </button>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .voice-card {
        margin-bottom: 1rem;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(203, 213, 225, 0.6);
        border-radius: 20px;
        padding: 1rem;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      }

      .voice-header {
        display: flex;
        gap: 12px;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
      }

      h3 {
        margin: 0;
        font-size: 1.05rem;
        color: #0f172a;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .hint {
        margin: 6px 0 0;
        color: #64748b;
        font-size: 0.9rem;
      }

      .mic {
        border: none;
        cursor: pointer;
        font-weight: 800;
        border-radius: 999px;
        padding: 0.8rem 1.1rem;
        background: #eef2ff;
        color: #1d4ed8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }
      .mic.is-on {
        background: #ef4444;
        color: #ffffff;
      }
      .mic.is-error {
        background: #fff1f2;
        color: #b91c1c;
      }

      .voice-body {
        margin-top: 12px;
        display: grid;
        gap: 10px;
      }

      .row {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 10px;
        align-items: start;
      }

      .k {
        color: #334155;
        font-weight: 800;
      }

      .v {
        color: #0f172a;
      }

      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
          monospace;
      }

      .muted {
        color: #94a3b8;
      }

      .actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .btn-secondary {
        border: none;
        cursor: pointer;
        font-weight: 800;
        border-radius: 14px;
        padding: 0.75rem 1rem;
        background: #eef2ff;
        color: #1d4ed8;
      }
      .btn-secondary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .status-chip {
        display: inline-flex;
        align-items: center;
        font-weight: 900;
        font-size: 0.75rem;
        border-radius: 999px;
        padding: 0.2rem 0.55rem;
        margin-left: 0.5rem;
      }

      .status-chip.outline {
        border: 1px solid rgba(148, 163, 184, 0.6);
        color: #0f172a;
        background: #f8fafc;
      }

      @media (max-width: 900px) {
        .row {
          grid-template-columns: 1fr;
        }
        .mic,
        .btn-secondary {
          width: 100%;
        }
      }
    `
  ]
})
export class VoiceReportComponent implements OnDestroy {
  private readonly speech = inject(WebSpeechService);
  private readonly reports = inject(LocalReportService);
  private readonly ai = inject(AiService);
  private readonly tts = inject(WebTtsService);

  @Input() rows: EmergencyReportRow[] | null = null;
  @Input() reportName = 'Emergencias';

  readonly state = signal<SpeechState>({ status: 'idle' });
  readonly busy = signal(false);
  private autoArmed = false;

  readonly status = computed(() => this.state().status);
  readonly message = computed(() => {
    const s = this.state();
    return s.status === 'error' || s.status === 'unsupported' ? s.message : '';
  });
  readonly transcript = computed(() => {
    const s = this.state();
    return s.status === 'listening' ? s.transcript : '';
  });
  readonly interim = computed(() => {
    const s = this.state();
    return s.status === 'listening' ? s.interim : '';
  });

  readonly isListening = computed(() => this.status() === 'listening');
  readonly command = computed(() => {
    const s = this.state();
    if (s.status !== 'listening') return null;
    const text = `${s.transcript} ${s.interim}`.trim();
    return parseVoiceReportCommand(text);
  });

  private sub = this.speech.state$.subscribe((s) => this.state.set(s));

  constructor() {
    effect(() => {
      const c = this.command();
      const s = this.state();
      if (!this.autoArmed) return;
      if (this.busy()) return;
      if (s.status !== 'listening') return;
      if (!c) return;

      this.autoArmed = false;
      this.speech.stop();
      if (c.format === 'pdf') void this.generatePdf(c.narrate);
      if (c.format === 'excel') void this.generateExcel(c.narrate);
      if (c.format === 'txt') void this.generateTxt(c.narrate);
    });
  }

  async toggleMic(): Promise<void> {
    if (this.isListening()) {
      this.speech.stop();
      return;
    }

    try {
      await this.speech.requestMicPermission();
    } catch (_) {
      this.state.set({ status: 'error', message: 'Permiso de micrófono denegado.' } as any);
      return;
    }

    this.speech.start('es-ES');
    this.autoArmed = true;
  }

  private summarize(rows: EmergencyReportRow[]) {
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const locations: string[] = [];
    for (const r of rows) {
      byType[r.tipoIncidente] = (byType[r.tipoIncidente] || 0) + 1;
      byStatus[r.estadoServicio] = (byStatus[r.estadoServicio] || 0) + 1;
      if (r.ubicacion && locations.length < 6 && !locations.includes(r.ubicacion)) locations.push(r.ubicacion);
    }
    const topType = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k} (${v})`);
    const topStatus = Object.entries(byStatus)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k} (${v})`);
    return {
      total: rows.length,
      topType,
      topStatus,
      locations: locations.slice(0, 4)
    };
  }

  private async narrateReport(rows: EmergencyReportRow[], format: 'pdf' | 'excel' | 'txt'): Promise<void> {
    if (!this.tts.isSupported()) return;
    try {
      const stats = this.summarize(rows);
      const highlights = [
        `Total de registros: ${stats.total}`,
        `Top incidentes: ${stats.topType.join(', ') || 'sin datos'}`,
        `Estados: ${stats.topStatus.join(', ') || 'sin datos'}`
      ];
      const res = await firstValueFrom(
        this.ai.voiceReportNarration({
          report_name: this.reportName,
          period: 'today',
          format,
          audience: 'operaciones',
          highlights,
          stats
        })
      );
      const narration = String(res?.narration || '').trim();
      if (!narration) return;
      this.tts.speak(narration, 'es-ES');
    } catch (_) {
      return;
    }
  }

  private getRows(): EmergencyReportRow[] {
    if (Array.isArray(this.rows) && this.rows.length > 0) {
      return this.rows;
    }
    return buildTodayEmergencyDataset(new Date());
  }

  async generatePdf(narrate = false): Promise<void> {
    this.busy.set(true);
    const rows = this.getRows();
    try {
      await this.reports.exportEmergenciesPdf(rows, new Date());
      if (narrate) {
        await this.narrateReport(rows, 'pdf');
      }
    } finally {
      this.busy.set(false);
    }
  }

  async generateExcel(narrate = false): Promise<void> {
    this.busy.set(true);
    const rows = this.getRows();
    try {
      await this.reports.exportEmergenciesXlsx(rows, new Date());
      if (narrate) {
        await this.narrateReport(rows, 'excel');
      }
    } finally {
      this.busy.set(false);
    }
  }

  async generateTxt(narrate = false): Promise<void> {
    this.busy.set(true);
    const rows = this.getRows();
    try {
      await this.reports.exportEmergenciesTxt(rows, new Date());
      if (narrate) {
        await this.narrateReport(rows, 'txt');
      }
    } finally {
      this.busy.set(false);
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.speech.stop();
    this.tts.stop();
  }
}

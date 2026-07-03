import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, computed, signal } from '@angular/core';

import { decodeTextBytes } from '../../../core/services/archivos/text-decode';
import { AppIconComponent } from '../app-icon/app-icon.component';

@Component({
  selector: 'app-txt-file-tools',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  template: `
    <section class="txt-card" aria-label="Archivos de texto (.txt)">
      <div class="txt-header">
        <div>
          <h3><app-icon name="folder" [size]="18" /> TXT: carga, visor y descarga</h3>
          <p class="hint">Soporta UTF-8, ANSI (Windows-1252) y Latin-1. Tamaño máximo recomendado: 10MB.</p>
        </div>
        <label class="btn-secondary">
          <input type="file" accept=".txt,text/plain" (change)="onPick($event)" />
          Elegir .txt
        </label>
      </div>

      <div class="meta" *ngIf="hasFile()">
        <span class="pill">Archivo: <strong>{{ fileName() }}</strong></span>
        <span class="pill">Encoding: <strong>{{ encoding() }}</strong></span>
        <span class="pill">Tamaño: <strong>{{ (bytesSize() / 1024 / 1024) | number: '1.0-2' }} MB</strong></span>
      </div>

      <div class="toolbar" *ngIf="hasFile()">
        <div class="group">
          <button class="btn-secondary" type="button" (click)="zoomOut()">A-</button>
          <span class="pill">Zoom: <strong>{{ fontPx() }}px</strong></span>
          <button class="btn-secondary" type="button" (click)="zoomIn()">A+</button>
        </div>

        <div class="group search">
          <input
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            placeholder="Buscar…"
            (keydown.enter)="findNext()"
          />
          <button class="btn-secondary" type="button" (click)="findPrev()" [disabled]="!query().trim()">Anterior</button>
          <button class="btn-secondary" type="button" (click)="findNext()" [disabled]="!query().trim()">Siguiente</button>
          <span class="pill" *ngIf="query().trim() && matchIndex() >= 0"
            >Coincidencia: <strong>{{ matchIndex() + 1 }}</strong>/<strong>{{ matchCount() }}</strong></span
          >
        </div>

        <div class="group">
          <button class="btn-secondary" type="button" (click)="copyAll()">Copiar</button>
          <button class="btn-secondary" type="button" (click)="download()">Descargar</button>
        </div>
      </div>

      <textarea
        #ta
        class="viewer"
        *ngIf="hasFile()"
        [style.fontSize.px]="fontPx()"
        [value]="text()"
        readonly
      ></textarea>

      <div class="err" *ngIf="error()">{{ error() }}</div>
    </section>
  `,
  styles: [
    `
      .txt-card {
        margin: 12px 0 18px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(203, 213, 225, 0.6);
        border-radius: 20px;
        padding: 1rem;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      }

      .txt-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
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

      input[type='file'] {
        display: none;
      }

      .btn-secondary {
        border: 1px solid rgba(148, 163, 184, 0.7);
        border-radius: 12px;
        padding: 0.65rem 0.9rem;
        background: #f8fafc;
        color: #0f172a;
        font-weight: 800;
        cursor: pointer;
        display: inline-flex;
        gap: 8px;
        align-items: center;
        justify-content: center;
      }

      .meta {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .pill {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        padding: 0.25rem 0.6rem;
        border-radius: 999px;
        background: #f1f5f9;
        border: 1px solid rgba(148, 163, 184, 0.35);
        font-size: 0.85rem;
        color: #0f172a;
      }

      .toolbar {
        margin-top: 10px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
      }

      .group {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }

      .search input {
        border: 1px solid rgba(148, 163, 184, 0.6);
        border-radius: 12px;
        padding: 0.55rem 0.75rem;
        font: inherit;
        min-width: 220px;
      }

      .viewer {
        margin-top: 12px;
        width: 100%;
        min-height: 280px;
        max-height: 520px;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, 0.45);
        padding: 12px;
        background: white;
        color: #0f172a;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
          monospace;
        line-height: 1.35;
        resize: vertical;
      }

      .err {
        margin-top: 10px;
        color: #b91c1c;
        font-weight: 800;
      }

      @media (max-width: 900px) {
        .toolbar {
          align-items: stretch;
        }
        .search input {
          min-width: 0;
          width: 100%;
        }
      }
    `
  ]
})
export class TxtFileToolsComponent {
  @ViewChild('ta') private ta?: ElementRef<HTMLTextAreaElement>;

  readonly fileName = signal<string>('');
  readonly encoding = signal<string>('');
  readonly bytes = signal<Uint8Array | null>(null);
  readonly text = signal<string>('');
  readonly error = signal<string | null>(null);
  readonly fontPx = signal<number>(13);
  readonly query = signal<string>('');

  readonly hasFile = computed(() => !!this.bytes());
  readonly bytesSize = computed(() => this.bytes()?.byteLength ?? 0);

  readonly matchIndex = signal<number>(-1);
  readonly matchCount = signal<number>(0);
  private lastPos = 0;

  async onPick(ev: Event): Promise<void> {
    this.error.set(null);
    this.query.set('');
    this.matchIndex.set(-1);
    this.matchCount.set(0);
    this.lastPos = 0;

    const input = ev.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      this.error.set('El archivo excede 10MB.');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const decoded = decodeTextBytes(bytes);
      this.fileName.set(file.name || 'archivo.txt');
      this.encoding.set(decoded.encoding);
      this.bytes.set(bytes);
      this.text.set(decoded.text);
      setTimeout(() => this.focus(), 0);
    } catch (_) {
      this.error.set('No se pudo leer el archivo.');
    } finally {
      if (input) input.value = '';
    }
  }

  zoomIn(): void {
    this.fontPx.set(Math.min(26, this.fontPx() + 1));
  }

  zoomOut(): void {
    this.fontPx.set(Math.max(10, this.fontPx() - 1));
  }

  private focus(): void {
    const el = this.ta?.nativeElement;
    if (!el) return;
    try {
      el.focus();
    } catch (_) {}
  }

  private computeCount(hay: string, needle: string): number {
    if (!needle) return 0;
    let count = 0;
    let idx = 0;
    while (true) {
      const next = hay.indexOf(needle, idx);
      if (next === -1) break;
      count += 1;
      idx = next + Math.max(1, needle.length);
      if (idx >= hay.length) break;
    }
    return count;
  }

  findNext(): void {
    const q = this.query().trim();
    if (!q) return;
    const el = this.ta?.nativeElement;
    const hay = this.text();
    const needle = q.toLowerCase();
    const hayLower = hay.toLowerCase();
    if (!this.matchCount()) this.matchCount.set(this.computeCount(hayLower, needle));

    const start = el ? Math.max(el.selectionEnd, this.lastPos) : this.lastPos;
    let idx = hayLower.indexOf(needle, start);
    if (idx === -1) idx = hayLower.indexOf(needle, 0);
    if (idx === -1) {
      this.matchIndex.set(-1);
      return;
    }
    this.lastPos = idx + needle.length;
    this.matchIndex.set(Math.max(0, this.computeCount(hayLower.slice(0, idx + 1), needle) - 1));
    if (el) {
      el.focus();
      el.setSelectionRange(idx, idx + needle.length);
    }
  }

  findPrev(): void {
    const q = this.query().trim();
    if (!q) return;
    const el = this.ta?.nativeElement;
    const hay = this.text();
    const needle = q.toLowerCase();
    const hayLower = hay.toLowerCase();
    if (!this.matchCount()) this.matchCount.set(this.computeCount(hayLower, needle));

    const start = el ? Math.max(0, el.selectionStart - 1) : Math.max(0, this.lastPos - 1);
    let idx = hayLower.lastIndexOf(needle, start);
    if (idx === -1) idx = hayLower.lastIndexOf(needle);
    if (idx === -1) {
      this.matchIndex.set(-1);
      return;
    }
    this.lastPos = idx;
    this.matchIndex.set(Math.max(0, this.computeCount(hayLower.slice(0, idx + 1), needle) - 1));
    if (el) {
      el.focus();
      el.setSelectionRange(idx, idx + needle.length);
    }
  }

  async copyAll(): Promise<void> {
    const text = this.text();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const el = this.ta?.nativeElement;
      if (!el) return;
      el.focus();
      el.select();
      try {
        document.execCommand('copy');
      } catch (_) {}
    }
  }

  download(): void {
    const bytes = this.bytes();
    if (!bytes) return;
    const copy = new Uint8Array(bytes);
    const blob = new Blob([copy.buffer], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = this.fileName() || 'archivo.txt';
      a.rel = 'noopener';
      a.click();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  }
}

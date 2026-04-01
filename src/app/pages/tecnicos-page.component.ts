import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { EmergencyApiService } from '../core/services/emergency-api.service';
import { Tecnico } from '../core/models/api.models';


@Component({
  selector: 'app-tecnicos-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="list-page">
      <h2>Técnicos</h2>
      <div class="grid">
        <article *ngFor="let tecnico of tecnicos()">
          <h3>{{ tecnico.nombre }}</h3>
          <p>{{ tecnico.especialidad }}</p>
          <small>{{ tecnico.telefono }}</small>
          <strong [class.ok]="tecnico.disponibilidad">
            {{ tecnico.disponibilidad ? 'Disponible' : 'No disponible' }}
          </strong>
        </article>
      </div>
    </section>
  `,
  styles: `
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}
    article{padding:1.2rem;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.08)}
    h2,h3{margin-top:0}.ok{color:#15803d}
  `
})
export class TecnicosPageComponent {
  private readonly api = inject(EmergencyApiService);
  readonly tecnicos = signal<Tecnico[]>([]);

  constructor() {
    this.api.getTecnicos().subscribe((data) => this.tecnicos.set(data));
  }
}

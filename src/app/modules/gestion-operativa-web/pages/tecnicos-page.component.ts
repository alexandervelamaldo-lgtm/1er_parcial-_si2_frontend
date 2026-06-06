import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CategoriaTaller, Taller, TallerCreatePayload } from '../../../core/models/gestion-solicitudes/api.models';
import { EmergencyApiService } from '../../../core/services/gestion-solicitudes/emergency-api.service';
import { MapaPickerComponent } from '../../../shared/components/mapa-picker/mapa-picker.component';
import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-tecnicos-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaPickerComponent, AppIconComponent],
  template: `
    <section class="management-container">
      <header class="page-header">
        <div class="title-group">
          <h2>Directorio de Talleres</h2>
          <p>Talleres únicos con ubicación geográfica propia y sin asignaciones manuales.</p>
        </div>
        <div class="header-actions">
          <button class="btn-primary" (click)="toggleCreatePanel()">
            {{ showCreatePanel() ? 'Cerrar alta' : 'Nuevo taller' }}
          </button>
          <button (click)="loadData()" class="btn-refresh" [disabled]="isLoading()">
            <span class="icon" [class.spinning]="isLoading()" aria-hidden="true"><app-icon name="refresh" [size]="16" /></span>
            Actualizar talleres
          </button>
        </div>
      </header>

      <section class="create-panel" *ngIf="showCreatePanel()">
        <div class="panel-header">
          <div>
            <h3>Alta administrativa de taller</h3>
            <p>Define identidad, categoría y ubicación exacta del taller sobre el mapa interactivo.</p>
          </div>
          <span class="panel-badge">Rol TALLER</span>
        </div>

        <div class="form-grid">
          <label>
            Nombre del taller
            <input [(ngModel)]="createForm.nombre" name="nombre" placeholder="Taller Norte Integral" />
          </label>
          <label>
            Correo de acceso
            <input [(ngModel)]="createForm.email" name="email" type="email" placeholder="taller.nuevo@emergency.com" />
          </label>
          <label>
            Teléfono
            <input [(ngModel)]="createForm.telefono" name="telefono" placeholder="70000001" />
          </label>
          <label>
            Contraseña
            <input [(ngModel)]="createForm.password" name="password" type="password" placeholder="Password123*" />
          </label>
          <label>
            Categoría
            <select [(ngModel)]="createForm.categoria_id" name="categoriaId">
              <option [ngValue]="null">Seleccionar categoría...</option>
              <option *ngFor="let categoria of categorias()" [ngValue]="categoria.id">
                {{ categoria.nombre }}
              </option>
            </select>
          </label>
          <label>
            Capacidad operativa
            <input [(ngModel)]="createForm.capacidad" name="capacidad" type="number" min="1" max="1000" />
          </label>
          <label>
            Horarios
            <input [(ngModel)]="createForm.horarios" name="horarios" placeholder="Lun-Dom 08:00 a 22:00" />
          </label>
          <label>
            Servicios
            <input [(ngModel)]="servicesText" name="servicios" placeholder="motor, llantas, batería" />
          </label>
          <label class="full">
            Dirección
            <input [(ngModel)]="createForm.direccion" name="direccion" placeholder="Av. Banzer, 4to anillo" />
          </label>
          <label>
            Disponible
            <select [(ngModel)]="createForm.disponible" name="disponible">
              <option [ngValue]="true">Sí</option>
              <option [ngValue]="false">No</option>
            </select>
          </label>
          <label>
            Aceptación automática
            <select [(ngModel)]="createForm.acepta_automaticamente" name="autoAccept">
              <option [ngValue]="false">No</option>
              <option [ngValue]="true">Sí</option>
            </select>
          </label>
          <label>
            Marca asociada <span class="optional-tag">(opcional)</span>
            <input [(ngModel)]="createForm.marca_asociada" name="marcaAsociada"
              placeholder="Ej: TOYOTA" />
            <small class="hint">Déjalo vacío si el taller no es concesionario de ninguna marca. Si se completa, las cotizaciones para vehículos de esa marca recibirán un 15% de descuento automático.</small>
          </label>
        </div>

        <div class="map-block">
          <div class="map-copy">
            <h4>Ubicación del taller</h4>
            <p>Haz clic en el mapa, usa tu ubicación o busca por dirección. La selección confirmada completa latitud, longitud y ayuda a fijar la dirección exacta.</p>
          </div>
          <app-mapa-picker
            [incidentPoints]="[]"
            [technicians]="[]"
            [unitLocation]="null"
            (selectionDetails)="onWorkshopLocationConfirmed($event)"
          />
        </div>

        <p class="feedback success" *ngIf="successMessage()">{{ successMessage() }}</p>
        <p class="feedback error" *ngIf="errorMessage()">{{ errorMessage() }}</p>

        <div class="panel-actions">
          <button class="btn-refresh" type="button" (click)="resetForm()">Limpiar</button>
          <button class="btn-primary" type="button" (click)="createWorkshop()" [disabled]="isSubmitting()">
            {{ isSubmitting() ? 'Creando...' : 'Crear taller' }}
          </button>
        </div>
      </section>

      <div class="stats-bar">
        <div class="stat-pill">
          <span class="label">Total talleres:</span>
          <strong>{{ talleres().length }}</strong>
        </div>
        <div class="stat-pill success">
          <span class="dot pulse"></span>
          <span class="label">Disponibles:</span>
          <strong>{{ talleresDisponibles() }}</strong>
        </div>
      </div>

      <div class="tech-grid">
        <article *ngFor="let taller of talleres()" class="tech-card" [class.off]="taller.disponible === false">
          <div class="card-header">
            <div class="avatar">
              {{ taller.nombre.substring(0, 2).toUpperCase() }}
            </div>
            <div class="status-badge" [class.is-ok]="taller.disponible !== false">
              {{ taller.disponible === false ? 'NO DISPONIBLE' : 'DISPONIBLE' }}
            </div>
          </div>

          <div class="card-body">
            <h3>{{ taller.nombre }}</h3>
            <span class="specialty-tag">{{ taller.categoria?.nombre || 'Sin categoría' }}</span>
            <span class="specialty-tag">Capacidad {{ taller.capacidad }}</span>
            <span class="specialty-tag">
              {{ taller.latitud | number:'1.4-4' }}, {{ taller.longitud | number:'1.4-4' }}
            </span>
            <p class="address">{{ taller.direccion }}</p>
            <div class="contact-info">
              <a [href]="'tel:' + taller.telefono" class="phone-link">
                <span class="icon" aria-hidden="true"><app-icon name="phone" [size]="16" /></span>
                {{ taller.telefono }}
              </a>
            </div>
            <p class="services" *ngIf="taller.servicios?.length">
              Servicios: {{ taller.servicios?.join(', ') }}
            </p>
            <p class="brand-badge" *ngIf="taller.marca_asociada">
              <span class="brand-tag">Marca oficial: {{ taller.marca_asociada }}</span>
              <span class="discount-tag">15% dto.</span>
            </p>
          </div>
        </article>
      </div>

      <div *ngIf="talleres().length === 0 && !isLoading()" class="empty-state">
        <p>No se encontraron talleres registrados en el sistema.</p>
      </div>
    </section>
  `,
  styles: `
    :host { --primary: #2563eb; --success: #22c55e; --dark: #0f172a; --gray: #64748b; --bg: #f8fafc; }
    .management-container { padding: 2rem; background: var(--bg); min-height: 100vh; font-family: 'Inter', sans-serif; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem; }
    .page-header h2 { margin: 0; color: var(--dark); font-size: 1.75rem; letter-spacing: -0.5px; }
    .page-header p { margin: 0.25rem 0 0; color: var(--gray); }
    .header-actions { display: flex; gap: 1rem; align-items: center; }
    .icon { display: inline-flex; align-items: center; justify-content: center; }
    .btn-primary { border: none; background: linear-gradient(135deg,#2563eb,#1d4ed8); color: #fff; border-radius: 12px; padding: .75rem 1.2rem; font-weight: 700; cursor: pointer; }
    .create-panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 10px 30px rgba(15,23,42,.05); }
    .panel-header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; margin-bottom: 1rem; }
    .panel-header h3 { margin: 0 0 .35rem; color: var(--dark); }
    .panel-header p { margin: 0; color: var(--gray); }
    .panel-badge { padding: .35rem .75rem; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: .8rem; }
    .form-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1rem; margin-bottom: 1rem; }
    .form-grid label { display: grid; gap: .45rem; font-weight: 600; color: #334155; }
    .form-grid label.full { grid-column: 1 / -1; }
    .form-grid input, .form-grid select { border: 1.5px solid #dbe3ef; border-radius: 12px; padding: .8rem .95rem; font: inherit; background: #fff; }
    .map-block { display: grid; gap: 1rem; margin-top: 1rem; }
    .map-copy h4 { margin: 0 0 .35rem; color: var(--dark); }
    .map-copy p { margin: 0; color: var(--gray); }
    .feedback { margin: 1rem 0 0; font-weight: 600; }
    .feedback.success { color: #166534; }
    .feedback.error { color: #b91c1c; }
    .panel-actions { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 1rem; }
    .stats-bar { display: flex; gap: 1rem; margin-bottom: 2rem; }
    .stat-pill { background: white; padding: 0.5rem 1rem; border-radius: 100px; display: flex; align-items: center; gap: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); font-size: 0.9rem; border: 1px solid #e2e8f0; }
    .stat-pill.success { border-color: #dcfce7; color: #166534; }
    .stat-pill strong { color: var(--dark); font-size: 1.1rem; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); }
    .dot.pulse { animation: pulse-green 2s infinite; }
    .tech-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
    .tech-card { background: white; border-radius: 24px; padding: 1.5rem; border: 1px solid #f1f5f9; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); transition: all 0.3s ease; display: flex; flex-direction: column; position: relative; }
    .tech-card:hover { transform: translateY(-5px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border-color: var(--primary); }
    .tech-card.off { opacity: 0.78; background: #fdfdfd; }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; }
    .avatar { width: 48px; height: 48px; background: var(--dark); color: white; border-radius: 16px; display: grid; place-items: center; font-weight: 800; font-size: 1.1rem; }
    .status-badge { padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.65rem; font-weight: 900; background: #f1f5f9; color: #64748b; letter-spacing: 0.05em; }
    .status-badge.is-ok { background: #dcfce7; color: #166534; }
    .card-body h3 { margin: 0 0 0.5rem; font-size: 1.25rem; color: var(--dark); }
    .specialty-tag { display: inline-block; padding: 0.25rem 0.6rem; background: #eff6ff; color: var(--primary); border-radius: 6px; font-size: 0.75rem; font-weight: 700; margin: 0 0 .6rem .4rem; }
    .address { color: #475569; margin: .35rem 0 1rem; min-height: 42px; }
    .services { color: #475569; margin: .75rem 0 0; }
    .contact-info { margin-bottom: .5rem; }
    .phone-link { text-decoration: none; color: var(--gray); font-family: monospace; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; transition: color 0.2s; }
    .phone-link:hover { color: var(--primary); }
    .brand-badge { display: flex; align-items: center; gap: .45rem; margin: .75rem 0 0; flex-wrap: wrap; }
    .brand-tag { background: #fef9c3; color: #92400e; border-radius: 6px; padding: .2rem .55rem; font-size: .75rem; font-weight: 700; }
    .discount-tag { background: #dcfce7; color: #166534; border-radius: 6px; padding: .2rem .55rem; font-size: .75rem; font-weight: 700; }
    .hint { color: var(--gray); font-size: .78rem; font-weight: 400; margin-top: .2rem; }
    .optional-tag { color: var(--gray); font-size: .78rem; font-weight: 400; }
    .btn-refresh { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.25rem; background: white; border: 1.5px solid #e2e8f0; border-radius: 12px; font-weight: 600; cursor: pointer; }
    .spinning { animation: spin 1s linear infinite; display: inline-block; }
    .empty-state { text-align: center; padding: 4rem; color: var(--gray); }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse-green { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
    @media (max-width: 900px) {
      .management-container { padding: 1rem; }
      .page-header { flex-direction: column; align-items: stretch; }
      .header-actions { flex-direction: column; align-items: stretch; }
      .form-grid { grid-template-columns: 1fr; }
      .panel-header { flex-direction: column; align-items: flex-start; }
      .panel-actions { flex-direction: column; align-items: stretch; }
      .stats-bar { flex-wrap: wrap; }
    }
  `
})
export class TecnicosPageComponent implements OnInit {
  private readonly api = inject(EmergencyApiService);

  readonly talleres = signal<Taller[]>([]);
  readonly categorias = signal<CategoriaTaller[]>([]);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly showCreatePanel = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  servicesText = '';
  readonly createForm: TallerCreatePayload = this.buildInitialForm();

  readonly talleresDisponibles = computed(() => this.talleres().filter((item) => item.disponible !== false).length);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.api.getTalleres().subscribe({
      next: (data) => {
        this.talleres.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
    this.api.getCategoriasTaller().subscribe({
      next: (data) => this.categorias.set(data),
      error: () => this.categorias.set([])
    });
  }

  toggleCreatePanel() {
    this.showCreatePanel.update((value) => !value);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  resetForm() {
    Object.assign(this.createForm, this.buildInitialForm());
    this.servicesText = '';
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  onWorkshopLocationConfirmed(event: { location: { lat: number; lng: number }; address: string }) {
    this.createForm.latitud = event.location.lat;
    this.createForm.longitud = event.location.lng;
    if (!this.createForm.direccion.trim() && event.address.trim()) {
      this.createForm.direccion = event.address.trim();
    }
  }

  formatCoord(value: number | undefined | null): string {
    return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(6) : '';
  }

  createWorkshop() {
    if (
      !this.createForm.nombre.trim() ||
      !this.createForm.email?.trim() ||
      !this.createForm.password?.trim() ||
      !this.createForm.telefono.trim() ||
      !this.createForm.categoria_id ||
      !this.createForm.direccion.trim() ||
      !Number.isFinite(this.createForm.latitud) ||
      !Number.isFinite(this.createForm.longitud)
    ) {
      this.errorMessage.set('Completa nombre, acceso, categoría y ubicación confirmada en el mapa.');
      this.successMessage.set('');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const rawMarca = (this.createForm.marca_asociada ?? '').toString().trim().toUpperCase();
    const payload: TallerCreatePayload = {
      ...this.createForm,
      nombre: this.createForm.nombre.trim(),
      email: this.createForm.email?.trim() || null,
      password: this.createForm.password?.trim() || null,
      telefono: this.createForm.telefono.trim(),
      direccion: this.createForm.direccion.trim(),
      horarios: this.createForm.horarios?.trim() || null,
      servicios: this.servicesText
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
      disponible: this.createForm.disponible !== false,
      acepta_automaticamente: this.createForm.acepta_automaticamente === true,
      marca_asociada: rawMarca || null,
    };

    this.api.createTaller(payload).subscribe({
      next: (taller) => {
        this.talleres.update((items) => [taller, ...items]);
        const name = taller.nombre;
        this.resetForm();
        this.showCreatePanel.set(false);
        this.successMessage.set(`Taller "${name}" creado correctamente con ubicación geográfica registrada.`);
        this.isSubmitting.set(false);
      },
      error: (error) => {
        const detail = error?.error?.detail;
        this.errorMessage.set(typeof detail === 'string' ? detail : 'No se pudo crear el taller.');
        this.isSubmitting.set(false);
      }
    });
  }

  private buildInitialForm(): TallerCreatePayload {
    const defaultCategory = this.categorias()[0]?.id ?? 1;
    return {
      categoria_id: defaultCategory,
      nombre: '',
      direccion: '',
      latitud: NaN,
      longitud: NaN,
      telefono: '',
      horarios: '',
      certificaciones: '',
      servicios: [],
      capacidad: 4,
      disponible: true,
      acepta_automaticamente: false,
      marca_asociada: null,
      email: '',
      password: ''
    };
  }
}

export {};



import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmergencyApiService } from '../core/services/emergency-api.service';
import { Cliente, ClienteCreatePayload } from '../core/models/api.models';

@Component({
  selector: 'app-clientes-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="management-container">
      <header class="page-header">
        <div class="title-group">
          <h2>Directorio de Clientes</h2>
          <p>Gestión de usuarios finales y registros de contacto</p>
        </div>
        <div class="header-actions">
          <button class="btn-primary" (click)="toggleCreatePanel()">
            {{ showCreatePanel() ? 'Cerrar alta' : 'Nuevo cliente' }}
          </button>
          <div class="search-mock">
            <span class="icon">🔍</span>
            <input type="text" placeholder="Buscar cliente..." disabled>
          </div>
          <button (click)="loadData()" class="btn-refresh" [disabled]="isLoading()">
            <span class="icon" [class.spinning]="isLoading()">🔄</span>
          </button>
        </div>
      </header>

      <section class="create-panel" *ngIf="showCreatePanel()">
        <div class="panel-header">
          <div>
            <h3>Alta administrativa de cliente</h3>
            <p>Administrador y operador pueden crear un cliente con acceso y su primer vehículo listo para móvil.</p>
          </div>
          <span class="panel-badge">Crea user + rol + perfil + vehículo</span>
        </div>

        <div class="form-grid">
          <label>
            Nombre
            <input [(ngModel)]="createForm.nombre" name="nombre" placeholder="Juan Pérez" />
          </label>
          <label>
            Correo
            <input [(ngModel)]="createForm.email" name="email" type="email" placeholder="cliente.nuevo@emergency.com" />
          </label>
          <label>
            Teléfono
            <input [(ngModel)]="createForm.telefono" name="telefono" placeholder="70000000" />
          </label>
          <label>
            Contraseña
            <input [(ngModel)]="createForm.password" name="password" type="password" placeholder="Password123*" />
          </label>
          <label class="span-2">
            Dirección
            <input [(ngModel)]="createForm.direccion" name="direccion" placeholder="Dirección del cliente" />
          </label>
          <label>
            Marca del vehículo
            <input [(ngModel)]="createForm.vehiculo.marca" name="marca" placeholder="Toyota" />
          </label>
          <label>
            Modelo del vehículo
            <input [(ngModel)]="createForm.vehiculo.modelo" name="modelo" placeholder="Corolla" />
          </label>
          <label>
            Placa
            <input [(ngModel)]="createForm.vehiculo.placa" name="placa" placeholder="1234ABC" />
          </label>
          <label>
            Color
            <input [(ngModel)]="createForm.vehiculo.color" name="color" placeholder="Blanco" />
          </label>
          <label>
            Año
            <input [(ngModel)]="createForm.vehiculo.anio" name="anio" type="number" placeholder="2020" />
          </label>
        </div>

        <p class="feedback success" *ngIf="successMessage()">{{ successMessage() }}</p>
        <p class="feedback error" *ngIf="errorMessage()">{{ errorMessage() }}</p>

        <div class="panel-actions">
          <button class="btn-refresh" type="button" (click)="resetForm()">Limpiar</button>
          <button class="btn-primary" type="button" (click)="createCliente()" [disabled]="isSubmitting()">
            {{ isSubmitting() ? 'Creando...' : 'Crear cliente' }}
          </button>
        </div>
      </section>

      <div class="table-container">
        <table class="modern-table">
          <thead>
            <tr>
              <th><span class="th-content">👤 Cliente</span></th>
              <th><span class="th-content">🔐 Acceso</span></th>
              <th><span class="th-content">📞 Contacto</span></th>
              <th><span class="th-content">🚗 Vehículo Inicial</span></th>
              <th class="text-center"><span class="th-content">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let cliente of clientes()">
              <td class="client-cell">
                <div class="client-info">
                  <span class="client-name">{{ cliente.nombre }}</span>
                  <span class="client-id">ID-{{ cliente.id || 'USR' }}</span>
                </div>
              </td>
              <td>
                <div class="access-info">
                  <strong>{{ cliente.user?.email || 'Sin correo' }}</strong>
                  <small>Rol CLIENTE</small>
                </div>
              </td>
              <td>
                <a [href]="'tel:' + cliente.telefono" class="phone-badge">
                  {{ cliente.telefono }}
                </a>
              </td>
              <td class="vehicle-cell">
                <div class="vehicle-info" *ngIf="cliente.vehiculos?.length; else noVehicle">
                  <strong>{{ cliente.vehiculos?.[0]?.marca }} {{ cliente.vehiculos?.[0]?.modelo }}</strong>
                  <small>{{ cliente.vehiculos?.[0]?.placa }} · {{ cliente.vehiculos?.[0]?.anio }}</small>
                </div>
                <ng-template #noVehicle>
                  <span class="address-text">Sin vehículo inicial</span>
                </ng-template>
              </td>
              <td class="text-center">
                <button class="btn-icon">👁️</button>
                <button class="btn-icon">✏️</button>
              </td>
            </tr>

            <tr *ngIf="clientes().length === 0 && !isLoading()">
              <td colspan="5" class="empty-row">
                No hay clientes registrados en el sistema.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: `
    :host { --primary: #2563eb; --dark: #0f172a; --gray: #64748b; --bg: #f8fafc; }

    .management-container { padding: 2rem; background: var(--bg); min-height: 100vh; font-family: 'Inter', sans-serif; }

    /* Header */
    .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
    .page-header h2 { margin: 0; color: var(--dark); font-size: 1.75rem; letter-spacing: -0.5px; }
    .page-header p { margin: 0.25rem 0 0; color: var(--gray); }
    .btn-primary{
      border:none;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;
      border-radius:12px;padding:.75rem 1.2rem;font-weight:700;cursor:pointer
    }

    .header-actions { display: flex; gap: 1rem; align-items: center; }
    .search-mock { 
      display: flex; align-items: center; gap: 0.5rem; background: white; 
      padding: 0.6rem 1rem; border-radius: 12px; border: 1.5px solid #e2e8f0; width: 250px;
    }
    .search-mock input { border: none; outline: none; font-size: 0.9rem; width: 100%; color: var(--gray); }

    .create-panel{
      background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:1.5rem;
      margin-bottom:1.5rem;box-shadow:0 10px 30px rgba(15,23,42,.05)
    }
    .panel-header{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem}
    .panel-header h3{margin:0 0 .35rem;color:var(--dark)}
    .panel-header p{margin:0;color:var(--gray)}
    .panel-badge{padding:.35rem .75rem;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:.8rem}
    .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}
    .form-grid label{display:grid;gap:.45rem;font-weight:600;color:#334155}
    .form-grid input{
      border:1.5px solid #dbe3ef;border-radius:12px;padding:.8rem .95rem;font:inherit
    }
    .span-2{grid-column:span 2}
    .feedback{margin:1rem 0 0;font-weight:600}
    .feedback.success{color:#166534}
    .feedback.error{color:#b91c1c}
    .panel-actions{display:flex;justify-content:flex-end;gap:.75rem;margin-top:1rem}

    /* Tabla Estilizada */
    .table-container { 
      background: white; border-radius: 24px; overflow: hidden;
      box-shadow: 0 10px 30px rgba(15,23,42,.05); border: 1px solid #f1f5f9;
    }

    .modern-table { width: 100%; border-collapse: collapse; text-align: left; }
    
    .modern-table thead { background: #f8fafc; border-bottom: 2px solid #f1f5f9; }
    .th-content { display: block; padding: 1.2rem 1.5rem; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }

    .modern-table tbody tr { transition: background 0.2s; border-bottom: 1px solid #f1f5f9; }
    .modern-table tbody tr:hover { background: #fbfcfe; }
    .modern-table td { padding: 1.2rem 1.5rem; color: #334155; font-size: 0.95rem; }

    /* Celdas específicas */
    .client-cell .client-info { display: flex; flex-direction: column; }
    .client-name { font-weight: 700; color: var(--dark); }
    .client-id { font-size: 0.75rem; color: var(--gray); font-family: monospace; }
    .access-info{display:flex;flex-direction:column;gap:.2rem}
    .access-info strong{color:var(--dark);font-size:.92rem}
    .access-info small{color:var(--gray)}

    .phone-badge { 
      display: inline-block; padding: 0.4rem 0.8rem; background: #eff6ff; color: var(--primary);
      border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 0.85rem; transition: 0.2s;
    }
    .phone-badge:hover { background: var(--primary); color: white; }

    .vehicle-cell { min-width: 220px; }
    .vehicle-info{display:flex;flex-direction:column;gap:.2rem}
    .vehicle-info strong{color:var(--dark);font-size:.92rem}
    .vehicle-info small{color:var(--gray)}
    .address-cell { max-width: 300px; }
    .address-text { 
      display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; 
      color: #64748b; font-size: 0.9rem;
    }

    .text-center { text-align: center; }
    .btn-icon { 
      background: none; border: none; font-size: 1.1rem; cursor: pointer; padding: 0.5rem;
      border-radius: 8px; transition: 0.2s; grayscale: 1; opacity: 0.6;
    }
    .btn-icon:hover { background: #f1f5f9; grayscale: 0; opacity: 1; }

    /* Utils */
    .btn-refresh { 
      background: white; border: 1.5px solid #e2e8f0; border-radius: 12px; 
      padding: 0.6rem; cursor: pointer; height: 42px; width: 42px; display: grid; place-items: center;
    }
    .spinning { animation: spin 1s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-row { text-align: center; padding: 3rem !important; color: var(--gray); font-style: italic; }

    /* Responsive */
    @media (max-width: 1100px) {
      .page-header { flex-direction: column; align-items: stretch; gap: 1rem; }
      .header-actions { flex-wrap: wrap; justify-content: flex-start; }
    }

    @media (max-width: 900px) {
      .management-container { padding: 1rem; }
      .search-mock { width: 100%; }
      .panel-header { flex-direction: column; align-items: flex-start; }
      .panel-actions { flex-direction: column; align-items: stretch; }
      .form-grid { grid-template-columns: 1fr; }
      .span-2 { grid-column: auto; }
      .table-container { overflow-x: auto; }
      .modern-table { min-width: 820px; }
    }

    @media (max-width: 480px) {
      .th-content, .modern-table td { padding: 1rem; }
    }
  `
})
export class ClientesPageComponent implements OnInit {
  private readonly api = inject(EmergencyApiService);
  
  readonly clientes = signal<Cliente[]>([]);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly showCreatePanel = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly createForm: ClienteCreatePayload = {
    nombre: '',
    email: '',
    telefono: '',
    password: '',
    direccion: '',
    vehiculo: {
      marca: '',
      modelo: '',
      anio: new Date().getFullYear(),
      placa: '',
      color: '',
      tipo_combustible: 'Gasolina'
    }
  };

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.api.getClientes().subscribe({
      next: (data) => {
        this.clientes.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  toggleCreatePanel() {
    this.showCreatePanel.update((value) => !value);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  resetForm() {
    this.createForm.nombre = '';
    this.createForm.email = '';
    this.createForm.telefono = '';
    this.createForm.password = '';
    this.createForm.direccion = '';
    this.createForm.vehiculo.marca = '';
    this.createForm.vehiculo.modelo = '';
    this.createForm.vehiculo.anio = new Date().getFullYear();
    this.createForm.vehiculo.placa = '';
    this.createForm.vehiculo.color = '';
    this.createForm.vehiculo.tipo_combustible = 'Gasolina';
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  createCliente() {
    if (
      !this.createForm.nombre ||
      !this.createForm.email ||
      !this.createForm.password ||
      !this.createForm.telefono ||
      !this.createForm.direccion ||
      !this.createForm.vehiculo.marca ||
      !this.createForm.vehiculo.modelo ||
      !this.createForm.vehiculo.placa ||
      !this.createForm.vehiculo.color ||
      !this.createForm.vehiculo.anio
    ) {
      this.errorMessage.set('Completa datos del cliente y del vehículo inicial.');
      this.successMessage.set('');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.api.createCliente({
      nombre: this.createForm.nombre.trim(),
      email: this.createForm.email.trim(),
      password: this.createForm.password,
      telefono: this.createForm.telefono.trim(),
      direccion: this.createForm.direccion.trim(),
      vehiculo: {
        marca: this.createForm.vehiculo.marca.trim(),
        modelo: this.createForm.vehiculo.modelo.trim(),
        anio: Number(this.createForm.vehiculo.anio),
        placa: this.createForm.vehiculo.placa.trim().toUpperCase(),
        color: this.createForm.vehiculo.color.trim(),
        tipo_combustible: 'Gasolina'
      }
    }).subscribe({
      next: (cliente) => {
        this.clientes.update((items) => [cliente, ...items]);
        const accessEmail = cliente.user?.email || this.createForm.email;
        const vehiclePlate = cliente.vehiculos?.[0]?.placa || this.createForm.vehiculo.placa.trim().toUpperCase();
        this.resetForm();
        this.showCreatePanel.set(false);
        this.successMessage.set(`Cliente creado correctamente. Acceso: ${accessEmail}. Vehículo inicial: ${vehiclePlate}`);
        this.isSubmitting.set(false);
      },
      error: (error) => {
        this.errorMessage.set(this.getErrorMessage(error));
        this.isSubmitting.set(false);
      }
    });
  }

  private getErrorMessage(error: { error?: { detail?: unknown } }): string {
    const detail = error?.error?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }
          if (item && typeof item === 'object' && 'msg' in item && typeof item.msg === 'string') {
            const path = Array.isArray(item.loc)
              ? item.loc.filter((part: string | number) => part !== 'body').join('.')
              : '';
            return path ? `${path}: ${item.msg}` : item.msg;
          }
          return null;
        })
        .filter((item): item is string => Boolean(item));
      if (messages.length) {
        return messages.join(' · ');
      }
    }
    return 'No se pudo crear el cliente.';
  }
}

export {};

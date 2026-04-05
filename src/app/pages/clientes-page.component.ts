import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { EmergencyApiService } from '../core/services/emergency-api.service';
import { Cliente } from '../core/models/api.models';

@Component({
  selector: 'app-clientes-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="management-container">
      <header class="page-header">
        <div class="title-group">
          <h2>Directorio de Clientes</h2>
          <p>Gestión de usuarios finales y registros de contacto</p>
        </div>
        <div class="header-actions">
          <div class="search-mock">
            <span class="icon">🔍</span>
            <input type="text" placeholder="Buscar cliente..." disabled>
          </div>
          <button (click)="loadData()" class="btn-refresh" [disabled]="isLoading()">
            <span class="icon" [class.spinning]="isLoading()">🔄</span>
          </button>
        </div>
      </header>

      <div class="table-container">
        <table class="modern-table">
          <thead>
            <tr>
              <th><span class="th-content">👤 Cliente</span></th>
              <th><span class="th-content">📞 Contacto</span></th>
              <th><span class="th-content">📍 Ubicación Registrada</span></th>
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
                <a [href]="'tel:' + cliente.telefono" class="phone-badge">
                  {{ cliente.telefono }}
                </a>
              </td>
              <td class="address-cell">
                <span class="address-text">{{ cliente.direccion }}</span>
              </td>
              <td class="text-center">
                <button class="btn-icon">👁️</button>
                <button class="btn-icon">✏️</button>
              </td>
            </tr>

            <tr *ngIf="clientes().length === 0 && !isLoading()">
              <td colspan="4" class="empty-row">
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

    .header-actions { display: flex; gap: 1rem; align-items: center; }
    .search-mock { 
      display: flex; align-items: center; gap: 0.5rem; background: white; 
      padding: 0.6rem 1rem; border-radius: 12px; border: 1.5px solid #e2e8f0; width: 250px;
    }
    .search-mock input { border: none; outline: none; font-size: 0.9rem; width: 100%; color: var(--gray); }

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

    .phone-badge { 
      display: inline-block; padding: 0.4rem 0.8rem; background: #eff6ff; color: var(--primary);
      border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 0.85rem; transition: 0.2s;
    }
    .phone-badge:hover { background: var(--primary); color: white; }

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
  `
})
export class ClientesPageComponent implements OnInit {
  private readonly api = inject(EmergencyApiService);
  
  readonly clientes = signal<Cliente[]>([]);
  readonly isLoading = signal(false);

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
}

export {};

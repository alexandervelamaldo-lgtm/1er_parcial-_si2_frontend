import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { EmergencyApiService } from '../core/services/emergency-api.service';
import { Cliente } from '../core/models/api.models';


@Component({
  selector: 'app-clientes-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="list-page">
      <h2>Clientes</h2>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Dirección</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let cliente of clientes()">
            <td>{{ cliente.nombre }}</td>
            <td>{{ cliente.telefono }}</td>
            <td>{{ cliente.direccion }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `,
  styles: `
    table{width:100%;border-collapse:collapse;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08)}
    th,td{padding:1rem;border-bottom:1px solid #e2e8f0;text-align:left}
    h2{margin-top:0}
  `
})
export class ClientesPageComponent {
  private readonly api = inject(EmergencyApiService);
  readonly clientes = signal<Cliente[]>([]);

  constructor() {
    this.api.getClientes().subscribe((data) => this.clientes.set(data));
  }
}

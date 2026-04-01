import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { AuthService } from '../core/services/auth.service';


@Component({
  selector: 'app-perfil-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="profile-page" *ngIf="profile() as profile">
      <article class="profile-card">
        <h2>Perfil del usuario</h2>
        <p><strong>Correo:</strong> {{ profile.user.email }}</p>
        <p><strong>Estado:</strong> {{ profile.user.is_active ? 'Activo' : 'Inactivo' }}</p>
        <p><strong>Roles:</strong> {{ roleLabel() }}</p>
        <p *ngIf="profile.cliente_id"><strong>ID Cliente:</strong> {{ profile.cliente_id }}</p>
        <p *ngIf="profile.tecnico_id"><strong>ID Técnico:</strong> {{ profile.tecnico_id }}</p>
        <p *ngIf="profile.operador_id"><strong>ID Operador:</strong> {{ profile.operador_id }}</p>
      </article>
    </section>
  `,
  styles: `
    .profile-card{padding:1.5rem;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.08)}
    h2{margin-top:0}
    p{color:#334155}
  `
})
export class PerfilPageComponent {
  private readonly authService = inject(AuthService);

  readonly profile = computed(() => this.authService.currentProfile());
  readonly roleLabel = computed(() => this.authService.currentRoles().join(', '));
}

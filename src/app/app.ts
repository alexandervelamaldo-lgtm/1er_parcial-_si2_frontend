import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/services/auth.service';


interface NavigationItem {
  label: string;
  path: string;
  roles?: string[];
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly navigationItems: NavigationItem[] = [
    { label: 'Dashboard', path: '/dashboard', roles: ['ADMINISTRADOR', 'OPERADOR', 'TECNICO', 'TALLER'] },
    { label: 'Solicitudes', path: '/solicitudes', roles: ['ADMINISTRADOR', 'OPERADOR', 'TECNICO', 'TALLER'] },
    { label: 'Técnicos', path: '/tecnicos', roles: ['ADMINISTRADOR', 'OPERADOR'] },
    { label: 'Clientes', path: '/clientes', roles: ['ADMINISTRADOR', 'OPERADOR'] },
    { label: 'Historial', path: '/historial' },
    { label: 'Notificaciones', path: '/notificaciones' },
    { label: 'Perfil', path: '/perfil' }
  ];

  protected readonly isAuthenticated = computed(() => this.authService.isAuthenticated());
  protected readonly profile = computed(() => this.authService.currentProfile());
  protected readonly visibleNavigation = computed(() =>
    this.navigationItems.filter((item) => !item.roles || this.authService.hasAnyRole(item.roles))
  );
  protected readonly roleLabel = computed(() => this.authService.currentRoles().join(', '));

  logout() {
    this.authService.logout();
  }
}

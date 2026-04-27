import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/services/autenticacion-acceso/auth.service';


interface NavigationItem {
  label: string;
  path: string;
  roles?: string[];
}

interface NavigationSection {
  packageName: string;
  title: string;
  items: NavigationItem[];
  contextualHint?: string;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly navigationSectionsData: NavigationSection[] = [
    {
      packageName: 'autenticacion-acceso',
      title: 'Autenticación y Acceso',
      items: [{ label: 'Perfil', path: '/perfil' }]
    },
    {
      packageName: 'gestion-solicitudes',
      title: 'Gestión de Solicitudes',
      items: [
        { label: 'Panel', path: '/dashboard', roles: ['ADMINISTRADOR', 'OPERADOR', 'TECNICO', 'TALLER'] },
        { label: 'Solicitudes', path: '/solicitudes', roles: ['ADMINISTRADOR', 'OPERADOR', 'TECNICO', 'TALLER'] }
      ]
    },
    {
      packageName: 'gestion-operativa-web',
      title: 'Gestión Operativa Web',
      items: [
        { label: 'Técnicos', path: '/tecnicos', roles: ['ADMINISTRADOR', 'OPERADOR'] },
        { label: 'Clientes', path: '/clientes', roles: ['ADMINISTRADOR', 'OPERADOR'] },
        { label: 'Notificaciones', path: '/notificaciones' }
      ]
    },
    {
      packageName: 'pagos-facturacion',
      title: 'Pagos y Facturación',
      items: [{ label: 'Trabajos', path: '/trabajos', roles: ['ADMINISTRADOR', 'OPERADOR', 'TALLER'] }]
    },
    {
      packageName: 'seguimiento-cliente-web',
      title: 'Seguimiento Cliente Web',
      items: [{ label: 'Historial', path: '/historial' }]
    },
    {
      packageName: 'inteligencia-automatizacion',
      title: 'Inteligencia y Automatización',
      items: [],
      contextualHint: 'Disponible desde el detalle de cada solicitud.'
    }
  ];

  protected readonly isAuthenticated = computed(() => this.authService.isAuthenticated());
  protected readonly profile = computed(() => this.authService.currentProfile());
  protected readonly visibleNavigationSections = computed(() =>
    this.navigationSectionsData
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.roles || this.authService.hasAnyRole(item.roles))
      }))
      .filter((section) => section.items.length > 0 || Boolean(section.contextualHint))
  );
  protected readonly roleLabel = computed(() => this.authService.currentRoles().join(', '));

  logout() {
    this.authService.logout();
  }
}


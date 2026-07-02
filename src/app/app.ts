import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/services/autenticacion-acceso/auth.service';
import { PushNotificationsService } from './core/services/notificaciones/push-notifications.service';
import { OfflineSyncService } from './core/services/offline/offline-sync.service';
import { TrackingService } from './core/services/tracking/tracking.service';
import { AppIconComponent } from './shared/components/app-icon/app-icon.component';
import { IconName } from './shared/components/app-icon/app-icon.component';


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

interface LiveNotificationBanner {
  title: string;
  message: string;
  url: string;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AppIconComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly offlineSync = inject(OfflineSyncService);
  private readonly tracking = inject(TrackingService);
  private readonly push = inject(PushNotificationsService);
  private readonly navigationSectionsData: NavigationSection[] = [
    {
      packageName: 'autenticacion-acceso',
      title: 'Cuenta',
      items: [{ label: 'Perfil', path: '/perfil' }]
    },
    {
      packageName: 'gestion-solicitudes',
      title: 'Operaciones',
      items: [
        { label: 'Panel', path: '/dashboard', roles: ['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR', 'TECNICO', 'TALLER'] },
        { label: 'Solicitudes', path: '/solicitudes', roles: ['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR', 'TECNICO', 'TALLER'] }
      ]
    },
    {
      packageName: 'gestion-operativa-web',
      title: 'Gestión',
      items: [
        { label: 'Talleres', path: '/tecnicos', roles: ['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR'] },
        { label: 'Clientes', path: '/clientes', roles: ['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR'] },
        { label: 'Bitácora', path: '/bitacora', roles: ['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR'] },
        { label: 'Respaldos', path: '/backups', roles: ['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR'] },
        { label: 'Notificaciones', path: '/notificaciones' }
      ]
    },
    {
      packageName: 'pagos-facturacion',
      title: 'Finanzas',
      items: [{ label: 'Trabajos', path: '/trabajos', roles: ['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR', 'TALLER'] }]
    },
    {
      packageName: 'seguimiento-cliente-web',
      title: 'Seguimiento',
      items: [{ label: 'Historial', path: '/historial' }]
    },
    {
      packageName: 'inteligencia-automatizacion',
      title: 'Inteligencia',
      items: [{ label: 'Asistente virtual', path: '/chat' }],
      contextualHint: 'El análisis de imágenes está disponible desde el detalle de cada solicitud.'
    },
    {
      // ── SaaS multi-tenant section ─────────────────────────────────────
      // Solo visible para usuarios con rol SUPER_ADMIN — la única entrada
      // que pueden ver/usar en el panel. El backend re-valida el rol en
      // cada endpoint /admin/tenants* así que es defensa en profundidad.
      packageName: 'super-admin',
      title: 'Administración SaaS',
      items: [
        { label: 'Tenants', path: '/super-admin/tenants', roles: ['SUPER_ADMIN'] }
      ]
    }
  ];

  private readonly navIconMap: Record<string, IconName> = {
    '/perfil': 'user',
    '/dashboard': 'signal',
    '/solicitudes': 'clipboard',
    '/tecnicos': 'wrench',
    '/clientes': 'user',
    '/bitacora': 'eye',
    '/backups': 'download',
    '/notificaciones': 'bell',
    '/trabajos': 'car',
    '/historial': 'clock',
    '/super-admin/tenants': 'shield',
    '/chat': 'message'
  };

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
  protected readonly liveNotification = signal<LiveNotificationBanner | null>(null);

  sidebarCollapsed = false;
  mobileMenuOpen = false;
  private liveNotificationTimer: number | null = null;

  constructor() {
    effect(() => {
      if (!this.authService.isAuthenticated()) {
        this.tracking.disconnect();
        return;
      }
      this.tracking.connect();
      if (this.push.getBrowserPermission() === 'granted') {
        void this.push.ensureSubscribed().catch(() => undefined);
      }
    });
    effect(() => {
      const event = this.tracking.notificationEvent();
      if (!event) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      this.liveNotification.set({
        title: event.titulo,
        message: event.mensaje,
        url: event.url || '/notificaciones'
      });
      if (this.liveNotificationTimer) {
        window.clearTimeout(this.liveNotificationTimer);
      }
      this.liveNotificationTimer = window.setTimeout(() => {
        this.liveNotification.set(null);
        this.liveNotificationTimer = null;
      }, 7000);
    });
  }

  getNavIcon(path: string): IconName {
    return this.navIconMap[path] || 'folder';
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  logout() {
    this.authService.logout();
  }

  dismissLiveNotification() {
    if (this.liveNotificationTimer) {
      window.clearTimeout(this.liveNotificationTimer);
      this.liveNotificationTimer = null;
    }
    this.liveNotification.set(null);
  }
}

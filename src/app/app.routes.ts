import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { homeRedirectGuard } from './core/guards/home-redirect.guard';
import { roleGuard } from './core/guards/role.guard';
import { LoginPageComponent } from './modules/autenticacion-acceso/pages/login-page.component';
import { DashboardPageComponent } from './modules/gestion-solicitudes/pages/dashboard-page.component';
import { SolicitudDetallePageComponent } from './modules/inteligencia-automatizacion/pages/solicitud-detalle-page.component';
import { SolicitudesPageComponent } from './modules/gestion-solicitudes/pages/solicitudes-page.component';
import { SolicitudWizardPageComponent } from './modules/gestion-solicitudes/pages/solicitud-wizard-page.component';
import { HistorialPageComponent } from './modules/seguimiento-cliente-web/pages/historial-page.component';
import { ClientesPageComponent } from './modules/gestion-operativa-web/pages/clientes-page.component';
import { BitacoraPageComponent } from './modules/gestion-operativa-web/pages/bitacora-page.component';
import { BackupPageComponent } from './modules/gestion-operativa-web/pages/backup-page.component';
import { NotificacionesPageComponent } from './modules/gestion-operativa-web/pages/notificaciones-page.component';
import { PerfilPageComponent } from './modules/gestion-operativa-web/pages/perfil-page.component';
import { TecnicosPageComponent } from './modules/gestion-operativa-web/pages/tecnicos-page.component';
import { TrabajosPageComponent } from './modules/pagos-facturacion/pages/trabajos-page.component';
import { TenantsPageComponent } from './modules/super-admin/pages/tenants-page.component';
import { AnalyticsDashboardPageComponent } from './modules/analitica-operacional/pages/analytics-dashboard-page.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPageComponent
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardPageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR', 'TECNICO', 'TALLER'])] },
      { path: 'solicitudes/nueva', component: SolicitudWizardPageComponent, canActivate: [roleGuard(['CLIENTE'])] },
      { path: 'solicitudes', component: SolicitudesPageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR', 'TECNICO', 'TALLER'])] },
      { path: 'solicitudes/:id', component: SolicitudDetallePageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR', 'TECNICO', 'TALLER'])] },
      { path: 'tecnicos', component: TecnicosPageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR'])] },
      { path: 'clientes', component: ClientesPageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR'])] },
      // Bitácora de auditoría — refleja la query del backend, que ya está
      // acotada al tenant del request; el rol se re-valida en el endpoint.
      { path: 'bitacora', component: BitacoraPageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR'])] },
      // Respaldos de la BD del tenant — backup manual + automático. El backend
      // respalda/restaura solo la base del tenant del request y re-valida el rol.
      { path: 'backups', component: BackupPageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR'])] },
      { path: 'trabajos', component: TrabajosPageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR', 'TALLER'])] },
      // Analítica operacional — KPIs del dashboard administrativo.
      // Solo ADMIN/OPERADOR ven todo el tenant; un TALLER vería su propio
      // dashboard en una ruta /taller/dashboard (TODO en siguiente iteración).
      { path: 'analitica', component: AnalyticsDashboardPageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'ADMIN_TENANT', 'OPERADOR'])] },
      { path: 'historial', component: HistorialPageComponent },
      { path: 'notificaciones', component: NotificacionesPageComponent },
      { path: 'perfil', component: PerfilPageComponent },
      // Super-admin panel for cross-tenant management — backend re-checks
      // the SUPER_ADMIN role on every endpoint so this is defense-in-depth.
      { path: 'super-admin/tenants', component: TenantsPageComponent, canActivate: [roleGuard(['SUPER_ADMIN'])] },
      { path: 'super-admin', pathMatch: 'full', redirectTo: 'super-admin/tenants' },
      // Empty path uses a guard that redirects to the role's landing page
      // (super-admin → /super-admin/tenants, others → /dashboard). Without
      // this, SUPER_ADMIN would loop forever between / and /dashboard.
      { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: [] }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];


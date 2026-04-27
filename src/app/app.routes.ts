import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { LoginPageComponent } from './modules/autenticacion-acceso/pages/login-page.component';
import { DashboardPageComponent } from './modules/gestion-solicitudes/pages/dashboard-page.component';
import { SolicitudDetallePageComponent } from './modules/inteligencia-automatizacion/pages/solicitud-detalle-page.component';
import { SolicitudesPageComponent } from './modules/gestion-solicitudes/pages/solicitudes-page.component';
import { HistorialPageComponent } from './modules/seguimiento-cliente-web/pages/historial-page.component';
import { ClientesPageComponent } from './modules/gestion-operativa-web/pages/clientes-page.component';
import { NotificacionesPageComponent } from './modules/gestion-operativa-web/pages/notificaciones-page.component';
import { PerfilPageComponent } from './modules/gestion-operativa-web/pages/perfil-page.component';
import { TecnicosPageComponent } from './modules/gestion-operativa-web/pages/tecnicos-page.component';
import { TrabajosPageComponent } from './modules/pagos-facturacion/pages/trabajos-page.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPageComponent
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardPageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'OPERADOR', 'TECNICO', 'TALLER'])] },
      { path: 'solicitudes', component: SolicitudesPageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'OPERADOR', 'TECNICO', 'TALLER'])] },
      { path: 'solicitudes/:id', component: SolicitudDetallePageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'OPERADOR', 'TECNICO', 'TALLER'])] },
      { path: 'tecnicos', component: TecnicosPageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'OPERADOR'])] },
      { path: 'clientes', component: ClientesPageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'OPERADOR'])] },
      { path: 'trabajos', component: TrabajosPageComponent, canActivate: [roleGuard(['ADMINISTRADOR', 'OPERADOR', 'TALLER'])] },
      { path: 'historial', component: HistorialPageComponent },
      { path: 'notificaciones', component: NotificacionesPageComponent },
      { path: 'perfil', component: PerfilPageComponent },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];


import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { ClientesPageComponent } from './pages/clientes-page.component';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { HistorialPageComponent } from './pages/historial-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { NotificacionesPageComponent } from './pages/notificaciones-page.component';
import { PerfilPageComponent } from './pages/perfil-page.component';
import { SolicitudDetallePageComponent } from './pages/solicitud-detalle-page.component';
import { SolicitudesPageComponent } from './pages/solicitudes-page.component';
import { TecnicosPageComponent } from './pages/tecnicos-page.component';

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

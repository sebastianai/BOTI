import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'portal-cliente',
    pathMatch: 'full'
  },
  {
    path: 'portal-cliente',
    loadComponent: () =>
      import('./portal-cliente/portal-cliente.component').then(
        m => m.PortalClienteComponent
      )
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./admin/admin.component').then(m => m.AdminComponent)
  }
];

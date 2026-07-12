import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'portal-cliente',
    pathMatch: 'full'
  },
  {
    path: 'portal-cliente',
    loadComponent: () =>
      import('./portal-cliente/portal-cliente.component').then(m => m.PortalClienteComponent),
    children: [
      {
        path: 'producto/:id',
        loadComponent: () =>
          import('./portal-cliente/components/vista-producto/vista-producto.component').then(m => m.VistaProductoComponent)
      },
      {
        path: 'pack/:id',
        loadComponent: () =>
          import('./portal-cliente/components/vista-pack/vista-pack.component').then(m => m.VistaPackComponent)
      }
    ]
  },
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./admin/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./admin/admin.component').then(m => m.AdminComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./admin/ajuste-manual-productos/ajuste-manual-productos.component')
            .then(m => m.AjusteManualProductosComponent)
      },
      {
        path: 'ajustes',
        loadComponent: () =>
          import('./admin/ajustes-generales/ajustes-generales.component')
            .then(m => m.AjustesGeneralesComponent)
      },
      {
        path: 'publicidad',
        loadComponent: () =>
          import('./admin/publicidad/publicidad.component')
            .then(m => m.PublicidadComponent)
      },
      {
        path: 'pedidos',
        loadComponent: () =>
          import('./admin/pedidos-admin/pedidos-admin.component')
            .then(m => m.PedidosAdminComponent)
      },
      {
        path: 'promos',
        loadComponent: () =>
          import('./admin/promos/promos.component')
            .then(m => m.PromosComponent)
      },
      {
        path: 'packs',
        loadComponent: () =>
          import('./admin/packs/packs.component')
            .then(m => m.PacksComponent)
      }
    ]
  }
];

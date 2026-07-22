import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  icon: string;
  ruta: string;
}

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.component.html',
  styleUrl: './admin-sidebar.component.scss'
})
export class AdminSidebarComponent {
  abierto = input(false);
  readonly cerrar = output<void>();

  protected readonly navItems: NavItem[] = [
    { label: 'Productos',         icon: '📦', ruta: '/admin' },
    { label: 'Pedidos',           icon: '🛒', ruta: '/admin/pedidos' },
    { label: 'Clientes',          icon: '👥', ruta: '/admin/clientes' },
    { label: 'Sucursales',        icon: '🏬', ruta: '/admin/sucursales' },
    { label: 'Estadísticas',      icon: '📊', ruta: '/admin/estadisticas' },
    { label: 'Publicidad',        icon: '📢', ruta: '/admin/publicidad' },
    { label: 'Promociones',       icon: '🏷️', ruta: '/admin/promos' },
    { label: 'Packs',             icon: '📦', ruta: '/admin/packs' },
    { label: 'Ajustes generales', icon: '⚙️', ruta: '/admin/ajustes' },
  ];
}

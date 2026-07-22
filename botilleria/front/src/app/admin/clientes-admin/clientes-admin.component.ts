import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { API_URL } from '../../core/api.config';

export interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  rut: string;
  correo: string;
  telefono: string | null;
  fecha_nacimiento: string | null;
  genero: string | null;
  activo: boolean;
  creado_en: string;
  total_pedidos: number;
  total_gastado: number;
}

export interface PedidoResumen {
  id: number;
  numero_pedido: string;
  estado: 'pendiente' | 'confirmado' | 'en_camino' | 'entregado' | 'cancelado';
  medio_pago: string | null;
  canal: string;
  total: number;
  total_items: number;
  fecha_pedido: string;
}

export interface ClienteDetalle extends Cliente {
  pedidos: PedidoResumen[];
}

@Component({
  selector: 'app-clientes-admin',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './clientes-admin.component.html',
  styleUrl: './clientes-admin.component.scss'
})
export class ClientesAdminComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly clientes    = signal<Cliente[]>([]);
  protected readonly cargando    = signal(true);
  protected readonly busqueda    = signal('');
  protected readonly detalle     = signal<ClienteDetalle | null>(null);
  protected readonly cargandoDet = signal(false);
  protected readonly errorMsg    = signal('');

  protected readonly clientesFiltrados = computed(() => {
    const bus = this.busqueda().toLowerCase().trim();
    if (!bus) return this.clientes();
    return this.clientes().filter(c =>
      c.nombre.toLowerCase().includes(bus) ||
      c.apellido.toLowerCase().includes(bus) ||
      c.rut.toLowerCase().includes(bus) ||
      c.correo.toLowerCase().includes(bus)
    );
  });

  protected readonly totalClientes = computed(() => this.clientes().length);
  protected readonly totalConPedidos = computed(() => this.clientes().filter(c => c.total_pedidos > 0).length);

  ngOnInit(): void { this.cargar(); }

  protected cargar(): void {
    this.cargando.set(true);
    this.http.get<Cliente[]>(`${API_URL}/clientes`).subscribe({
      next: data => { this.clientes.set(data); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.errorMsg.set('Error al cargar clientes'); }
    });
  }

  protected verDetalle(cliente: Cliente): void {
    this.cargandoDet.set(true);
    this.detalle.set({ ...cliente, pedidos: [] });
    this.http.get<ClienteDetalle>(`${API_URL}/clientes/${cliente.id}`).subscribe({
      next: full => { this.detalle.set(full); this.cargandoDet.set(false); },
      error: () => { this.cargandoDet.set(false); this.errorMsg.set('Error al cargar el detalle del cliente'); }
    });
  }

  protected cerrarDetalle(): void {
    this.detalle.set(null);
  }

  protected clp(n: number): string {
    return `$ ${Math.round(n).toLocaleString('es-CL')}`;
  }

  protected fecha(f: string | null, conHora = false): string {
    if (!f) return '—';
    const d = new Date(f);
    if (conHora) return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  protected labelGenero(g: string | null): string {
    const map: Record<string, string> = {
      femenino: 'Femenino', masculino: 'Masculino', no_decir: 'Prefiere no decir'
    };
    return g ? (map[g] ?? g) : '—';
  }

  protected labelEstado(estado: string): string {
    return estado === 'en_camino' ? 'En camino' : estado.charAt(0).toUpperCase() + estado.slice(1);
  }
}

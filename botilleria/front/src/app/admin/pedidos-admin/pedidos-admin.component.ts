import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { API_URL } from '../../core/api.config';
import { SucursalesService, Sucursal } from '../../portal-cliente/services/sucursales.service';

export interface PedidoItem {
  id: number;
  producto_id: number | null;
  nombre_producto: string;
  categoria: string | null;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
}

export interface Pedido {
  id: number;
  numero_pedido: string;
  nombre_cliente: string;
  rut_cliente: string | null;
  telefono_cliente: string | null;
  email_cliente: string | null;
  direccion_cliente: string | null;
  estado: 'pendiente' | 'confirmado' | 'en_camino' | 'entregado' | 'cancelado';
  medio_pago: string | null;
  canal: string;
  subtotal: number;
  costo_envio: number;
  total: number;
  notas: string | null;
  notas_internas: string | null;
  fecha_pedido: string;
  fecha_confirmacion: string | null;
  fecha_entrega_estimada: string | null;
  fecha_entrega_real: string | null;
  total_items: number;
  sucursal_id: number | null;
  sucursal_nombre: string | null;
  items?: PedidoItem[];
}

type EstadoFiltro = 'todos' | 'pendiente' | 'confirmado' | 'en_camino' | 'entregado' | 'cancelado';
type SucursalFiltro = 'todas' | 'sin_asignar' | number;

@Component({
  selector: 'app-pedidos-admin',
  standalone: true,
  imports: [FormsModule, TitleCasePipe],
  templateUrl: './pedidos-admin.component.html',
  styleUrl: './pedidos-admin.component.scss'
})
export class PedidosAdminComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly sucursalesService = inject(SucursalesService);
  private readonly route = inject(ActivatedRoute);

  protected readonly pedidos      = signal<Pedido[]>([]);
  protected readonly sucursales   = signal<Sucursal[]>([]);
  protected readonly cargando     = signal(true);
  protected readonly filtroEstado = signal<EstadoFiltro>('todos');
  protected readonly filtroSucursal = signal<SucursalFiltro>('todas');
  protected readonly busqueda     = signal('');
  protected readonly detalle      = signal<Pedido | null>(null);
  protected readonly cargandoDet  = signal(false);
  protected readonly guardandoEst = signal(false);
  protected readonly notasInt     = signal('');
  protected readonly guardandoNot = signal(false);
  protected readonly sucursalSel  = signal<number | null>(null);
  protected readonly guardandoSuc = signal(false);
  protected readonly errorMsg     = signal('');

  protected readonly estadosFiltro: { valor: EstadoFiltro; label: string }[] = [
    { valor: 'todos',      label: 'Todos'      },
    { valor: 'pendiente',  label: 'Pendientes' },
    { valor: 'confirmado', label: 'Confirmados' },
    { valor: 'en_camino',  label: 'En camino'  },
    { valor: 'entregado',  label: 'Entregados' },
    { valor: 'cancelado',  label: 'Cancelados' },
  ];

  protected readonly estadosAccion = [
    { valor: 'pendiente',  label: 'Pendiente',  emoji: '🕐' },
    { valor: 'confirmado', label: 'Confirmado', emoji: '✅' },
    { valor: 'en_camino',  label: 'En camino',  emoji: '🚚' },
    { valor: 'entregado',  label: 'Entregado',  emoji: '📦' },
    { valor: 'cancelado',  label: 'Cancelado',  emoji: '✖️' },
  ];

  protected readonly pedidosFiltrados = computed(() => {
    let lista = this.pedidos();
    const est = this.filtroEstado();
    const suc = this.filtroSucursal();
    const bus = this.busqueda().toLowerCase().trim();
    if (est !== 'todos') lista = lista.filter(p => p.estado === est);
    if (suc === 'sin_asignar') lista = lista.filter(p => p.sucursal_id === null);
    else if (suc !== 'todas') lista = lista.filter(p => p.sucursal_id === suc);
    if (bus) lista = lista.filter(p =>
      p.nombre_cliente.toLowerCase().includes(bus) ||
      (p.numero_pedido ?? '').toLowerCase().includes(bus) ||
      (p.telefono_cliente ?? '').includes(bus)
    );
    return lista;
  });

  protected readonly conteoEstados = computed(() => {
    const lista = this.pedidos();
    return {
      pendiente:  lista.filter(p => p.estado === 'pendiente').length,
      confirmado: lista.filter(p => p.estado === 'confirmado').length,
      en_camino:  lista.filter(p => p.estado === 'en_camino').length,
      entregado:  lista.filter(p => p.estado === 'entregado').length,
      cancelado:  lista.filter(p => p.estado === 'cancelado').length,
    };
  });

  ngOnInit(): void {
    this.cargar();
    this.sucursalesService.obtenerTodasAdmin().subscribe({ next: data => this.sucursales.set(data) });

    const sucursalParam = this.route.snapshot.queryParamMap.get('sucursal');
    if (sucursalParam === 'sin_asignar') this.filtroSucursal.set('sin_asignar');
    else if (sucursalParam) this.filtroSucursal.set(Number(sucursalParam));
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.http.get<Pedido[]>(`${API_URL}/pedidos`).subscribe({
      next: data => { this.pedidos.set(data); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.errorMsg.set('Error al cargar pedidos'); }
    });
  }

  protected verDetalle(pedido: Pedido): void {
    this.cargandoDet.set(true);
    this.detalle.set(pedido);
    this.notasInt.set(pedido.notas_internas ?? '');
    this.sucursalSel.set(pedido.sucursal_id);
    this.http.get<Pedido>(`${API_URL}/pedidos/${pedido.id}`).subscribe({
      next: full => {
        this.detalle.set(full);
        this.notasInt.set(full.notas_internas ?? '');
        this.sucursalSel.set(full.sucursal_id);
        this.cargandoDet.set(false);
      },
      error: () => this.cargandoDet.set(false)
    });
  }

  protected cerrarDetalle(): void {
    if (!this.guardandoEst() && !this.guardandoNot() && !this.guardandoSuc()) this.detalle.set(null);
  }

  protected cambiarEstado(estado: string): void {
    const p = this.detalle();
    if (!p || this.guardandoEst()) return;
    this.guardandoEst.set(true);
    this.http.put<Pedido>(`${API_URL}/pedidos/${p.id}/estado`, { estado }).subscribe({
      next: updated => {
        this.guardandoEst.set(false);
        this.detalle.set({ ...updated, items: p.items });
        this.pedidos.update(lista => lista.map(x => x.id === updated.id ? { ...updated, total_items: x.total_items } : x));
      },
      error: err => { this.guardandoEst.set(false); this.errorMsg.set(err?.error?.error || 'Error al cambiar estado'); }
    });
  }

  protected guardarNotas(): void {
    const p = this.detalle();
    if (!p) return;
    this.guardandoNot.set(true);
    this.http.put<Pedido>(`${API_URL}/pedidos/${p.id}`, { notas_internas: this.notasInt() }).subscribe({
      next: () => this.guardandoNot.set(false),
      error: () => this.guardandoNot.set(false)
    });
  }

  protected guardarSucursal(): void {
    const p = this.detalle();
    if (!p || this.guardandoSuc()) return;
    this.guardandoSuc.set(true);
    this.http.put<Pedido>(`${API_URL}/pedidos/${p.id}/sucursal`, { sucursal_id: this.sucursalSel() }).subscribe({
      next: updated => {
        this.guardandoSuc.set(false);
        this.detalle.set({ ...p, sucursal_id: updated.sucursal_id, sucursal_nombre: this.nombreSucursal(updated.sucursal_id) });
        this.pedidos.update(lista => lista.map(x =>
          x.id === updated.id ? { ...x, sucursal_id: updated.sucursal_id, sucursal_nombre: this.nombreSucursal(updated.sucursal_id) } : x
        ));
      },
      error: err => { this.guardandoSuc.set(false); this.errorMsg.set(err?.error?.error || 'Error al asignar la sucursal'); }
    });
  }

  private nombreSucursal(id: number | null): string | null {
    return this.sucursales().find(s => s.id === id)?.nombre ?? null;
  }

  protected clp(n: number): string {
    return `$\u00a0${Math.round(n).toLocaleString('es-CL')}`;
  }

  protected fecha(f: string | null, conHora = false): string {
    if (!f) return '—';
    const d = new Date(f);
    if (conHora) return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  protected labelPago(pago: string | null): string {
    const map: Record<string, string> = {
      efectivo: 'Efectivo', transferencia: 'Transferencia',
      webpay: 'Webpay', tarjeta_debito: 'T. Débito', tarjeta_credito: 'T. Crédito'
    };
    return pago ? (map[pago] ?? pago) : '—';
  }

  protected labelCanal(canal: string): string {
    const map: Record<string, string> = {
      portal: 'Portal', presencial: 'Presencial', telefono: 'Teléfono', whatsapp: 'WhatsApp'
    };
    return map[canal] ?? canal;
  }
}

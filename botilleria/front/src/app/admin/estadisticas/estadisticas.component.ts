import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../core/api.config';

interface RankingItem {
  nombre: string;
  unidades: number;
  ingresos: number;
}

interface CategoriaVenta { categoria: string; ingresos: number; unidades: number; }
interface EstadoConteo { estado: string; cantidad: number; }
interface TendenciaDia { fecha: string; ventas: number; pedidos: number; }
interface MedioPagoVenta { medio_pago: string; cantidad: number; ventas: number; }
interface CanalVenta { canal: string; cantidad: number; ventas: number; }

interface EstadisticasResponse {
  resumen: { totalPedidos: number; ventasTotales: number; ticketPromedio: number };
  ventasDelMes: { pedidos: number; ventas: number; variacionPorcentual: number | null };
  productoMasVendido: RankingItem | null;
  topProductos: RankingItem[];
  packMasVendido: RankingItem | null;
  topPacks: RankingItem[];
  ventasPorCategoria: CategoriaVenta[];
  pedidosPorEstado: EstadoConteo[];
  tendenciaVentas: TendenciaDia[];
  ventasPorMedioPago: MedioPagoVenta[];
  ventasPorCanal: CanalVenta[];
}

const COLOR_CATEGORIA: Record<string, string> = {
  'Vinos':       '#2a78d6',
  'Cervezas':    '#1baf7a',
  'Whisky':      '#eda100',
  'Pisco':       '#008300',
  'Ron':         '#4a3aa7',
  'Vodka':       '#e34948',
  'Sin Alcohol': '#e87ba4',
  'Pack':        '#eb6834',
};

const COLOR_ESTADO: Record<string, string> = {
  pendiente:  '#b45309',
  confirmado: '#1d6fa4',
  en_camino:  '#7c3aed',
  entregado:  '#15803d',
  cancelado:  '#dc3545',
};

const LABEL_ESTADO: Record<string, string> = {
  pendiente: 'Pendientes', confirmado: 'Confirmados', en_camino: 'En camino',
  entregado: 'Entregados', cancelado: 'Cancelados',
};

const LABEL_PAGO: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', webpay: 'Webpay',
  tarjeta_debito: 'T. Débito', tarjeta_credito: 'T. Crédito', otro: 'Otro',
};

const LABEL_CANAL: Record<string, string> = {
  portal: 'Portal', presencial: 'Presencial', telefono: 'Teléfono', whatsapp: 'WhatsApp',
};

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [],
  templateUrl: './estadisticas.component.html',
  styleUrl: './estadisticas.component.scss'
})
export class EstadisticasComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly datos = signal<EstadisticasResponse | null>(null);
  protected readonly cargando = signal(true);
  protected readonly errorMsg = signal('');

  protected readonly maxUnidadesProducto = computed(() =>
    Math.max(1, ...(this.datos()?.topProductos.map(p => p.unidades) ?? [1])));
  protected readonly maxUnidadesPack = computed(() =>
    Math.max(1, ...(this.datos()?.topPacks.map(p => p.unidades) ?? [1])));
  protected readonly maxIngresosCategoria = computed(() =>
    Math.max(1, ...(this.datos()?.ventasPorCategoria.map(c => c.ingresos) ?? [1])));
  protected readonly maxVentasTendencia = computed(() =>
    Math.max(1, ...(this.datos()?.tendenciaVentas.map(d => d.ventas) ?? [1])));
  protected readonly maxVentasMedioPago = computed(() =>
    Math.max(1, ...(this.datos()?.ventasPorMedioPago.map(m => m.ventas) ?? [1])));
  protected readonly maxVentasCanal = computed(() =>
    Math.max(1, ...(this.datos()?.ventasPorCanal.map(c => c.ventas) ?? [1])));
  protected readonly totalPedidosEstado = computed(() =>
    Math.max(1, (this.datos()?.pedidosPorEstado ?? []).reduce((acc, e) => acc + e.cantidad, 0)));
  protected readonly pedidosPendientes = computed(() =>
    this.datos()?.pedidosPorEstado.find(e => e.estado === 'pendiente')?.cantidad ?? 0);

  ngOnInit(): void { this.cargar(); }

  protected cargar(): void {
    this.cargando.set(true);
    this.errorMsg.set('');
    this.http.get<EstadisticasResponse>(`${API_URL}/estadisticas`).subscribe({
      next: data => { this.datos.set(data); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.errorMsg.set('Error al cargar las estadísticas'); }
    });
  }

  protected clp(n: number): string {
    return `$ ${Math.round(n).toLocaleString('es-CL')}`;
  }

  protected fechaCorta(iso: string): string {
    const [, mes, dia] = iso.split('-');
    return `${dia}/${mes}`;
  }

  protected colorCategoria(categoria: string): string {
    return COLOR_CATEGORIA[categoria] ?? '#6b6b6b';
  }

  protected colorEstado(estado: string): string {
    return COLOR_ESTADO[estado] ?? '#6b6b6b';
  }

  protected labelEstado(estado: string): string {
    return LABEL_ESTADO[estado] ?? estado;
  }

  protected labelPago(pago: string): string {
    return LABEL_PAGO[pago] ?? pago;
  }

  protected labelCanal(canal: string): string {
    return LABEL_CANAL[canal] ?? canal;
  }

  protected porcentaje(parte: number, total: number): number {
    return total > 0 ? Math.round((parte / total) * 100) : 0;
  }

  protected pct(n: number): number {
    return Math.round(Math.abs(n));
  }
}

import { Component, model, output, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CarritoService } from '../../../services/carrito.service';
import { SucursalesService, Sucursal } from '../../../services/sucursales.service';
import { GOOGLE_MAPS_EMBED_API_KEY } from '../../../../core/api.config';
import { REGIONES_CHILE } from '../../../data/regiones-chile';

export type MetodoEntrega = 'retiro' | 'domicilio';
export type VistaEntrega = 'metodo' | 'retiro' | 'domicilio';
type VistaDomicilio = 'direccion' | 'manual';
export type TipoRetiro = 'programado' | 'express';

@Component({
  selector: 'app-paso-entrega',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './paso-entrega.component.html',
  styleUrls: ['../_rc-comun.scss', './paso-entrega.component.scss']
})
export class PasoEntregaComponent implements OnInit {
  protected readonly carritoService = inject(CarritoService);
  private readonly sucursalesService = inject(SucursalesService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly metodoEntrega = model<MetodoEntrega | null>(null);
  readonly vistaEntrega = model<VistaEntrega>('metodo');
  readonly tipoRetiro = model<TipoRetiro | null>(null);
  readonly sucursalActual = model<Sucursal | null>(null);
  readonly direccionEntrega = model('');
  readonly depto = model('');
  readonly tipoDespacho = model<TipoRetiro | null>(null);
  readonly fechaDespachoId = model<string | null>(null);

  readonly volver = output<void>();
  readonly avanzarAPago = output<void>();

  ngOnInit(): void {
    this.sucursalesService.obtenerTodas().subscribe(data => {
      this.sucursales.set(data);
      if (!this.sucursalActual()) {
        const principal = data.find(s => s.principal) ?? data[0];
        if (principal) this.sucursalActual.set(principal);
      }
    });
  }

  protected readonly intentoEntrega = signal(false);
  protected readonly totalProductosCarrito = computed(() => this.carritoService.items().length);

  // ─── Retiro en tienda ───────────────────────────────────────────────────
  protected readonly intentoRetiro = signal(false);
  protected readonly mostrarConfirmacion = signal(false);
  protected readonly sucursales = signal<Sucursal[]>([]);

  private readonly diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  protected readonly fechaProgramada = computed(() => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const dd = String(manana.getDate()).padStart(2, '0');
    const mm = String(manana.getMonth() + 1).padStart(2, '0');
    const yy = String(manana.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  });

  protected readonly fechaRetiroTexto = computed(() => {
    if (this.tipoRetiro() === 'express') return 'los próximos 30 minutos';
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const dia = this.diasSemana[manana.getDay()];
    const dd = String(manana.getDate()).padStart(2, '0');
    const mm = String(manana.getMonth() + 1).padStart(2, '0');
    return `${dia} ${dd}/${mm}/${manana.getFullYear()}`;
  });

  protected readonly mapaUrl = computed<SafeResourceUrl | null>(() => {
    const sucursal = this.sucursalActual();
    if (!sucursal) return null;
    const q = encodeURIComponent(sucursal.direccion);
    const url = `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_EMBED_API_KEY}&q=${q}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  // ─── Despacho a domicilio ───────────────────────────────────────────────
  protected readonly intentoDomicilio = signal(false);

  private readonly diasAbrev = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

  protected readonly fechasDespachoDisponibles = computed(() => {
    const resultado: { id: string; label: string }[] = [];
    const cursor = new Date();
    cursor.setDate(cursor.getDate() + 1);
    let esPrimera = true;
    while (resultado.length < 6) {
      if (cursor.getDay() !== 0) { // sin despachos los domingos
        const id = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
        const label = esPrimera ? 'Mañana' : `${this.diasAbrev[cursor.getDay()]}. ${cursor.getDate()}`;
        resultado.push({ id, label });
        esPrimera = false;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return resultado;
  });

  protected readonly domicilioValido = computed(() =>
    this.direccionEntrega().trim() !== '' &&
    this.tipoDespacho() !== null &&
    (this.tipoDespacho() === 'express' || this.fechaDespachoId() !== null)
  );

  protected readonly fechaDespachoTexto = computed(() => {
    if (this.tipoDespacho() === 'express') return 'los próximos 30 minutos';
    return 'mañana o elige una fecha';
  });

  // ─── Dirección manual ───────────────────────────────────────────────────
  protected readonly regiones = REGIONES_CHILE;
  protected readonly vistaDomicilio = signal<VistaDomicilio>('direccion');
  protected readonly calleManual = signal('');
  protected readonly numeroManual = signal('');
  protected readonly deptoManual = signal('');
  protected readonly regionManual = signal('');
  protected readonly comunaManual = signal('');
  protected readonly intentoManual = signal(false);
  protected readonly mostrarMapaManual = signal(false);

  protected readonly comunasDisponibles = computed(() =>
    this.regiones.find(r => r.nombre === this.regionManual())?.comunas ?? []
  );

  protected readonly manualValido = computed(() =>
    this.calleManual().trim() !== '' &&
    this.numeroManual().trim() !== '' &&
    this.regionManual() !== '' &&
    this.comunaManual() !== ''
  );

  protected readonly mapaManualUrl = computed<SafeResourceUrl | null>(() => {
    if (!this.manualValido()) return null;
    const direccion = `${this.calleManual()} ${this.numeroManual()}, ${this.comunaManual()}, ${this.regionManual()}, Chile`;
    const q = encodeURIComponent(direccion);
    const url = `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_EMBED_API_KEY}&q=${q}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  protected seleccionarMetodoEntrega(metodo: MetodoEntrega): void {
    this.metodoEntrega.set(metodo);
  }

  protected continuarEntrega(): void {
    this.intentoEntrega.set(true);
    const metodo = this.metodoEntrega();
    if (!metodo) return;
    this.vistaEntrega.set(metodo === 'retiro' ? 'retiro' : 'domicilio');
  }

  protected volverAContacto(): void {
    this.volver.emit();
  }

  protected volverAMetodoEntrega(): void {
    this.vistaEntrega.set('metodo');
    this.intentoRetiro.set(false);
    this.mostrarConfirmacion.set(false);
    this.intentoDomicilio.set(false);
    this.vistaDomicilio.set('direccion');
    this.tipoDespacho.set(null);
    this.fechaDespachoId.set(null);
  }

  protected seleccionarTipoDespacho(tipo: TipoRetiro): void {
    this.tipoDespacho.set(tipo);
    if (tipo === 'express') this.fechaDespachoId.set(null);
  }

  protected seleccionarFechaDespacho(id: string): void {
    this.fechaDespachoId.set(id);
  }

  protected continuarDomicilio(): void {
    this.intentoDomicilio.set(true);
    if (!this.domicilioValido()) return;
    this.avanzarAPago.emit();
  }

  protected abrirDireccionManual(): void {
    this.intentoManual.set(false);
    this.mostrarMapaManual.set(false);
    this.vistaDomicilio.set('manual');
  }

  protected volverDeManual(): void {
    this.vistaDomicilio.set('direccion');
  }

  protected seleccionarRegion(region: string): void {
    this.regionManual.set(region);
    this.comunaManual.set('');
  }

  protected seleccionarComuna(comuna: string): void {
    this.comunaManual.set(comuna);
  }

  protected toggleMapaManual(): void {
    this.mostrarMapaManual.update(v => !v);
  }

  protected continuarManual(): void {
    this.intentoManual.set(true);
    if (!this.manualValido()) return;
    this.direccionEntrega.set(`${this.calleManual()} ${this.numeroManual()}, ${this.comunaManual()}, ${this.regionManual()}`);
    this.depto.set(this.deptoManual());
    this.vistaDomicilio.set('direccion');
  }

  protected seleccionarTipoRetiro(tipo: TipoRetiro): void {
    this.tipoRetiro.set(tipo);
    if (this.sucursalActual()) this.mostrarConfirmacion.set(true);
  }

  protected seleccionarSucursal(s: Sucursal): void {
    this.sucursalActual.set(s);
    if (this.tipoRetiro()) this.mostrarConfirmacion.set(true);
  }

  protected cerrarConfirmacion(): void {
    this.mostrarConfirmacion.set(false);
  }

  protected confirmarTiendaYFecha(): void {
    this.intentoRetiro.set(true);
    if (!this.tipoRetiro()) return;
    this.avanzarAPago.emit();
  }

  reset(): void {
    this.intentoEntrega.set(false);
    this.intentoRetiro.set(false);
    this.mostrarConfirmacion.set(false);
    this.intentoDomicilio.set(false);
    this.vistaDomicilio.set('direccion');
    this.calleManual.set('');
    this.numeroManual.set('');
    this.deptoManual.set('');
    this.regionManual.set('');
    this.comunaManual.set('');
    this.intentoManual.set(false);
    this.mostrarMapaManual.set(false);
  }
}

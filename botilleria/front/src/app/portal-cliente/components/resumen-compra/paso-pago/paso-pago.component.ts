import { Component, input, output, signal, computed, inject } from '@angular/core';
import { PortalConfigService } from '../../../../core/portal-config.service';
import type { Sucursal } from '../../../services/sucursales.service';
import type { MetodoEntrega, TipoRetiro } from '../paso-entrega/paso-entrega.component';

type MetodoPago = 'mercadopago' | 'webpay_plus' | 'webpay_oneclick' | 'mach' | 'bci' | 'venti';

@Component({
  selector: 'app-paso-pago',
  standalone: true,
  imports: [],
  templateUrl: './paso-pago.component.html',
  styleUrls: ['../_rc-comun.scss', './paso-pago.component.scss']
})
export class PasoPagoComponent {
  protected readonly portalConfig = inject(PortalConfigService);

  readonly metodoEntrega = input<MetodoEntrega | null>(null);
  readonly sucursalActual = input<Sucursal | null>(null);
  readonly tipoRetiro = input<TipoRetiro | null>(null);
  readonly direccionEntrega = input('');
  readonly depto = input('');
  readonly tipoDespacho = input<TipoRetiro | null>(null);
  readonly fechaDespachoId = input<string | null>(null);
  readonly quieroFactura = input(false);

  readonly volver = output<void>();

  protected readonly metodosPago: { valor: MetodoPago; nombre: string; sub?: string; color: string; textoColor: string }[] = [
    { valor: 'mercadopago',      nombre: 'Mercado Pago',      color: '#00b1ea', textoColor: '#ffffff' },
    { valor: 'webpay_plus',      nombre: 'Webpay Plus',       sub: 'Transbank', color: '#ffffff', textoColor: '#e30f8a' },
    { valor: 'webpay_oneclick',  nombre: 'Webpay One Click',  sub: 'Transbank', color: '#ffffff', textoColor: '#e30f8a' },
    { valor: 'mach',             nombre: 'MACH',              color: '#ffffff', textoColor: '#5b2fe0' },
    { valor: 'bci',              nombre: 'App Bci',           color: '#ffffff', textoColor: '#e4032e' },
    { valor: 'venti',            nombre: 'Venti',             color: '#ffffff', textoColor: '#00a878' },
  ];

  protected readonly metodoPago = signal<MetodoPago | null>(null);
  protected readonly aceptaTerminos = signal(false);
  protected readonly intentoPago = signal(false);
  protected readonly mostrarProximamente = signal(false);

  protected readonly tipoDocumento = computed(() => this.quieroFactura() ? 'Factura' : 'Boleta');

  protected readonly fechaRetiroCorta = computed(() => {
    if (this.tipoRetiro() === 'express') return 'Hoy (en 30 minutos)';
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const dd = String(manana.getDate()).padStart(2, '0');
    const mm = String(manana.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${manana.getFullYear()}`;
  });

  protected readonly fechaDespachoCorta = computed(() => {
    if (this.tipoDespacho() === 'express') return 'Hoy (en 30 minutos)';
    const id = this.fechaDespachoId();
    if (!id) return '—';
    const [yyyy, mm, dd] = id.split('-');
    return `${dd}/${mm}/${yyyy}`;
  });

  protected volverAEntrega(): void {
    this.mostrarProximamente.set(false);
    this.volver.emit();
  }

  protected seleccionarMetodoPago(metodo: MetodoPago): void {
    this.metodoPago.set(metodo);
  }

  protected toggleTerminos(): void {
    this.aceptaTerminos.update(v => !v);
  }

  protected intentarPagar(): void {
    this.intentoPago.set(true);
    if (!this.metodoPago() || !this.aceptaTerminos()) return;
    this.mostrarProximamente.set(true);
  }

  reset(): void {
    this.metodoPago.set(null);
    this.aceptaTerminos.set(false);
    this.intentoPago.set(false);
    this.mostrarProximamente.set(false);
  }
}

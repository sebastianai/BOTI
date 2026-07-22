import { Component, input, output, inject, signal, computed, viewChild } from '@angular/core';
import { CarritoService } from '../../services/carrito.service';
import { ItemCarrito, Producto } from '../../models/producto.model';
import { urlImagenProducto } from '../../../core/imagen.util';
import { ProductosService } from '../../services/productos.service';
import type { Sucursal } from '../../services/sucursales.service';
import { PasoContactoComponent } from './paso-contacto/paso-contacto.component';
import { PasoEntregaComponent, MetodoEntrega, VistaEntrega, TipoRetiro } from './paso-entrega/paso-entrega.component';
import { PasoPagoComponent } from './paso-pago/paso-pago.component';

type PasoCheckout = 'contacto' | 'entrega' | 'pago';

@Component({
  selector: 'app-resumen-compra',
  standalone: true,
  imports: [PasoContactoComponent, PasoEntregaComponent, PasoPagoComponent],
  templateUrl: './resumen-compra.component.html',
  styleUrl: './resumen-compra.component.scss'
})
export class ResumenCompraComponent {
  readonly abierto = input(false);
  readonly cerrar = output<void>();

  protected readonly carritoService = inject(CarritoService);
  private readonly productosService = inject(ProductosService);

  private readonly pasoContactoRef = viewChild(PasoContactoComponent);
  private readonly pasoEntregaRef = viewChild(PasoEntregaComponent);
  private readonly pasoPagoRef = viewChild(PasoPagoComponent);

  protected readonly pasoActual = signal<PasoCheckout>('contacto');

  // ─── Estado compartido entre pasos (elevado porque el sidebar y/o Pago lo necesitan) ───
  protected readonly quieroFactura = signal(false);
  protected readonly metodoEntrega = signal<MetodoEntrega | null>(null);
  protected readonly vistaEntrega = signal<VistaEntrega>('metodo');
  protected readonly tipoRetiro = signal<TipoRetiro | null>(null);
  protected readonly sucursalActual = signal<Sucursal | null>(null);
  protected readonly direccionEntrega = signal('');
  protected readonly depto = signal('');
  protected readonly tipoDespacho = signal<TipoRetiro | null>(null);
  protected readonly fechaDespachoId = signal<string | null>(null);

  protected readonly COSTO_ENVIO_DOMICILIO = 3990;

  // El costo de envío solo se confirma una vez que el método de entrega quedó
  // elegido (no mientras se está eligiendo/reconsiderando en la vista 'metodo').
  protected readonly envioConfirmado = computed(() =>
    this.pasoActual() !== 'entrega' || this.vistaEntrega() !== 'metodo'
  );

  protected readonly costoEnvio = computed(() =>
    this.envioConfirmado() && this.metodoEntrega() === 'domicilio' ? this.COSTO_ENVIO_DOMICILIO : 0
  );

  protected readonly pasos: { valor: PasoCheckout; label: string; icono: string }[] = [
    { valor: 'contacto', label: 'Contacto', icono: '👤' },
    { valor: 'entrega', label: 'Entrega', icono: '🚚' },
    { valor: 'pago', label: 'Pago', icono: '💳' },
  ];

  protected readonly mostrarSugeridos = signal(false);
  protected readonly cargandoSugeridos = signal(false);
  protected readonly productosSugeridos = signal<Producto[]>([]);

  protected cerrarModal(): void {
    this.pasoActual.set('contacto');
    this.metodoEntrega.set(null);
    this.vistaEntrega.set('metodo');
    this.tipoRetiro.set(null);
    this.direccionEntrega.set('');
    this.depto.set('');
    this.tipoDespacho.set(null);
    this.fechaDespachoId.set(null);
    this.mostrarSugeridos.set(false);
    this.pasoContactoRef()?.reset();
    this.pasoEntregaRef()?.reset();
    this.pasoPagoRef()?.reset();
    this.cerrar.emit();
  }

  protected toggleSugeridos(): void {
    this.mostrarSugeridos.update(v => !v);
    if (this.mostrarSugeridos() && this.productosSugeridos().length === 0) {
      this.cargandoSugeridos.set(true);
      this.productosService.obtenerProductos('Todos', '', true).subscribe({
        next: data => {
          const idsEnCarrito = new Set(this.carritoService.items().map(i => i.producto.id));
          this.productosSugeridos.set(data.filter(p => !idsEnCarrito.has(p.id)).slice(0, 6));
          this.cargandoSugeridos.set(false);
        },
        error: () => this.cargandoSugeridos.set(false)
      });
    }
  }

  protected agregarSugerido(producto: Producto): void {
    this.carritoService.agregar(producto);
    this.productosSugeridos.update(list => list.filter(p => p.id !== producto.id));
  }

  protected cambiarCantidad(item: ItemCarrito, delta: number): void {
    this.carritoService.actualizarCantidad(item.producto.id, item.cantidad + delta);
  }

  protected remover(id: number): void {
    this.carritoService.remover(id);
  }

  protected calcularSubtotal(item: ItemCarrito): number {
    const { producto, cantidad } = item;
    const precio = producto.precio;
    if (producto.promocion === '2x1') return Math.ceil(cantidad / 2) * precio;
    if (producto.promocion === '3x2') return Math.ceil((cantidad * 2) / 3) * precio;
    return cantidad * precio;
  }

  protected formatearPrecio(precio: number): string {
    return '$' + precio.toLocaleString('es-CL');
  }

  protected urlImagenProducto(rutaImagen: string | undefined): string {
    return urlImagenProducto(rutaImagen);
  }
}

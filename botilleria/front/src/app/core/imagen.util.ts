import { ASSET_BASE_URL } from './api.config';

const IMAGEN_PRODUCTO_VACIO = 'assets/img/vacio_producto.png';

export function urlImagenProducto(rutaImagen: string | undefined | null): string {
  return rutaImagen ? `${ASSET_BASE_URL}${rutaImagen}` : IMAGEN_PRODUCTO_VACIO;
}

import { ASSET_BASE_URL } from './api.config';

export function urlImagenProducto(rutaImagen: string | undefined): string {
  return rutaImagen ? `${ASSET_BASE_URL}${rutaImagen}` : '';
}

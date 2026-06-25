import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'productos');

function asegurarCarpetaUploads(): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function guardarImagen(idProducto: number, buffer: Buffer, extension: string): string {
  asegurarCarpetaUploads();
  const nombreArchivo = `${idProducto}-${Date.now()}.${extension}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, nombreArchivo), buffer);
  return `/uploads/productos/${nombreArchivo}`;
}

export function eliminarImagenSiExiste(urlImagen: string | null | undefined): void {
  if (!urlImagen) return;
  const rutaCompleta = path.join(UPLOADS_DIR, path.basename(urlImagen));
  if (fs.existsSync(rutaCompleta)) {
    fs.unlinkSync(rutaCompleta);
  }
}

export function leerImagenDesdeUrl(urlImagen: string): Buffer | null {
  const rutaCompleta = path.join(UPLOADS_DIR, path.basename(urlImagen));
  return fs.existsSync(rutaCompleta) ? fs.readFileSync(rutaCompleta) : null;
}

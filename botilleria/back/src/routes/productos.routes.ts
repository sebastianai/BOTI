import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { pool } from '../db';
import { guardarImagen, eliminarImagenSiExiste, leerImagenDesdeUrl } from '../utils/imagenes';
import { authMiddleware } from '../middleware/auth.middleware';

export const productosRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

const COLUMNAS_EXCEL: Partial<ExcelJS.Column>[] = [
  { header: 'ID', key: 'id', width: 8 },
  { header: 'Nombre', key: 'nombre', width: 32 },
  { header: 'Marca', key: 'marca', width: 26 },
  { header: 'Categoria', key: 'categoria', width: 14 },
  { header: 'Precio', key: 'precio', width: 12 },
  { header: 'PrecioOferta', key: 'precioOriginal', width: 14 },
  { header: 'Grados', key: 'grados', width: 10 },
  { header: 'Volumen', key: 'volumen', width: 12 },
  { header: 'Stock', key: 'stock', width: 10 },
  { header: 'Imagen', key: 'imagen', width: 14 },
  { header: 'Emoji', key: 'emoji', width: 8 },
  { header: 'ColorFondo', key: 'colorFondo', width: 48 },
  { header: 'Descripcion', key: 'descripcion', width: 55 },
  { header: 'TopVentas', key: 'topVentas', width: 10 }
];

const COL_IMAGEN_INDEX = COLUMNAS_EXCEL.findIndex(c => c.key === 'imagen');

function mapProducto(row: any) {
  return {
    id: row.id,
    nombre: row.nombre,
    marca: row.marca,
    precio: row.precio,
    precioOriginal: row.precio_original ?? undefined,
    categoria: row.categoria,
    descripcion: row.descripcion,
    grados: parseFloat(row.grados),
    volumen: row.volumen,
    emoji: row.emoji,
    colorFondo: row.color_fondo,
    stock: row.stock,
    imagen: row.imagen ?? undefined,
    topVentas: row.top_ventas ?? false,
    promocion: row.promocion ?? null,
  };
}

productosRouter.get('/', async (req, res) => {
  const { categoria, busqueda, top_ventas } = req.query;
  const params: unknown[] = [];
  let query = 'SELECT * FROM productos WHERE 1=1';

  if (categoria && categoria !== 'Todos') {
    params.push(categoria);
    query += ` AND categoria = $${params.length}`;
  }
  if (busqueda) {
    params.push(`%${busqueda}%`);
    query += ` AND (nombre ILIKE $${params.length} OR marca ILIKE $${params.length} OR descripcion ILIKE $${params.length})`;
  }
  if (top_ventas === 'true') {
    query += ` AND top_ventas = true`;
  }
  query += ' ORDER BY id';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows.map(mapProducto));
  } catch (err) {
    console.error('Error al obtener productos:', err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

productosRouter.get('/exportar/excel', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos ORDER BY id');
    const productos = result.rows.map(mapProducto);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Productos');
    sheet.columns = COLUMNAS_EXCEL;
    sheet.getRow(1).font = { bold: true };

    productos.forEach((p, index) => {
      const rowNumber = index + 2; // la fila 1 es el encabezado

      sheet.addRow({
        id: p.id,
        nombre: p.nombre,
        marca: p.marca,
        categoria: p.categoria,
        precio: p.precio,
        precioOriginal: p.precioOriginal ?? '',
        grados: p.grados,
        volumen: p.volumen,
        stock: p.stock,
        imagen: '',
        emoji: p.emoji,
        colorFondo: p.colorFondo,
        descripcion: p.descripcion,
        topVentas: p.topVentas ? 'SI' : 'NO'
      });

      if (p.imagen) {
        const buffer = leerImagenDesdeUrl(p.imagen);
        if (buffer) {
          sheet.getRow(rowNumber).height = 50;
          const extension = path.extname(p.imagen).replace('.', '').toLowerCase();
          const extensionValida = extension === 'png' || extension === 'gif' ? extension : 'jpeg';
          const imageId = workbook.addImage({ buffer: buffer as any, extension: extensionValida });
          sheet.addImage(imageId, {
            tl: { col: COL_IMAGEN_INDEX, row: rowNumber - 1 },
            ext: { width: 60, height: 60 }
          });
        }
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="productos-botilleria.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error al exportar productos:', err);
    res.status(500).json({ error: 'Error al exportar productos' });
  }
});

const ETIQUETAS_CAMPO: Record<string, string> = {
  nombre: 'Nombre',
  marca: 'Marca',
  categoria: 'Categoría',
  precio: 'Precio',
  precioOriginal: 'Precio oferta',
  grados: 'Grados',
  volumen: 'Volumen',
  stock: 'Stock',
  imagen: 'Imagen',
  topVentas: 'Top Ventas',
  emoji: 'Emoji',
  colorFondo: 'Color de fondo',
  descripcion: 'Descripción'
};

function esVacio(valor: any): boolean {
  return valor === undefined || valor === null || String(valor).trim() === '';
}

/** Devuelve el número si `valor` es estrictamente numérico, o `undefined` si no lo es. No usar para distinguir "vacío". */
function aNumeroEstricto(valor: any): number | undefined {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : undefined;
  }
  if (typeof valor === 'string' && /^-?\d+(\.\d+)?$/.test(valor.trim())) {
    return parseFloat(valor.trim());
  }
  return undefined;
}

const VALOR_DEFECTO = {
  precioOriginal: null as number | null,
  grados: 0,
  volumen: 'N/A',
  emoji: '📦',
  colorFondo: 'linear-gradient(135deg, #44403c 0%, #1c1917 100%)',
  descripcion: 'Sin descripción'
};

productosRouter.post('/importar/excel', authMiddleware, upload.single('archivo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer as any);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      return res.status(400).json({ error: 'El archivo no contiene hojas' });
    }

    // Imágenes incrustadas en el Excel, indexadas por fila nativa (0-based)
    const imagenPorFilaNativa = new Map<number, { buffer: any; extension: string }>();
    for (const img of sheet.getImages()) {
      const imagen = workbook.getImage(Number(img.imageId));
      if (imagen && imagen.buffer) {
        imagenPorFilaNativa.set(img.range.tl.nativeRow, {
          buffer: imagen.buffer,
          extension: imagen.extension
        });
      }
    }

    const headerMap: Record<string, number> = {};
    sheet.getRow(1).eachCell((cell, colNumber) => {
      const header = String(cell.value ?? '').trim();
      if (header) headerMap[header] = colNumber;
    });

    const obtenerValor = (row: ExcelJS.Row, header: string): any => {
      const col = headerMap[header];
      if (!col) return undefined;
      const valor = row.getCell(col).value;
      return valor === null ? undefined : valor;
    };

    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;
    let pendientes = 0;
    let huboCreacionManual = false;
    const errores: { fila: number; mensaje: string }[] = [];
    const detalle: {
      fila: number;
      id: number;
      nombre: string;
      accion: 'creado' | 'actualizado' | 'pendiente';
      cambios: { campo: string; anterior: unknown; nuevo: unknown }[];
      alertaPrecio?: { precioAnterior: number; precioNuevo: number; porcentaje: number };
      payloadPendiente?: Record<string, unknown>;
    }[] = [];

    const UMBRAL_CAIDA_PRECIO = 0.5;

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const fila = {
        id: obtenerValor(row, 'ID'),
        nombre: obtenerValor(row, 'Nombre'),
        marca: obtenerValor(row, 'Marca'),
        categoria: obtenerValor(row, 'Categoria'),
        precio: obtenerValor(row, 'Precio'),
        precioOriginal: obtenerValor(row, 'PrecioOferta'),
        grados: obtenerValor(row, 'Grados'),
        volumen: obtenerValor(row, 'Volumen'),
        stock: obtenerValor(row, 'Stock'),
        emoji: obtenerValor(row, 'Emoji'),
        colorFondo: obtenerValor(row, 'ColorFondo'),
        descripcion: obtenerValor(row, 'Descripcion'),
        topVentas: obtenerValor(row, 'TopVentas')
      };

      const filaVacia = Object.values(fila).every(esVacio);
      if (filaVacia) continue;

      const erroresFila: string[] = [];

      // Obligatorios siempre (crear o actualizar): ID, Nombre, Marca, Categoria, Precio, Stock
      let idNumero: number | undefined;
      if (esVacio(fila.id)) {
        erroresFila.push('La columna ID es obligatoria');
      } else {
        idNumero = aNumeroEstricto(fila.id);
        if (idNumero === undefined || !Number.isInteger(idNumero) || idNumero <= 0) {
          erroresFila.push('La columna ID solo acepta números enteros positivos');
        }
      }

      if (esVacio(fila.nombre)) erroresFila.push('El nombre es obligatorio');
      if (esVacio(fila.marca)) erroresFila.push('La marca es obligatoria');
      if (esVacio(fila.categoria)) erroresFila.push('La categoría es obligatoria');

      let precioNumero: number | undefined;
      if (esVacio(fila.precio)) {
        erroresFila.push('El precio es obligatorio');
      } else {
        precioNumero = aNumeroEstricto(fila.precio);
        if (precioNumero === undefined || precioNumero < 0) {
          erroresFila.push('La columna Precio solo acepta números (no texto) y no puede ser negativo');
        }
      }

      let stockNumero: number | undefined;
      if (esVacio(fila.stock)) {
        erroresFila.push('El stock es obligatorio');
      } else {
        stockNumero = aNumeroEstricto(fila.stock);
        if (stockNumero === undefined || stockNumero < 0 || !Number.isInteger(stockNumero)) {
          erroresFila.push('La columna Stock solo acepta números enteros y no puede ser negativo');
        }
      }

      // Opcionales (PrecioOferta, Grados, Volumen, Emoji, ColorFondo, Descripcion):
      // si no vienen no bloquean la fila. Al actualizar se conserva el valor existente;
      // al crear se aplica un valor por defecto.
      const precioOfertaProvisto = !esVacio(fila.precioOriginal);
      let precioOfertaNumero: number | undefined;
      if (precioOfertaProvisto) {
        precioOfertaNumero = aNumeroEstricto(fila.precioOriginal);
        if (precioOfertaNumero === undefined || precioOfertaNumero < 0) {
          erroresFila.push('La columna PrecioOferta solo acepta números (no texto)');
        }
      }

      const gradosProvisto = !esVacio(fila.grados);
      let gradosNumero: number | undefined;
      if (gradosProvisto) {
        gradosNumero = aNumeroEstricto(fila.grados);
        if (gradosNumero === undefined || gradosNumero < 0) {
          erroresFila.push('La columna Grados solo acepta números (no texto)');
        }
      }

      if (erroresFila.length > 0) {
        errores.push({ fila: rowNumber, mensaje: erroresFila.join('; ') });
        continue;
      }

      const idDefinitivo = idNumero as number;
      const actual = await pool.query('SELECT * FROM productos WHERE id = $1', [idDefinitivo]);
      const existente = actual.rows.length > 0 ? (mapProducto(actual.rows[0]) as Record<string, unknown>) : null;

      const volumenProvisto = !esVacio(fila.volumen);
      const emojiProvisto = !esVacio(fila.emoji);
      const colorFondoProvisto = !esVacio(fila.colorFondo);
      const descripcionProvista = !esVacio(fila.descripcion);

      // Si la fila trae una imagen incrustada en Excel, se guarda en disco ahora mismo.
      // El archivo anterior (si existía) no se borra aquí: solo se reemplaza la referencia
      // en la base de datos cuando la fila se persiste de verdad (evita enlaces rotos si
      // el cambio queda "pendiente" de confirmación por una baja de precio).
      const imagenFila = imagenPorFilaNativa.get(rowNumber - 1);
      const imagenResuelta = imagenFila
        ? guardarImagen(idDefinitivo, imagenFila.buffer, imagenFila.extension)
        : existente
          ? (existente['imagen'] as string | undefined)
          : undefined;

      const nuevoProducto = {
        nombre: String(fila.nombre).trim(),
        marca: String(fila.marca).trim(),
        categoria: String(fila.categoria).trim(),
        precio: precioNumero as number,
        precioOriginal: precioOfertaProvisto
          ? (precioOfertaNumero ?? null)
          : existente
            ? ((existente['precioOriginal'] as number | undefined) ?? null)
            : VALOR_DEFECTO.precioOriginal,
        grados: gradosProvisto
          ? (gradosNumero as number)
          : existente
            ? Number(existente['grados'])
            : VALOR_DEFECTO.grados,
        volumen: volumenProvisto ? String(fila.volumen).trim() : existente ? String(existente['volumen']) : VALOR_DEFECTO.volumen,
        stock: stockNumero as number,
        imagen: imagenResuelta,
        emoji: emojiProvisto ? String(fila.emoji).trim() : existente ? String(existente['emoji']) : VALOR_DEFECTO.emoji,
        colorFondo: colorFondoProvisto
          ? String(fila.colorFondo).trim()
          : existente
            ? String(existente['colorFondo'])
            : VALOR_DEFECTO.colorFondo,
        descripcion: descripcionProvista
          ? String(fila.descripcion).trim()
          : existente
            ? String(existente['descripcion'])
            : VALOR_DEFECTO.descripcion,
        topVentas: !esVacio(fila.topVentas)
          ? String(fila.topVentas).trim().toUpperCase() === 'SI'
          : existente
            ? Boolean(existente['topVentas'])
            : false
      };

      try {
        if (existente) {
          const cambios: { campo: string; anterior: unknown; nuevo: unknown }[] = [];
          for (const campo of Object.keys(ETIQUETAS_CAMPO)) {
            const valorAnterior = existente[campo] ?? null;
            const valorNuevo = (nuevoProducto as Record<string, unknown>)[campo] ?? null;
            if (String(valorAnterior) !== String(valorNuevo)) {
              cambios.push({ campo: ETIQUETAS_CAMPO[campo], anterior: valorAnterior, nuevo: valorNuevo });
            }
          }

          if (cambios.length === 0) {
            sinCambios++;
            detalle.push({ fila: rowNumber, id: idDefinitivo, nombre: nuevoProducto.nombre, accion: 'actualizado', cambios });
          } else {
            const precioAnteriorNum = Number(existente['precio']);
            let caidaPorcentual = 0;
            if (precioAnteriorNum > 0 && nuevoProducto.precio < precioAnteriorNum) {
              caidaPorcentual = (precioAnteriorNum - nuevoProducto.precio) / precioAnteriorNum;
            }

            if (caidaPorcentual >= UMBRAL_CAIDA_PRECIO) {
              pendientes++;
              detalle.push({
                fila: rowNumber,
                id: idDefinitivo,
                nombre: nuevoProducto.nombre,
                accion: 'pendiente',
                cambios,
                alertaPrecio: {
                  precioAnterior: precioAnteriorNum,
                  precioNuevo: nuevoProducto.precio,
                  porcentaje: Math.round(caidaPorcentual * 100)
                },
                payloadPendiente: nuevoProducto
              });
            } else {
              await pool.query(
                `UPDATE productos SET nombre=$1, marca=$2, precio=$3, precio_original=$4, categoria=$5, descripcion=$6, grados=$7, volumen=$8, emoji=$9, color_fondo=$10, stock=$11, imagen=$12, top_ventas=$13
                 WHERE id=$14`,
                [nuevoProducto.nombre, nuevoProducto.marca, nuevoProducto.precio, nuevoProducto.precioOriginal, nuevoProducto.categoria,
                 nuevoProducto.descripcion, nuevoProducto.grados, nuevoProducto.volumen, nuevoProducto.emoji, nuevoProducto.colorFondo,
                 nuevoProducto.stock, nuevoProducto.imagen ?? null, nuevoProducto.topVentas, idDefinitivo]
              );
              actualizados++;
              detalle.push({ fila: rowNumber, id: idDefinitivo, nombre: nuevoProducto.nombre, accion: 'actualizado', cambios });
            }
          }
        } else {
          await pool.query(
            `INSERT INTO productos (id, nombre, marca, precio, precio_original, categoria, descripcion, grados, volumen, emoji, color_fondo, stock, imagen, top_ventas)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [idDefinitivo, nuevoProducto.nombre, nuevoProducto.marca, nuevoProducto.precio, nuevoProducto.precioOriginal,
             nuevoProducto.categoria, nuevoProducto.descripcion, nuevoProducto.grados, nuevoProducto.volumen,
             nuevoProducto.emoji, nuevoProducto.colorFondo, nuevoProducto.stock, nuevoProducto.imagen ?? null, nuevoProducto.topVentas]
          );
          creados++;
          huboCreacionManual = true;
          detalle.push({ fila: rowNumber, id: idDefinitivo, nombre: nuevoProducto.nombre, accion: 'creado', cambios: [] });
        }
      } catch (err: any) {
        const mensaje = String(err.message || '').includes('foreign key')
          ? `La categoría "${nuevoProducto.categoria}" no existe`
          : 'Error al guardar la fila en la base de datos';
        errores.push({ fila: rowNumber, mensaje });
      }
    }

    if (huboCreacionManual) {
      // Mantiene la secuencia de auto-incremento sincronizada tras insertar IDs manuales
      await pool.query(`SELECT setval(pg_get_serial_sequence('productos', 'id'), (SELECT MAX(id) FROM productos))`);
    }

    res.json({ creados, actualizados, sinCambios, pendientes, errores, detalle });
  } catch (err) {
    console.error('Error al importar productos:', err);
    res.status(500).json({ error: 'Error al procesar el archivo Excel' });
  }
});

productosRouter.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(mapProducto(result.rows[0]));
  } catch (err) {
    console.error('Error al obtener producto:', err);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

function validarPayload(body: any): string | null {
  const { nombre, marca, precio, precioOriginal, categoria, descripcion, grados, volumen, emoji, colorFondo, stock } = body;

  if (!nombre || !marca || precio == null || !categoria || !descripcion || grados == null || !volumen || !emoji || !colorFondo) {
    return 'Faltan campos obligatorios';
  }
  if (typeof precio !== 'number' || !Number.isFinite(precio) || precio < 0) {
    return 'El precio debe ser un número válido mayor o igual a 0';
  }
  if (precioOriginal != null && (typeof precioOriginal !== 'number' || !Number.isFinite(precioOriginal) || precioOriginal < 0)) {
    return 'El precio de oferta debe ser un número válido';
  }
  if (typeof grados !== 'number' || !Number.isFinite(grados) || grados < 0) {
    return 'Los grados de alcohol deben ser un número válido mayor o igual a 0';
  }
  if (stock != null && (typeof stock !== 'number' || !Number.isFinite(stock) || stock < 0)) {
    return 'El stock debe ser un número válido mayor o igual a 0';
  }
  return null;
}

productosRouter.post('/', authMiddleware, async (req, res) => {
  const errorValidacion = validarPayload(req.body);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  const { nombre, marca, precio, precioOriginal, categoria, descripcion, grados, volumen, emoji, colorFondo, stock, topVentas, promocion } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO productos (nombre, marca, precio, precio_original, categoria, descripcion, grados, volumen, emoji, color_fondo, stock, top_ventas, promocion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [nombre, marca, precio, precioOriginal ?? null, categoria, descripcion, grados, volumen, emoji, colorFondo, stock ?? 0, topVentas ?? false, promocion ?? null]
    );
    res.status(201).json(mapProducto(result.rows[0]));
  } catch (err) {
    console.error('Error al crear producto:', err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

productosRouter.put('/:id', authMiddleware, async (req, res) => {
  const errorValidacion = validarPayload(req.body);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  const { nombre, marca, precio, precioOriginal, categoria, descripcion, grados, volumen, emoji, colorFondo, stock, imagen, topVentas, promocion } = req.body;

  try {
    const result = await pool.query(
      `UPDATE productos SET nombre=$1, marca=$2, precio=$3, precio_original=$4, categoria=$5, descripcion=$6, grados=$7, volumen=$8, emoji=$9, color_fondo=$10, stock=$11, imagen=COALESCE($12, imagen), top_ventas=$13, promocion=$14
       WHERE id=$15 RETURNING *`,
      [nombre, marca, precio, precioOriginal ?? null, categoria, descripcion, grados, volumen, emoji, colorFondo, stock ?? 0, imagen ?? null, topVentas ?? false, promocion ?? null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(mapProducto(result.rows[0]));
  } catch (err) {
    console.error('Error al actualizar producto:', err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

productosRouter.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING id, imagen', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    eliminarImagenSiExiste(result.rows[0].imagen);
    res.status(204).send();
  } catch (err) {
    console.error('Error al eliminar producto:', err);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

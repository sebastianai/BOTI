import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db';
import { authMiddleware } from '../middleware/auth.middleware';

export const packsRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });
const IMG_DIR = path.join(__dirname, '..', '..', 'uploads', 'packs');

function imgUrl(filename: string | null): string | null {
  return filename ? `/uploads/packs/${filename}` : null;
}

const PROD_OBJ = `json_build_object(
  'id',             prod.id,
  'nombre',         prod.nombre,
  'marca',          prod.marca,
  'precio',         prod.precio,
  'precioOriginal', prod.precio_original,
  'categoria',      prod.categoria,
  'descripcion',    prod.descripcion,
  'grados',         prod.grados,
  'volumen',        prod.volumen,
  'emoji',          prod.emoji,
  'colorFondo',     prod.color_fondo,
  'stock',          prod.stock,
  'imagen',         prod.imagen,
  'topVentas',      prod.top_ventas,
  'promocion',      prod.promocion,
  'cantidad',       pp.cantidad
)`;

const WITH_FULL_PRODUCTOS = `
  SELECT pk.*,
    COALESCE(
      json_agg(${PROD_OBJ} ORDER BY prod.nombre) FILTER (WHERE prod.id IS NOT NULL),
      '[]'
    ) AS productos
  FROM packs pk
  LEFT JOIN pack_productos pp ON pp.pack_id = pk.id
  LEFT JOIN productos prod ON prod.id = pp.producto_id
`;

const WITH_IDS = `
  SELECT pk.*,
    COALESCE(
      json_agg(
        json_build_object('producto_id', pp.producto_id, 'cantidad', pp.cantidad)
        ORDER BY pp.producto_id
      ) FILTER (WHERE pp.producto_id IS NOT NULL),
      '[]'
    ) AS producto_ids
  FROM packs pk
  LEFT JOIN pack_productos pp ON pp.pack_id = pk.id
`;

/* ── Portal: packs activos con productos completos ── */
packsRouter.get('/', async (_req, res) => {
  try {
    const result = await pool.query(
      `${WITH_FULL_PRODUCTOS}
       WHERE pk.activo = true
       GROUP BY pk.id
       HAVING COUNT(prod.id) > 0
       ORDER BY pk.orden ASC, pk.id ASC`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener packs' });
  }
});

/* ── Admin: todos los packs con IDs de productos ── */
packsRouter.get('/todos', authMiddleware, async (_req, res) => {
  try {
    const result = await pool.query(
      `${WITH_IDS} GROUP BY pk.id ORDER BY pk.orden ASC, pk.id ASC`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener packs' });
  }
});

/* ── Portal: un pack por ID con productos completos ── */
packsRouter.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `${WITH_FULL_PRODUCTOS} WHERE pk.id = $1 GROUP BY pk.id`,
      [req.params.id]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'No encontrado' }); return; }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al obtener pack' });
  }
});

/* ── Crear pack ── */
packsRouter.post('/', authMiddleware, async (req, res) => {
  const { nombre, descripcion, activo, orden, producto_ids, precio } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO packs (nombre, descripcion, activo, orden, precio)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, descripcion ?? null, activo ?? true, orden ?? 0, precio ?? 0]
    );
    const pack = result.rows[0];
    const ids: Array<{ producto_id: number; cantidad: number }> = Array.isArray(producto_ids) ? producto_ids : [];
    for (const item of ids) {
      await pool.query(
        `INSERT INTO pack_productos (pack_id, producto_id, cantidad) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [pack.id, item.producto_id, item.cantidad ?? 1]
      );
    }
    pack.producto_ids = ids;
    res.status(201).json(pack);
  } catch {
    res.status(500).json({ error: 'Error al crear pack' });
  }
});

/* ── Actualizar pack ── */
packsRouter.put('/:id', authMiddleware, async (req, res) => {
  const { nombre, descripcion, activo, orden, producto_ids, precio } = req.body;
  try {
    const result = await pool.query(
      `UPDATE packs SET
        nombre      = COALESCE($1, nombre),
        descripcion = $2,
        activo      = COALESCE($3, activo),
        orden       = COALESCE($4, orden),
        precio      = COALESCE($5, precio)
       WHERE id = $6 RETURNING *`,
      [nombre ?? null, descripcion ?? null, activo ?? null, orden ?? null, precio ?? null, req.params.id]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'No encontrado' }); return; }
    if (Array.isArray(producto_ids)) {
      await pool.query(`DELETE FROM pack_productos WHERE pack_id = $1`, [req.params.id]);
      for (const item of producto_ids) {
        await pool.query(
          `INSERT INTO pack_productos (pack_id, producto_id, cantidad) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [req.params.id, item.producto_id, item.cantidad ?? 1]
        );
      }
    }
    const updated = await pool.query(
      `SELECT pk.*,
        COALESCE(json_agg(json_build_object('producto_id', pp.producto_id, 'cantidad', pp.cantidad) ORDER BY pp.producto_id) FILTER (WHERE pp.producto_id IS NOT NULL), '[]') AS producto_ids
       FROM packs pk LEFT JOIN pack_productos pp ON pp.pack_id = pk.id
       WHERE pk.id = $1 GROUP BY pk.id`,
      [req.params.id]
    );
    res.json(updated.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al actualizar pack' });
  }
});

/* ── Eliminar pack ── */
packsRouter.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM packs WHERE id = $1 RETURNING imagen_url`, [req.params.id]);
    if (!result.rows[0]) { res.status(404).json({ error: 'No encontrado' }); return; }
    const imgPath = result.rows[0].imagen_url;
    if (imgPath) {
      const full = path.join(__dirname, '..', '..', imgPath.replace(/^\//, ''));
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error al eliminar pack' });
  }
});

/* ── Subir imagen ── */
packsRouter.post('/:id/imagen', authMiddleware, upload.single('imagen'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No se recibió imagen' }); return; }
  const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
  const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
  if (!allowed.includes(ext)) { res.status(400).json({ error: 'Formato no permitido' }); return; }
  try {
    if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
    const old = await pool.query(`SELECT imagen_url FROM packs WHERE id = $1`, [req.params.id]);
    if (!old.rows[0]) { res.status(404).json({ error: 'No encontrado' }); return; }
    const oldImg = old.rows[0].imagen_url;
    if (oldImg) {
      const full = path.join(__dirname, '..', '..', oldImg.replace(/^\//, ''));
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
    const filename = `pack-${req.params.id}-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(IMG_DIR, filename), req.file.buffer);
    const result = await pool.query(
      `UPDATE packs SET imagen_url = $1 WHERE id = $2 RETURNING *`,
      [imgUrl(filename), req.params.id]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

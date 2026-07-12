import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware } from '../middleware/auth.middleware';

export const promosRouter = Router();

const WITH_IDS = `
  SELECT p.*, COALESCE(
    json_agg(pp.producto_id ORDER BY pp.producto_id) FILTER (WHERE pp.producto_id IS NOT NULL),
    '[]'
  ) AS producto_ids
  FROM promos p
  LEFT JOIN promo_productos pp ON pp.promo_id = p.id
`;

const WITH_FULL_PRODUCTOS = `
  SELECT p.*,
    COALESCE(
      json_agg(
        json_build_object(
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
          'promocion',      prod.promocion
        ) ORDER BY prod.nombre
      ) FILTER (WHERE prod.id IS NOT NULL),
      '[]'
    ) AS productos
  FROM promos p
  LEFT JOIN promo_productos pp ON pp.promo_id = p.id
  LEFT JOIN productos prod ON prod.id = pp.producto_id
`;

promosRouter.get('/', async (_req, res) => {
  try {
    const result = await pool.query(
      `${WITH_FULL_PRODUCTOS}
       WHERE p.activo = true
       GROUP BY p.id
       HAVING COUNT(prod.id) > 0
       ORDER BY p.orden ASC, p.id ASC`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener promos' });
  }
});

promosRouter.get('/todas', authMiddleware, async (_req, res) => {
  try {
    const result = await pool.query(
      `${WITH_IDS} GROUP BY p.id ORDER BY p.orden ASC, p.id ASC`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener promos' });
  }
});

promosRouter.post('/', authMiddleware, async (req, res) => {
  const { nombre, descripcion, tipo, activo, orden, producto_ids } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO promos (nombre, descripcion, tipo, activo, orden)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, descripcion ?? null, tipo ?? 'general', activo ?? true, orden ?? 0]
    );
    const promo = result.rows[0];
    const ids: number[] = Array.isArray(producto_ids) ? producto_ids : [];
    for (const pid of ids) {
      await pool.query(
        `INSERT INTO promo_productos (promo_id, producto_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [promo.id, pid]
      );
    }
    promo.producto_ids = ids;
    res.status(201).json(promo);
  } catch {
    res.status(500).json({ error: 'Error al crear promo' });
  }
});

promosRouter.put('/:id', authMiddleware, async (req, res) => {
  const { nombre, descripcion, tipo, activo, orden, producto_ids } = req.body;
  try {
    const result = await pool.query(
      `UPDATE promos SET
        nombre      = COALESCE($1, nombre),
        descripcion = $2,
        tipo        = COALESCE($3, tipo),
        activo      = COALESCE($4, activo),
        orden       = COALESCE($5, orden)
       WHERE id = $6 RETURNING *`,
      [nombre ?? null, descripcion ?? null, tipo ?? null, activo ?? null, orden ?? null, req.params.id]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'No encontrado' }); return; }
    if (Array.isArray(producto_ids)) {
      await pool.query(`DELETE FROM promo_productos WHERE promo_id = $1`, [req.params.id]);
      for (const pid of producto_ids) {
        await pool.query(
          `INSERT INTO promo_productos (promo_id, producto_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [req.params.id, pid]
        );
      }
    }
    const prodIds = await pool.query(
      `SELECT producto_id FROM promo_productos WHERE promo_id = $1 ORDER BY producto_id`,
      [req.params.id]
    );
    const promo = result.rows[0];
    promo.producto_ids = prodIds.rows.map((r: { producto_id: number }) => r.producto_id);
    res.json(promo);
  } catch {
    res.status(500).json({ error: 'Error al actualizar promo' });
  }
});

promosRouter.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM promos WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!result.rows[0]) { res.status(404).json({ error: 'No encontrado' }); return; }
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error al eliminar promo' });
  }
});

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

// GET /api/promos/productos-disponibles — admin: productos anotados con la promo
// a la que ya pertenecen (si alguna) y si ya tienen un descuento propio, para el
// selector de "agregar productos" del formulario de promos.
promosRouter.get('/productos-disponibles', authMiddleware, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.nombre, p.marca, p.categoria, p.promocion,
             pp.promo_id AS "promoId", pr.nombre AS "promoNombre"
      FROM productos p
      LEFT JOIN promo_productos pp ON pp.producto_id = p.id
      LEFT JOIN promos pr ON pr.id = pp.promo_id
      ORDER BY p.nombre
    `);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Verifica que ninguno de los producto_ids ya pertenezca a otra promo distinta
// de excludePromoId. Devuelve la lista de conflictos (vacía si no hay ninguno).
async function buscarConflictosDePromo(
  productoIds: number[],
  excludePromoId: number | null
): Promise<{ producto_id: number; nombre: string; promo_nombre: string }[]> {
  if (productoIds.length === 0) return [];
  const result = await pool.query(
    `SELECT pp.producto_id, prod.nombre, pr.nombre AS promo_nombre
     FROM promo_productos pp
     JOIN promos pr ON pr.id = pp.promo_id
     JOIN productos prod ON prod.id = pp.producto_id
     WHERE pp.producto_id = ANY($1::int[])
       AND ($2::int IS NULL OR pp.promo_id != $2)`,
    [productoIds, excludePromoId]
  );
  return result.rows;
}

// Aplica (o recalcula) el descuento porcentual de una promo sobre un producto,
// usando siempre el precio original real como base para no encimar descuentos.
async function aplicarDescuentoProducto(productoId: number, porcentaje: number): Promise<void> {
  const prod = await pool.query(
    `SELECT precio, precio_original FROM productos WHERE id = $1`,
    [productoId]
  );
  if (!prod.rows[0]) return;
  const base = prod.rows[0].precio_original ?? prod.rows[0].precio;
  const nuevoPrecio = Math.round(base * (1 - porcentaje / 100));
  await pool.query(
    `UPDATE productos SET precio_original = $1, precio = $2, promocion = 'descuento' WHERE id = $3`,
    [base, nuevoPrecio, productoId]
  );
}

// Revierte el descuento aplicado por una promo, restaurando el precio original.
async function revertirDescuentoProducto(productoId: number): Promise<void> {
  await pool.query(
    `UPDATE productos SET precio = precio_original, precio_original = NULL, promocion = NULL
     WHERE id = $1 AND precio_original IS NOT NULL`,
    [productoId]
  );
}

promosRouter.post('/', authMiddleware, async (req, res) => {
  const { nombre, descripcion, tipo, activo, orden, producto_ids, porcentaje_descuento } = req.body;
  try {
    const ids: number[] = Array.isArray(producto_ids) ? producto_ids : [];
    const conflictos = await buscarConflictosDePromo(ids, null);
    if (conflictos.length > 0) {
      res.status(409).json({
        error: `Ya asignado a otra promo: ${conflictos.map(c => `${c.nombre} (${c.promo_nombre})`).join(', ')}`
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO promos (nombre, descripcion, tipo, activo, orden, porcentaje_descuento)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, descripcion ?? null, tipo ?? 'general', activo ?? true, orden ?? 0, porcentaje_descuento ?? null]
    );
    const promo = result.rows[0];
    for (const pid of ids) {
      await pool.query(
        `INSERT INTO promo_productos (promo_id, producto_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [promo.id, pid]
      );
    }
    if (promo.tipo === 'descuento' && promo.porcentaje_descuento) {
      for (const pid of ids) await aplicarDescuentoProducto(pid, parseFloat(promo.porcentaje_descuento));
    }
    promo.producto_ids = ids;
    res.status(201).json(promo);
  } catch {
    res.status(500).json({ error: 'Error al crear promo' });
  }
});

promosRouter.put('/:id', authMiddleware, async (req, res) => {
  const { nombre, descripcion, tipo, activo, orden, producto_ids, porcentaje_descuento } = req.body;
  const promoId = Number(req.params.id);
  try {
    const actual = await pool.query(`SELECT * FROM promos WHERE id = $1`, [promoId]);
    if (!actual.rows[0]) { res.status(404).json({ error: 'No encontrado' }); return; }
    const idsAntes: number[] = (
      await pool.query(`SELECT producto_id FROM promo_productos WHERE promo_id = $1`, [promoId])
    ).rows.map((r: { producto_id: number }) => r.producto_id);

    if (Array.isArray(producto_ids)) {
      const conflictos = await buscarConflictosDePromo(producto_ids, promoId);
      if (conflictos.length > 0) {
        res.status(409).json({
          error: `Ya asignado a otra promo: ${conflictos.map(c => `${c.nombre} (${c.promo_nombre})`).join(', ')}`
        });
        return;
      }
    }

    const result = await pool.query(
      `UPDATE promos SET
        nombre                = COALESCE($1, nombre),
        descripcion           = $2,
        tipo                  = COALESCE($3, tipo),
        activo                = COALESCE($4, activo),
        orden                 = COALESCE($5, orden),
        porcentaje_descuento  = COALESCE($6, porcentaje_descuento)
       WHERE id = $7 RETURNING *`,
      [nombre ?? null, descripcion ?? null, tipo ?? null, activo ?? null, orden ?? null, porcentaje_descuento ?? null, promoId]
    );
    const promo = result.rows[0];

    if (Array.isArray(producto_ids)) {
      await pool.query(`DELETE FROM promo_productos WHERE promo_id = $1`, [promoId]);
      for (const pid of producto_ids) {
        await pool.query(
          `INSERT INTO promo_productos (promo_id, producto_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [promoId, pid]
        );
      }
    }

    const idsDespues: number[] = Array.isArray(producto_ids) ? producto_ids : idsAntes;

    // Sincroniza el descuento con el estado final de la promo: aplica/recalcula
    // en los productos vigentes si sigue siendo tipo 'descuento', y revierte en
    // los que quedaron fuera o si la promo dejó de ser de tipo 'descuento'.
    if (promo.tipo === 'descuento' && promo.porcentaje_descuento) {
      for (const pid of idsDespues) await aplicarDescuentoProducto(pid, parseFloat(promo.porcentaje_descuento));
    } else {
      for (const pid of idsDespues) await revertirDescuentoProducto(pid);
    }
    for (const pid of idsAntes.filter(id => !idsDespues.includes(id))) {
      await revertirDescuentoProducto(pid);
    }

    promo.producto_ids = idsDespues;
    res.json(promo);
  } catch {
    res.status(500).json({ error: 'Error al actualizar promo' });
  }
});

promosRouter.delete('/:id', authMiddleware, async (req, res) => {
  const promoId = Number(req.params.id);
  try {
    const idsPromo: number[] = (
      await pool.query(`SELECT producto_id FROM promo_productos WHERE promo_id = $1`, [promoId])
    ).rows.map((r: { producto_id: number }) => r.producto_id);

    const result = await pool.query(`DELETE FROM promos WHERE id = $1 RETURNING id`, [promoId]);
    if (!result.rows[0]) { res.status(404).json({ error: 'No encontrado' }); return; }

    for (const pid of idsPromo) await revertirDescuentoProducto(pid);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error al eliminar promo' });
  }
});

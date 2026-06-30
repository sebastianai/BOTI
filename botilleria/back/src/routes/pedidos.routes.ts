import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { Response } from 'express';

export const pedidosRouter = Router();

// GET /api/pedidos — admin: lista todos con filtros opcionales
pedidosRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { estado, canal, medio_pago, busqueda, desde, hasta } = req.query;
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (estado)     { conditions.push(`p.estado = $${i++}`);       params.push(estado); }
    if (canal)      { conditions.push(`p.canal = $${i++}`);        params.push(canal); }
    if (medio_pago) { conditions.push(`p.medio_pago = $${i++}`);   params.push(medio_pago); }
    if (desde)      { conditions.push(`p.fecha_pedido >= $${i++}`); params.push(desde); }
    if (hasta)      { conditions.push(`p.fecha_pedido <= $${i++}`); params.push(hasta); }
    if (busqueda) {
      conditions.push(`(p.nombre_cliente ILIKE $${i} OR p.numero_pedido ILIKE $${i} OR p.telefono_cliente ILIKE $${i})`);
      params.push(`%${busqueda}%`);
      i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT p.*,
              COUNT(pi.id)::int AS total_items
       FROM pedidos p
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
       ${where}
       GROUP BY p.id
       ORDER BY p.fecha_pedido DESC`,
      params
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// GET /api/pedidos/:id — admin: detalle con items
pedidosRouter.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const pedido = await pool.query(`SELECT * FROM pedidos WHERE id = $1`, [req.params.id]);
    if (!pedido.rows[0]) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }

    const items = await pool.query(
      `SELECT * FROM pedido_items WHERE pedido_id = $1 ORDER BY id`,
      [req.params.id]
    );
    res.json({ ...pedido.rows[0], items: items.rows });
  } catch {
    res.status(500).json({ error: 'Error al obtener el pedido' });
  }
});

// POST /api/pedidos — público: crea un pedido desde el portal
pedidosRouter.post('/', async (req, res) => {
  const {
    nombre_cliente, rut_cliente, telefono_cliente, email_cliente, direccion_cliente,
    medio_pago, canal = 'portal', costo_envio = 0, notas, items
  } = req.body;

  if (!nombre_cliente) { res.status(400).json({ error: 'Nombre del cliente requerido' }); return; }
  if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ error: 'El pedido debe tener al menos un producto' }); return; }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Calcula subtotal leyendo precios actuales de la BD
    let subtotal = 0;
    const itemsResueltos: Array<{
      producto_id: number; nombre_producto: string; categoria: string | null;
      precio_unitario: number; precio_original: number | null; cantidad: number; subtotal: number;
    }> = [];

    for (const item of items as Array<{ producto_id: number; cantidad: number }>) {
      if (!item.producto_id || !item.cantidad || item.cantidad < 1) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Item inválido: ${JSON.stringify(item)}` });
        return;
      }
      const prod = await client.query(
        `SELECT id, nombre, categoria, precio, precio_original FROM productos WHERE id = $1`,
        [item.producto_id]
      );
      if (!prod.rows[0]) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Producto ${item.producto_id} no encontrado` });
        return;
      }
      const p = prod.rows[0];
      const itemSubtotal = parseFloat(p.precio) * item.cantidad;
      subtotal += itemSubtotal;
      itemsResueltos.push({
        producto_id: p.id,
        nombre_producto: p.nombre,
        categoria: p.categoria ?? null,
        precio_unitario: parseFloat(p.precio),
        precio_original: p.precio_original ? parseFloat(p.precio_original) : null,
        cantidad: item.cantidad,
        subtotal: itemSubtotal,
      });
    }

    const total = subtotal + parseFloat(String(costo_envio));

    const pedidoResult = await client.query(
      `INSERT INTO pedidos
         (nombre_cliente, rut_cliente, telefono_cliente, email_cliente, direccion_cliente,
          medio_pago, canal, subtotal, costo_envio, total, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [nombre_cliente, rut_cliente ?? null, telefono_cliente ?? null, email_cliente ?? null,
       direccion_cliente ?? null, medio_pago ?? null, canal, subtotal, costo_envio, total, notas ?? null]
    );
    const pedido = pedidoResult.rows[0];

    // Genera numero_pedido con formato PED-000001
    const numeroPedido = `PED-${String(pedido.id).padStart(6, '0')}`;
    await client.query(`UPDATE pedidos SET numero_pedido = $1 WHERE id = $2`, [numeroPedido, pedido.id]);
    pedido.numero_pedido = numeroPedido;

    for (const item of itemsResueltos) {
      await client.query(
        `INSERT INTO pedido_items (pedido_id, producto_id, nombre_producto, categoria, precio_unitario, precio_original, cantidad, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [pedido.id, item.producto_id, item.nombre_producto, item.categoria,
         item.precio_unitario, item.precio_original, item.cantidad, item.subtotal]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...pedido, items: itemsResueltos });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al crear el pedido' });
  } finally {
    client.release();
  }
});

// PUT /api/pedidos/:id/estado — admin: cambia solo el estado
pedidosRouter.put('/:id/estado', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { estado } = req.body;
  const validos = ['pendiente', 'confirmado', 'en_camino', 'entregado', 'cancelado'];
  if (!validos.includes(estado)) {
    res.status(400).json({ error: `Estado inválido. Valores: ${validos.join(', ')}` });
    return;
  }
  try {
    const extras: Record<string, string> = {};
    if (estado === 'confirmado') extras['fecha_confirmacion'] = 'NOW()';
    if (estado === 'entregado')  extras['fecha_entrega_real']  = 'NOW()';

    const extraSql = Object.entries(extras).map(([k, v]) => `${k} = ${v}`).join(', ');
    const result = await pool.query(
      `UPDATE pedidos SET estado = $1, actualizado_en = NOW() ${extraSql ? ', ' + extraSql : ''} WHERE id = $2 RETURNING *`,
      [estado, req.params.id]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al actualizar el estado' });
  }
});

// PUT /api/pedidos/:id — admin: edita datos del pedido (sin items)
pedidosRouter.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const {
    nombre_cliente, rut_cliente, telefono_cliente, email_cliente, direccion_cliente,
    medio_pago, canal, costo_envio, notas, notas_internas, fecha_entrega_estimada
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE pedidos SET
        nombre_cliente         = COALESCE($1,  nombre_cliente),
        rut_cliente            = COALESCE($2,  rut_cliente),
        telefono_cliente       = COALESCE($3,  telefono_cliente),
        email_cliente          = COALESCE($4,  email_cliente),
        direccion_cliente      = COALESCE($5,  direccion_cliente),
        medio_pago             = COALESCE($6,  medio_pago),
        canal                  = COALESCE($7,  canal),
        costo_envio            = COALESCE($8,  costo_envio),
        notas                  = COALESCE($9,  notas),
        notas_internas         = COALESCE($10, notas_internas),
        fecha_entrega_estimada = COALESCE($11, fecha_entrega_estimada),
        actualizado_en         = NOW()
       WHERE id = $12 RETURNING *`,
      [nombre_cliente, rut_cliente, telefono_cliente, email_cliente, direccion_cliente,
       medio_pago, canal, costo_envio, notas, notas_internas, fecha_entrega_estimada, req.params.id]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al actualizar el pedido' });
  }
});

// DELETE /api/pedidos/:id — admin
pedidosRouter.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`DELETE FROM pedidos WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!result.rows[0]) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error al eliminar el pedido' });
  }
});

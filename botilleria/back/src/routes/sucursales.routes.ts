import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware } from '../middleware/auth.middleware';

export const sucursalesRouter = Router();

// GET /api/sucursales — público: sucursales activas para el mapa y el checkout
sucursalesRouter.get('/', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM sucursales WHERE activa = true ORDER BY principal DESC, orden ASC, id ASC`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener sucursales' });
  }
});

// GET /api/sucursales/todas — admin: incluye inactivas y cuántos pedidos tiene cada una
sucursalesRouter.get('/todas', authMiddleware, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, COUNT(p.id)::int AS total_pedidos
       FROM sucursales s
       LEFT JOIN pedidos p ON p.sucursal_id = s.id
       GROUP BY s.id
       ORDER BY s.principal DESC, s.orden ASC, s.id ASC`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener sucursales' });
  }
});

sucursalesRouter.post('/', authMiddleware, async (req, res) => {
  const { nombre, direccion, principal, activa, orden } = req.body;
  if (!nombre || !direccion) { res.status(400).json({ error: 'Nombre y dirección son requeridos' }); return; }
  try {
    const result = await pool.query(
      `INSERT INTO sucursales (nombre, direccion, principal, activa, orden)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, direccion, principal ?? false, activa ?? true, orden ?? 0]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al crear la sucursal' });
  }
});

sucursalesRouter.put('/:id', authMiddleware, async (req, res) => {
  const { nombre, direccion, principal, activa, orden } = req.body;
  try {
    const result = await pool.query(
      `UPDATE sucursales SET
        nombre    = COALESCE($1, nombre),
        direccion = COALESCE($2, direccion),
        principal = COALESCE($3, principal),
        activa    = COALESCE($4, activa),
        orden     = COALESCE($5, orden)
       WHERE id = $6 RETURNING *`,
      [nombre ?? null, direccion ?? null, principal ?? null, activa ?? null, orden ?? null, req.params.id]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'No encontrada' }); return; }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al actualizar la sucursal' });
  }
});

sucursalesRouter.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM sucursales WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!result.rows[0]) { res.status(404).json({ error: 'No encontrada' }); return; }
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error al eliminar la sucursal' });
  }
});

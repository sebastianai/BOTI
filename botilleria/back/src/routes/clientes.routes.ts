import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { Response } from 'express';

export const clientesRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'botilleria-secret-dev';
const JWT_EXPIRES = '8h';

const CLIENTE_COLUMNAS = 'id, nombre, apellido, rut, correo, telefono, fecha_nacimiento, genero, activo, creado_en';
const CLIENTE_COLUMNAS_C = CLIENTE_COLUMNAS.split(', ').map(col => `c.${col}`).join(', ');

// GET /api/clientes — admin: lista todos los clientes con su cantidad de pedidos y total gastado
clientesRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT ${CLIENTE_COLUMNAS_C},
              COUNT(p.id)::int AS total_pedidos,
              COALESCE(SUM(p.total), 0) AS total_gastado
       FROM clientes c
       LEFT JOIN pedidos p ON p.rut_cliente = c.rut OR p.email_cliente = c.correo
       GROUP BY c.id
       ORDER BY c.creado_en DESC`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener los clientes' });
  }
});

// GET /api/clientes/:id — admin: detalle del cliente + sus pedidos (por RUT o correo)
clientesRouter.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const cliente = await pool.query(
      `SELECT ${CLIENTE_COLUMNAS} FROM clientes WHERE id = $1`,
      [req.params.id]
    );
    if (!cliente.rows[0]) { res.status(404).json({ error: 'Cliente no encontrado' }); return; }

    const pedidos = await pool.query(
      `SELECT p.id, p.numero_pedido, p.estado, p.medio_pago, p.canal, p.total, p.fecha_pedido,
              COUNT(pi.id)::int AS total_items
       FROM pedidos p
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
       WHERE p.rut_cliente = $1 OR p.email_cliente = $2
       GROUP BY p.id
       ORDER BY p.fecha_pedido DESC`,
      [cliente.rows[0].rut, cliente.rows[0].correo]
    );

    const total_pedidos = pedidos.rows.length;
    const total_gastado = pedidos.rows.reduce((sum, p) => sum + parseFloat(p.total), 0);

    res.json({ ...cliente.rows[0], total_pedidos, total_gastado, pedidos: pedidos.rows });
  } catch {
    res.status(500).json({ error: 'Error al obtener el cliente' });
  }
});

clientesRouter.post('/registro', async (req, res) => {
  const { nombre, apellido, rut, correo, telefono, fechaNacimiento, genero, contrasena } = req.body;

  if (!nombre?.trim() || !apellido?.trim() || !rut?.trim() || !correo?.trim() || !contrasena) {
    res.status(400).json({ error: 'Completa todos los campos obligatorios' });
    return;
  }
  if (contrasena.length < 8) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    return;
  }

  try {
    const existente = await pool.query(
      `SELECT id FROM clientes WHERE rut = $1 OR correo = $2`,
      [rut.trim(), correo.trim()]
    );
    if (existente.rows.length > 0) {
      res.status(409).json({ error: 'Ya existe una cuenta registrada con ese RUT o correo' });
      return;
    }

    const hash = await bcrypt.hash(contrasena, 10);
    const result = await pool.query(
      `INSERT INTO clientes (nombre, apellido, rut, correo, telefono, fecha_nacimiento, genero, contrasena)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, nombre, apellido, correo`,
      [nombre.trim(), apellido.trim(), rut.trim(), correo.trim(), telefono?.trim() || null, fechaNacimiento || null, genero || null, hash]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/clientes/login — público: inicio de sesión de clientes (por RUT)
clientesRouter.post('/login', async (req, res) => {
  const { rut, contrasena } = req.body;
  if (!rut?.trim() || !contrasena) {
    res.status(400).json({ error: 'RUT y contraseña requeridos' });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT id, nombre, apellido, rut, correo, telefono, contrasena, activo
       FROM clientes WHERE rut = $1`,
      [rut.trim()]
    );
    const cliente = result.rows[0];
    if (!cliente || !cliente.activo) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }
    const ok = await bcrypt.compare(contrasena, cliente.contrasena);
    if (!ok) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }
    const token = jwt.sign({ id: cliente.id, tipo: 'cliente' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({
      token,
      cliente: { id: cliente.id, nombre: cliente.nombre, apellido: cliente.apellido, rut: cliente.rut, correo: cliente.correo, telefono: cliente.telefono }
    });
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

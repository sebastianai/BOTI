import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { Response } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'botilleria-secret-dev';
const JWT_EXPIRES = '8h';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { usuario, contrasena } = req.body;
  if (!usuario || !contrasena) {
    res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT id, usuario, nombre, correo, rol, contrasena, activo
       FROM usuarios WHERE usuario = $1`,
      [usuario]
    );
    const user = result.rows[0];
    if (!user || !user.activo) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }
    const ok = await bcrypt.compare(contrasena, user.contrasena);
    if (!ok) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }
    await pool.query(`UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1`, [user.id]);
    const token = jwt.sign({ id: user.id, rol: user.rol }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({
      token,
      usuario: { id: user.id, usuario: user.usuario, nombre: user.nombre, correo: user.correo, rol: user.rol }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, usuario, nombre, correo, telefono, rol, ultimo_acceso, creado_en
       FROM usuarios WHERE id = $1`,
      [req.usuarioId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

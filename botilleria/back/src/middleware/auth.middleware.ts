import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'botilleria-secret-dev';

export interface AuthRequest extends Request {
  usuarioId?: number;
  usuarioRol?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; rol: string };
    req.usuarioId = payload.id;
    req.usuarioRol = payload.rol;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db';
import { authMiddleware } from '../middleware/auth.middleware';

export const publicidadRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });
const IMG_DIR = path.join(__dirname, '..', '..', 'uploads', 'banners');

function imgUrl(filename: string | null): string | null {
  return filename ? `/uploads/banners/${filename}` : null;
}

publicidadRouter.get('/', async (req, res) => {
  try {
    const { formato } = req.query;
    const query = formato
      ? `SELECT * FROM publicidad WHERE activo = true AND formato = $1 ORDER BY orden ASC, id ASC`
      : `SELECT * FROM publicidad WHERE activo = true ORDER BY orden ASC, id ASC`;
    const params = formato ? [formato] : [];
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener publicidad' });
  }
});

publicidadRouter.get('/todos', authMiddleware, async (_req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM publicidad ORDER BY orden ASC, id ASC`);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener publicidad' });
  }
});

publicidadRouter.post('/', authMiddleware, async (req, res) => {
  const { titulo, descripcion, enlace, orden, activo, formato } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO publicidad (titulo, descripcion, enlace, orden, activo, formato)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [titulo ?? null, descripcion ?? null, enlace ?? null, orden ?? 0, activo ?? true, formato ?? 'escritorio']
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al crear publicidad' });
  }
});

publicidadRouter.put('/:id', authMiddleware, async (req, res) => {
  const { titulo, descripcion, enlace, orden, activo, formato } = req.body;
  try {
    const result = await pool.query(
      `UPDATE publicidad SET
        titulo      = COALESCE($1, titulo),
        descripcion = COALESCE($2, descripcion),
        enlace      = COALESCE($3, enlace),
        orden       = COALESCE($4, orden),
        activo      = COALESCE($5, activo),
        formato     = COALESCE($6, formato)
       WHERE id = $7 RETURNING *`,
      [titulo, descripcion, enlace, orden, activo, formato, req.params.id]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'No encontrado' }); return; }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al actualizar publicidad' });
  }
});

publicidadRouter.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM publicidad WHERE id=$1 RETURNING imagen_url`, [req.params.id]);
    if (!result.rows[0]) { res.status(404).json({ error: 'No encontrado' }); return; }
    const imgPath = result.rows[0].imagen_url;
    if (imgPath) {
      const full = path.join(__dirname, '..', '..', imgPath.replace(/^\//, ''));
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error al eliminar publicidad' });
  }
});

publicidadRouter.post('/:id/imagen', authMiddleware, upload.single('imagen'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No se recibió imagen' }); return; }
  const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
  const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
  if (!allowed.includes(ext)) { res.status(400).json({ error: 'Formato no permitido' }); return; }
  try {
    if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
    const old = await pool.query(`SELECT imagen_url FROM publicidad WHERE id=$1`, [req.params.id]);
    if (!old.rows[0]) { res.status(404).json({ error: 'No encontrado' }); return; }
    const oldImg = old.rows[0].imagen_url;
    if (oldImg) {
      const full = path.join(__dirname, '..', '..', oldImg.replace(/^\//, ''));
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
    const filename = `banner-${req.params.id}-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(IMG_DIR, filename), req.file.buffer);
    const result = await pool.query(
      `UPDATE publicidad SET imagen_url=$1 WHERE id=$2 RETURNING *`,
      [imgUrl(filename), req.params.id]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db';
import { authMiddleware } from '../middleware/auth.middleware';

export const portalConfigRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

const LOGO_DIR = path.join(__dirname, '..', '..', 'uploads', 'portal');

portalConfigRouter.get('/', async (_req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM diseno_portal WHERE id = 1`);
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al obtener la configuración' });
  }
});

portalConfigRouter.put('/', authMiddleware, async (req, res) => {
  const { nombre_negocio, tagline, descripcion, telefono, email, direccion, color_primario, color_acento, mapa_url } = req.body;
  try {
    const result = await pool.query(
      `UPDATE diseno_portal SET
        nombre_negocio = COALESCE($1, nombre_negocio),
        tagline        = COALESCE($2, tagline),
        descripcion    = COALESCE($3, descripcion),
        telefono       = COALESCE($4, telefono),
        email          = COALESCE($5, email),
        direccion      = COALESCE($6, direccion),
        color_primario = COALESCE($7, color_primario),
        color_acento   = COALESCE($8, color_acento),
        mapa_url       = $9,
        actualizado_en = NOW()
       WHERE id = 1
       RETURNING *`,
      [nombre_negocio, tagline, descripcion, telefono, email, direccion, color_primario, color_acento, mapa_url ?? null]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al guardar la configuración' });
  }
});

portalConfigRouter.post('/logo', authMiddleware, upload.single('logo'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No se recibió ningún archivo' });
    return;
  }
  const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
  const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
  if (!allowed.includes(ext)) {
    res.status(400).json({ error: 'Formato no permitido. Usa PNG, JPG, WEBP o SVG' });
    return;
  }
  try {
    if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true });

    const current = await pool.query(`SELECT logo_url FROM diseno_portal WHERE id = 1`);
    const oldUrl: string | null = current.rows[0]?.logo_url;
    if (oldUrl) {
      const oldPath = path.join(__dirname, '..', '..', oldUrl.replace(/^\/uploads\//, 'uploads/'));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const filename = `logo${ext}`;
    fs.writeFileSync(path.join(LOGO_DIR, filename), req.file.buffer);
    const logoUrl = `/uploads/portal/${filename}`;

    const result = await pool.query(
      `UPDATE diseno_portal SET logo_url = $1, actualizado_en = NOW() WHERE id = 1 RETURNING *`,
      [logoUrl]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al guardar el logo' });
  }
});

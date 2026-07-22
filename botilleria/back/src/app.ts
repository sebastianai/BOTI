import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { productosRouter } from './routes/productos.routes';
import { categoriasRouter } from './routes/categorias.routes';
import { authRouter } from './routes/auth.routes';
import { portalConfigRouter } from './routes/portal-config.routes';
import { publicidadRouter } from './routes/publicidad.routes';
import { pedidosRouter } from './routes/pedidos.routes';
import { promosRouter } from './routes/promos.routes';
import { packsRouter } from './routes/packs.routes';
import { estadisticasRouter } from './routes/estadisticas.routes';
import { sucursalesRouter } from './routes/sucursales.routes';
import { clientesRouter } from './routes/clientes.routes';
import { initDb } from './db-init';

export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/portal-config', portalConfigRouter);
app.use('/api/publicidad', publicidadRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/promos', promosRouter);
app.use('/api/packs', packsRouter);
app.use('/api/productos', productosRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api/estadisticas', estadisticasRouter);
app.use('/api/sucursales', sucursalesRouter);
app.use('/api/clientes', clientesRouter);

initDb().catch(err => console.error('Error al inicializar la base de datos:', err));

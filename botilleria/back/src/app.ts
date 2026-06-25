import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { productosRouter } from './routes/productos.routes';
import { categoriasRouter } from './routes/categorias.routes';

export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/productos', productosRouter);
app.use('/api/categorias', categoriasRouter);

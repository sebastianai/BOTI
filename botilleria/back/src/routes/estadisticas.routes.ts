import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { Response } from 'express';

export const estadisticasRouter = Router();

// GET /api/estadisticas — admin: métricas del negocio calculadas desde pedidos/pedido_items
estadisticasRouter.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      resumen,
      mesActual,
      mesAnterior,
      topProductos,
      topPacks,
      porCategoria,
      porEstado,
      tendencia,
      porMedioPago,
      porCanal,
    ] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total_pedidos,
          COALESCE(SUM(total), 0)::float AS ventas_totales,
          COALESCE(AVG(total), 0)::float AS ticket_promedio
        FROM pedidos
        WHERE estado != 'cancelado'
      `),
      pool.query(`
        SELECT COUNT(*)::int AS pedidos, COALESCE(SUM(total), 0)::float AS ventas
        FROM pedidos
        WHERE estado != 'cancelado'
          AND date_trunc('month', fecha_pedido) = date_trunc('month', CURRENT_DATE)
      `),
      pool.query(`
        SELECT COUNT(*)::int AS pedidos, COALESCE(SUM(total), 0)::float AS ventas
        FROM pedidos
        WHERE estado != 'cancelado'
          AND date_trunc('month', fecha_pedido) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
      `),
      pool.query(`
        SELECT pi.producto_id, pi.nombre_producto AS nombre, SUM(pi.cantidad)::int AS unidades,
               SUM(pi.subtotal)::float AS ingresos
        FROM pedido_items pi
        JOIN pedidos p ON p.id = pi.pedido_id
        WHERE p.estado != 'cancelado' AND pi.producto_id IS NOT NULL
        GROUP BY pi.producto_id, pi.nombre_producto
        ORDER BY unidades DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT pi.pack_id, pi.nombre_producto AS nombre, SUM(pi.cantidad)::int AS unidades,
               SUM(pi.subtotal)::float AS ingresos
        FROM pedido_items pi
        JOIN pedidos p ON p.id = pi.pedido_id
        WHERE p.estado != 'cancelado' AND pi.pack_id IS NOT NULL
        GROUP BY pi.pack_id, pi.nombre_producto
        ORDER BY unidades DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT COALESCE(pi.categoria, 'Otros') AS categoria, SUM(pi.subtotal)::float AS ingresos,
               SUM(pi.cantidad)::int AS unidades
        FROM pedido_items pi
        JOIN pedidos p ON p.id = pi.pedido_id
        WHERE p.estado != 'cancelado'
        GROUP BY categoria
        ORDER BY ingresos DESC
      `),
      pool.query(`SELECT estado, COUNT(*)::int AS cantidad FROM pedidos GROUP BY estado`),
      pool.query(`
        SELECT to_char(d.dia, 'YYYY-MM-DD') AS fecha, COALESCE(SUM(p.total), 0)::float AS ventas,
               COUNT(p.id)::int AS pedidos
        FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS d(dia)
        LEFT JOIN pedidos p
          ON date_trunc('day', p.fecha_pedido) = d.dia AND p.estado != 'cancelado'
        GROUP BY d.dia
        ORDER BY d.dia
      `),
      pool.query(`
        SELECT COALESCE(medio_pago, 'otro') AS medio_pago, COUNT(*)::int AS cantidad,
               COALESCE(SUM(total), 0)::float AS ventas
        FROM pedidos
        WHERE estado != 'cancelado'
        GROUP BY medio_pago
        ORDER BY ventas DESC
      `),
      pool.query(`
        SELECT canal, COUNT(*)::int AS cantidad, COALESCE(SUM(total), 0)::float AS ventas
        FROM pedidos
        WHERE estado != 'cancelado'
        GROUP BY canal
        ORDER BY ventas DESC
      `),
    ]);

    const ventasMes = mesActual.rows[0].ventas as number;
    const ventasMesAnterior = mesAnterior.rows[0].ventas as number;
    const variacionMes = ventasMesAnterior > 0
      ? ((ventasMes - ventasMesAnterior) / ventasMesAnterior) * 100
      : null;

    res.json({
      resumen: {
        totalPedidos: resumen.rows[0].total_pedidos,
        ventasTotales: resumen.rows[0].ventas_totales,
        ticketPromedio: resumen.rows[0].ticket_promedio,
      },
      ventasDelMes: {
        pedidos: mesActual.rows[0].pedidos,
        ventas: ventasMes,
        variacionPorcentual: variacionMes,
      },
      productoMasVendido: topProductos.rows[0] ?? null,
      topProductos: topProductos.rows,
      packMasVendido: topPacks.rows[0] ?? null,
      topPacks: topPacks.rows,
      ventasPorCategoria: porCategoria.rows,
      pedidosPorEstado: porEstado.rows,
      tendenciaVentas: tendencia.rows,
      ventasPorMedioPago: porMedioPago.rows,
      ventasPorCanal: porCanal.rows,
    });
  } catch (err) {
    console.error('Error al calcular estadísticas:', err);
    res.status(500).json({ error: 'Error al calcular estadísticas' });
  }
});

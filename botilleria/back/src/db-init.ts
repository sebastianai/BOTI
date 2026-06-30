import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db';

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id              SERIAL PRIMARY KEY,
      usuario         VARCHAR(50)  UNIQUE NOT NULL,
      nombre          VARCHAR(100) NOT NULL,
      correo          VARCHAR(255) UNIQUE,
      telefono        VARCHAR(20),
      contrasena      VARCHAR(255) NOT NULL,
      rol             VARCHAR(50)  NOT NULL DEFAULT 'admin',
      activo          BOOLEAN      NOT NULL DEFAULT true,
      ultimo_acceso   TIMESTAMP,
      creado_en       TIMESTAMP    NOT NULL DEFAULT NOW(),
      actualizado_en  TIMESTAMP    NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE productos ADD COLUMN IF NOT EXISTS top_ventas BOOLEAN NOT NULL DEFAULT false`);

  await pool.query(`ALTER TABLE productos ADD COLUMN IF NOT EXISTS promocion VARCHAR(50)`);
  // promocion can be: NULL (sin promoción), 'oferta' (descuento/rebaja), '2x1' (2 por el precio de 1)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS publicidad (
      id          SERIAL PRIMARY KEY,
      titulo      VARCHAR(200),
      descripcion TEXT,
      imagen_url  VARCHAR(500),
      enlace      VARCHAR(500),
      orden       INTEGER NOT NULL DEFAULT 0,
      activo      BOOLEAN NOT NULL DEFAULT true,
      formato     VARCHAR(20) NOT NULL DEFAULT 'escritorio',
      creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE publicidad ADD COLUMN IF NOT EXISTS formato VARCHAR(20) NOT NULL DEFAULT 'escritorio'`);

  const pubCount = await pool.query(`SELECT COUNT(*) FROM publicidad`);
  if (parseInt(pubCount.rows[0].count, 10) === 0) {
    await pool.query(
      `INSERT INTO publicidad (titulo, descripcion, imagen_url, orden, activo, formato) VALUES
       ('Promoción del Mes',   'Las mejores ofertas seleccionadas para ti', '/uploads/banners/banner1.jpg', 0, true, 'escritorio'),
       ('Novedades',           'Descubre los últimos productos que llegaron', '/uploads/banners/banner2.png', 1, true, 'escritorio'),
       ('Ofertas Especiales',  'No te pierdas nuestros descuentos exclusivos', '/uploads/banners/banner3.png', 2, true, 'escritorio')`
    );
    console.log('✅ Publicidades iniciales creadas');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS diseno_portal (
      id             INTEGER PRIMARY KEY DEFAULT 1,
      nombre_negocio VARCHAR(100) NOT NULL DEFAULT 'Botillería',
      tagline        VARCHAR(100) NOT NULL DEFAULT 'Premium',
      logo_url       VARCHAR(500),
      descripcion    TEXT,
      telefono       VARCHAR(30),
      email          VARCHAR(255),
      direccion      VARCHAR(255),
      color_primario VARCHAR(20)  NOT NULL DEFAULT '#1c3829',
      color_acento   VARCHAR(20)  NOT NULL DEFAULT '#c9a227',
      actualizado_en TIMESTAMP    NOT NULL DEFAULT NOW(),
      CONSTRAINT diseno_portal_singleton CHECK (id = 1)
    )
  `);

  await pool.query(`ALTER TABLE diseno_portal ADD COLUMN IF NOT EXISTS mapa_url TEXT`);

  await pool.query(`INSERT INTO diseno_portal (id) VALUES (1) ON CONFLICT DO NOTHING`);

  // ─── Pedidos ───────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id                     SERIAL PRIMARY KEY,
      numero_pedido          VARCHAR(20) UNIQUE,
      nombre_cliente         VARCHAR(100) NOT NULL,
      rut_cliente            VARCHAR(15),
      telefono_cliente       VARCHAR(30),
      email_cliente          VARCHAR(255),
      direccion_cliente      TEXT,
      estado                 VARCHAR(30)    NOT NULL DEFAULT 'pendiente',
      medio_pago             VARCHAR(50),
      canal                  VARCHAR(30)    NOT NULL DEFAULT 'portal',
      subtotal               NUMERIC(12,2)  NOT NULL DEFAULT 0,
      costo_envio            NUMERIC(12,2)  NOT NULL DEFAULT 0,
      total                  NUMERIC(12,2)  NOT NULL DEFAULT 0,
      notas                  TEXT,
      notas_internas         TEXT,
      fecha_pedido           TIMESTAMP      NOT NULL DEFAULT NOW(),
      fecha_confirmacion     TIMESTAMP,
      fecha_entrega_estimada DATE,
      fecha_entrega_real     TIMESTAMP,
      creado_en              TIMESTAMP      NOT NULL DEFAULT NOW(),
      actualizado_en         TIMESTAMP      NOT NULL DEFAULT NOW(),
      CONSTRAINT pedidos_estado_check CHECK (
        estado IN ('pendiente','confirmado','en_camino','entregado','cancelado')
      )
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha_pedido DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pedido_items (
      id               SERIAL PRIMARY KEY,
      pedido_id        INTEGER       NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      producto_id      INTEGER       REFERENCES productos(id) ON DELETE SET NULL,
      nombre_producto  VARCHAR(200)  NOT NULL,
      categoria        VARCHAR(100),
      precio_unitario  NUMERIC(12,2) NOT NULL,
      precio_original  NUMERIC(12,2),
      cantidad         INTEGER       NOT NULL DEFAULT 1,
      subtotal         NUMERIC(12,2) NOT NULL,
      CONSTRAINT pedido_items_cantidad_pos CHECK (cantidad > 0)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id)`);

  // ─── Seed 20 pedidos de prueba ────────────────────────────────────────────
  const pedidosCount = await pool.query(`SELECT COUNT(*) FROM pedidos`);
  if (parseInt(pedidosCount.rows[0].count, 10) === 0) {
    const prods = await pool.query(
      `SELECT id, nombre, categoria, precio FROM productos ORDER BY id LIMIT 12`
    );
    if (prods.rows.length > 0) {
      await seedPedidos(prods.rows);
      console.log('✅ 20 pedidos de prueba creados');
    }
  }

  const existe = await pool.query(`SELECT id FROM usuarios WHERE usuario = $1`, ['admin']);
  if (existe.rowCount === 0) {
    const hash = await bcrypt.hash('Paul12345/', 10);
    await pool.query(
      `INSERT INTO usuarios (usuario, nombre, correo, rol, contrasena)
       VALUES ($1, $2, $3, $4, $5)`,
      ['admin', 'Administrador', 'admin@botilleria.cl', 'admin', hash]
    );
    console.log('✅ Usuario admin creado');
  }

  // Seed test products with promotions
  const prodExiste2x1 = await pool.query(
    `SELECT id FROM productos WHERE promocion = '2x1' LIMIT 1`
  );
  const prodExiste3x2 = await pool.query(
    `SELECT id FROM productos WHERE promocion = '3x2' LIMIT 1`
  );

  if (prodExiste2x1.rowCount === 0) {
    await pool.query(
      `UPDATE productos SET promocion = '2x1' WHERE id = 1`
    );
    console.log('✅ Producto con promoción 2x1 configurado');
  }

  if (prodExiste3x2.rowCount === 0) {
    await pool.query(
      `UPDATE productos SET promocion = '3x2' WHERE id = 2`
    );
    console.log('✅ Producto con promoción 3x2 configurado');
  }
}

// ─── Helper: seed pedidos de prueba ──────────────────────────────────────────
type ProdRow = { id: number; nombre: string; categoria: string; precio: string };

async function seedPedidos(prods: ProdRow[]): Promise<void> {
  const pick = (i: number): ProdRow => prods[i % prods.length];

  type SeedOrder = {
    nombre: string; rut?: string; tel?: string; email?: string; dir?: string;
    estado: string; pago: string; canal: string;
    items: Array<[number, number]>;
    envio?: number; notas?: string; diasAtras: number;
  };

  const orders: SeedOrder[] = [
    { nombre: 'Ana García Soto',     rut: '12.345.678-9', tel: '+56 9 8123 4567', email: 'ana@gmail.com',       dir: 'Av. Providencia 1234, Providencia',   estado: 'entregado',   pago: 'webpay',          canal: 'portal',      items: [[0,2],[2,1],[4,1]], envio: 2990, notas: 'Llamar antes de entregar', diasAtras: 15 },
    { nombre: 'Carlos Rodríguez',    rut: '11.222.333-4', tel: '+56 9 9876 5432',                               dir: 'Los Leones 456, Ñuñoa',               estado: 'entregado',   pago: 'efectivo',        canal: 'presencial',  items: [[1,1],[3,2]],       envio: 0,                                          diasAtras: 12 },
    { nombre: 'María González',                           tel: '+56 9 7654 3210', email: 'maria@hotmail.com',   dir: 'Irarrázaval 789, Ñuñoa',              estado: 'entregado',   pago: 'transferencia',   canal: 'portal',      items: [[0,1],[5,2]],       envio: 1990,                                       diasAtras: 10 },
    { nombre: 'Pedro Martínez Vega', rut: '9.876.543-2',  tel: '+56 9 6543 2109',                               dir: 'Av. Italia 321, Santiago',            estado: 'confirmado',  pago: 'tarjeta_debito',  canal: 'portal',      items: [[2,3],[6,1]],       envio: 2990,                                       diasAtras: 4  },
    { nombre: 'Valentina López',                          tel: '+56 9 5432 1098', email: 'vale@gmail.com',      dir: 'Grecia 654, Ñuñoa',                   estado: 'en_camino',   pago: 'webpay',          canal: 'portal',      items: [[3,2],[1,4]],       envio: 2990, notas: 'Dejar en portería',          diasAtras: 1  },
    { nombre: 'Sebastián Hernández', rut: '15.678.901-k', tel: '+56 9 4321 0987', email: 'seba@gmail.com',      dir: 'Av. Irarrázaval 112, Macul',          estado: 'pendiente',   pago: 'webpay',          canal: 'portal',      items: [[4,2],[7,1]],       envio: 2990,                                       diasAtras: 0  },
    { nombre: 'Camila Torres',                            tel: '+56 9 3210 9876',                               dir: 'Los Quillayes 234, La Florida',       estado: 'pendiente',   pago: 'efectivo',        canal: 'whatsapp',    items: [[5,1],[0,2],[3,1]], envio: 0,    notas: 'Confirmar disponibilidad',  diasAtras: 0  },
    { nombre: 'Andrés Díaz Muñoz',   rut: '13.456.789-0', tel: '+56 9 2109 8765', email: 'andres@empresa.cl',   dir: 'Tobalaba 567, Providencia',           estado: 'confirmado',  pago: 'tarjeta_credito', canal: 'portal',      items: [[6,2],[8,3]],       envio: 1990,                                       diasAtras: 3  },
    { nombre: 'Javiera Morales',                          tel: '+56 9 1098 7654', email: 'javiera@gmail.com',   dir: 'Av. Matta 890, Santiago',             estado: 'entregado',   pago: 'transferencia',   canal: 'portal',      items: [[7,1],[2,2],[9,2]], envio: 2990,                                       diasAtras: 8  },
    { nombre: 'Diego Fuentes Araya', rut: '14.567.890-1', tel: '+56 9 0987 6543',                               dir: 'Pedro de Valdivia 45, Providencia',   estado: 'cancelado',   pago: 'webpay',          canal: 'portal',      items: [[8,3]],             envio: 2990, notas: 'Producto sin stock',         diasAtras: 20 },
    { nombre: 'Sofía Reyes',                              tel: '+56 9 9876 1234', email: 'sofia@gmail.com',     dir: 'Manquehue Sur 789, Las Condes',       estado: 'pendiente',   pago: 'efectivo',        canal: 'telefono',    items: [[9,2],[0,1]],       envio: 0,                                          diasAtras: 0  },
    { nombre: 'Matías Arenas',       rut: '10.111.222-3', tel: '+56 9 8765 2345',                               dir: 'Av. Ossa 123, Peñalolén',             estado: 'en_camino',   pago: 'transferencia',   canal: 'portal',      items: [[10,1],[4,2]],      envio: 3990,                                       diasAtras: 1  },
    { nombre: 'Isidora Vargas',                           tel: '+56 9 7654 3456', email: 'isi@hotmail.com',     dir: 'El Bosque Norte 500, Las Condes',     estado: 'confirmado',  pago: 'webpay',          canal: 'portal',      items: [[11,4],[2,1]],      envio: 1990, notas: 'Regalo, envolver por favor', diasAtras: 5  },
    { nombre: 'Nicolás Castro',      rut: '16.789.012-3', tel: '+56 9 6543 4567',                               dir: 'Gran Avenida 2000, San Miguel',       estado: 'entregado',   pago: 'efectivo',        canal: 'presencial',  items: [[0,6]],             envio: 0,                                          diasAtras: 7  },
    { nombre: 'Constanza Mejías',                         tel: '+56 9 5432 5678', email: 'coni@gmail.com',      dir: 'Av. Departamental 400, San Joaquín',  estado: 'cancelado',   pago: 'transferencia',   canal: 'whatsapp',    items: [[3,2],[5,3]],       envio: 0,    notas: 'No respondió confirmación', diasAtras: 18 },
    { nombre: 'Felipe Muñoz Lagos',  rut: '12.890.123-4', tel: '+56 9 4321 6789', email: 'felipe@gmail.com',    dir: 'Vicuña Mackenna 1100, La Florida',    estado: 'pendiente',   pago: 'webpay',          canal: 'portal',      items: [[6,1],[8,2],[10,1]],envio: 2990,                                       diasAtras: 0  },
    { nombre: 'Catalina Soto',                            tel: '+56 9 3210 7890',                               dir: 'Av. Vitacura 3400, Vitacura',         estado: 'entregado',   pago: 'tarjeta_credito', canal: 'portal',      items: [[1,2],[7,3]],       envio: 1990,                                       diasAtras: 6  },
    { nombre: 'Emilio Pérez Ruiz',   rut: '8.765.432-1',  tel: '+56 9 2109 8901', email: 'emilio@empresa.cl',   dir: 'Apoquindo 4500, Las Condes',          estado: 'en_camino',   pago: 'tarjeta_debito',  canal: 'portal',      items: [[9,5],[3,2]],       envio: 0,                                          diasAtras: 2  },
    { nombre: 'Paula Aguilera',                           tel: '+56 9 1098 9012', email: 'paula@hotmail.com',   dir: 'Av. Los Presidentes 234, Vitacura',   estado: 'pendiente',   pago: 'efectivo',        canal: 'presencial',  items: [[11,2],[0,3]],      envio: 0,                                          diasAtras: 0  },
    { nombre: 'Roberto Carrasco',    rut: '17.890.123-5', tel: '+56 9 0987 0123',                               dir: 'Av. La Florida 8900, La Florida',     estado: 'confirmado',  pago: 'transferencia',   canal: 'portal',      items: [[4,3],[6,2],[9,1]], envio: 2990, notas: 'Entregar tarde',             diasAtras: 3  },
  ];

  for (const o of orders) {
    let subtotal = 0;
    const itemsCalc = o.items.map(([idx, cant]) => {
      const prod = pick(idx);
      const itemSub = Math.round(parseFloat(prod.precio) * cant);
      subtotal += itemSub;
      return { prod, cant, itemSub };
    });
    const envio = o.envio ?? 0;
    const total = subtotal + envio;

    const fechaPedido    = `NOW() - INTERVAL '${o.diasAtras} days'`;
    const fechaConfirm   = ['confirmado','en_camino','entregado'].includes(o.estado) ? `NOW() - INTERVAL '${Math.max(0, o.diasAtras - 1)} days'` : 'NULL';
    const fechaEntregada = o.estado === 'entregado' ? `NOW() - INTERVAL '${Math.max(0, o.diasAtras - 2)} days'` : 'NULL';

    const result = await pool.query(
      `INSERT INTO pedidos
         (nombre_cliente, rut_cliente, telefono_cliente, email_cliente, direccion_cliente,
          estado, medio_pago, canal, subtotal, costo_envio, total, notas,
          fecha_pedido, fecha_confirmacion, fecha_entrega_real)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
               ${fechaPedido}, ${fechaConfirm}, ${fechaEntregada})
       RETURNING id`,
      [o.nombre, o.rut ?? null, o.tel ?? null, o.email ?? null, o.dir ?? null,
       o.estado, o.pago, o.canal, subtotal, envio, total, o.notas ?? null]
    );

    const id = result.rows[0].id;
    await pool.query(`UPDATE pedidos SET numero_pedido = $1 WHERE id = $2`, [`PED-${String(id).padStart(6, '0')}`, id]);

    for (const { prod, cant, itemSub } of itemsCalc) {
      await pool.query(
        `INSERT INTO pedido_items (pedido_id, producto_id, nombre_producto, categoria, precio_unitario, cantidad, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, prod.id, prod.nombre, prod.categoria, parseFloat(prod.precio), cant, itemSub]
      );
    }
  }
}

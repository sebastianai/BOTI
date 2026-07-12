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

  // ─── Packs ─────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS packs (
      id          SERIAL PRIMARY KEY,
      nombre      VARCHAR(200) NOT NULL,
      descripcion TEXT,
      precio      INTEGER NOT NULL DEFAULT 0,
      emoji       VARCHAR(10) NOT NULL DEFAULT '📦',
      color_fondo TEXT NOT NULL DEFAULT 'linear-gradient(135deg, #1c3829 0%, #2a5540 100%)',
      imagen_url  VARCHAR(500),
      activo      BOOLEAN NOT NULL DEFAULT true,
      orden       INTEGER NOT NULL DEFAULT 0,
      creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Migración: agregar columnas nuevas si no existen (para instancias ya inicializadas)
  await pool.query(`ALTER TABLE packs ADD COLUMN IF NOT EXISTS precio INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE packs ADD COLUMN IF NOT EXISTS emoji VARCHAR(10) NOT NULL DEFAULT '📦'`);
  await pool.query(`ALTER TABLE packs ADD COLUMN IF NOT EXISTS color_fondo TEXT NOT NULL DEFAULT 'linear-gradient(135deg, #1c3829 0%, #2a5540 100%)'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pack_productos (
      pack_id     INTEGER NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      cantidad    INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (pack_id, producto_id)
    )
  `);

  // ─── Seed 10 packs (solo si la tabla está vacía) ──────────────────────────
  const packsCount = await pool.query(`SELECT COUNT(*) FROM packs`);
  if (parseInt(packsCount.rows[0].count, 10) === 0) {
    // Insertar packs base
    const packRows = await pool.query(`
      INSERT INTO packs (nombre, descripcion, precio, emoji, color_fondo, activo, orden) VALUES
        ('Pack Asado',           'Cerveza, vino y pisco para la parrilla perfecta',          12990, '🍖', 'linear-gradient(135deg, #6B1A1A 0%, #B84A00 100%)', true,  0),
        ('Pack Cena Romántica',  'Dos vinos premium para una noche especial',                 9990, '🥂', 'linear-gradient(135deg, #4a1040 0%, #8B1A1A 100%)', true,  1),
        ('Pack Whisky & Cola',   'Johnnie Walker Red Label con Coca-Cola',                   21490, '🥃', 'linear-gradient(135deg, #1a1a2e 0%, #4a3010 100%)', true,  2),
        ('Pack Pisco Sour',      'Todo lo que necesitas para un pisco sour perfecto',         6490, '🍸', 'linear-gradient(135deg, #2a1a5c 0%, #4d35a0 100%)', true,  3),
        ('Pack Mojito',          'Bacardí, agua mineral y Coca-Cola listos para el mojito',  15990, '🍹', 'linear-gradient(135deg, #0a3d1f 0%, #1a7a3a 100%)', true,  4),
        ('Pack Sin Alcohol',     'Refrescos y agua para todos los gustos',                    4990, '🥤', 'linear-gradient(135deg, #1a4a6e 0%, #2d7ab5 100%)', true,  5),
        ('Pack Vinos Surtidos',  'Una selección de tintos para disfrutar en buena compañía', 14990, '🍷', 'linear-gradient(135deg, #4a1040 0%, #8B1A1A 100%)', true,  6),
        ('Pack Cuba Libre',      'Bacardí y Coca-Cola, la combinación clásica',              14990, '🍹', 'linear-gradient(135deg, #3d1515 0%, #8B3014 100%)', true,  7),
        ('Pack Vodka Party',     'Absolut y Smirnoff para tu próxima fiesta',                24990, '🫧', 'linear-gradient(135deg, #1a2a3d 0%, #2d4f7a 100%)', true,  8),
        ('Pack Cervecero',       'Lo mejor de la cerveza nacional e importada',               9990, '🍺', 'linear-gradient(135deg, #a56323 0%, #D4A017 100%)', true,  9)
      RETURNING id, nombre, orden
    `);

    // Mapear nombre → id para asignar productos
    const pid = (nombre: string) => packRows.rows.find((r: {id: number; nombre: string}) => r.nombre === nombre)?.id;

    // pack_productos: [pack_nombre, producto_id, cantidad]
    const asignaciones: [string, number, number][] = [
      // Pack Asado: Cristal 6-Pack(5) + Gato Negro(4) + Capel 35°(13)
      ['Pack Asado', 5, 1], ['Pack Asado', 4, 1], ['Pack Asado', 13, 1],
      // Pack Cena Romántica: Escudo Rojo(2) + Santa Helena Chardonnay(3)
      ['Pack Cena Romántica', 2, 1], ['Pack Cena Romántica', 3, 1],
      // Pack Whisky & Cola: JW Red Label(9) + Coca-Cola 6-Pack(19)
      ['Pack Whisky & Cola', 9, 1], ['Pack Whisky & Cola', 19, 1],
      // Pack Pisco Sour: Capel 35°(13) + Agua Mineral x2(20)
      ['Pack Pisco Sour', 13, 1], ['Pack Pisco Sour', 20, 2],
      // Pack Mojito: Bacardí(15) + Coca-Cola(19) + Agua Mineral(20)
      ['Pack Mojito', 15, 1], ['Pack Mojito', 19, 1], ['Pack Mojito', 20, 1],
      // Pack Sin Alcohol: Coca-Cola 6-Pack(19) + Agua Mineral x2(20)
      ['Pack Sin Alcohol', 19, 1], ['Pack Sin Alcohol', 20, 2],
      // Pack Vinos Surtidos: Casillero(1) + Escudo Rojo(2) + Gato Negro(4)
      ['Pack Vinos Surtidos', 1, 1], ['Pack Vinos Surtidos', 2, 1], ['Pack Vinos Surtidos', 4, 1],
      // Pack Cuba Libre: Bacardí(15) + Coca-Cola 6-Pack(19)
      ['Pack Cuba Libre', 15, 1], ['Pack Cuba Libre', 19, 1],
      // Pack Vodka Party: Absolut(17) + Smirnoff(18)
      ['Pack Vodka Party', 17, 1], ['Pack Vodka Party', 18, 1],
      // Pack Cervecero: Cristal(5) + Heineken x2(7) + Kunstmann(6)
      ['Pack Cervecero', 5, 1], ['Pack Cervecero', 7, 2], ['Pack Cervecero', 6, 1],
    ];

    for (const [nombre, productoId, cantidad] of asignaciones) {
      const packId = pid(nombre);
      if (packId) {
        await pool.query(
          `INSERT INTO pack_productos (pack_id, producto_id, cantidad) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [packId, productoId, cantidad]
        );
      }
    }
    console.log('✅ 10 packs iniciales creados');
  }

  // ─── Promos ────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promos (
      id          SERIAL PRIMARY KEY,
      nombre      VARCHAR(200) NOT NULL,
      descripcion TEXT,
      tipo        VARCHAR(50) NOT NULL DEFAULT 'general',
      activo      BOOLEAN NOT NULL DEFAULT true,
      orden       INTEGER NOT NULL DEFAULT 0,
      creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_productos (
      promo_id    INTEGER NOT NULL REFERENCES promos(id) ON DELETE CASCADE,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      PRIMARY KEY (promo_id, producto_id)
    )
  `);

  // ─── Productos y packs adicionales (migración safe) ──────────────────────
  const pId: Record<string, number> = {};
  const allProds = await pool.query(`SELECT id, nombre FROM productos`);
  for (const r of allProds.rows) pId[r.nombre] = r.id;

  const upsertProd = async (
    nombre: string, marca: string, precio: number, precioOriginal: number | null,
    categoria: string, descripcion: string, grados: number, volumen: string,
    emoji: string, colorFondo: string, stock: number, topVentas = false, promocion: string | null = null
  ) => {
    const r = await pool.query(
      `INSERT INTO productos (nombre, marca, precio, precio_original, categoria, descripcion, grados, volumen, emoji, color_fondo, stock, top_ventas, promocion)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
       WHERE NOT EXISTS (SELECT 1 FROM productos WHERE nombre = $1 AND marca = $2)
       RETURNING id`,
      [nombre, marca, precio, precioOriginal, categoria, descripcion, grados, volumen, emoji, colorFondo, stock, topVentas, promocion]
    );
    pId[nombre] = r.rows.length > 0 ? r.rows[0].id
      : (await pool.query(`SELECT id FROM productos WHERE nombre=$1 AND marca=$2`, [nombre, marca])).rows[0].id;
  };

  await upsertProd('Carménère Santa Ema Reserva', 'Santa Ema', 4990, null, 'Vinos', 'Carménère característico con notas de pimienta, ciruela y hierbas verdes.', 14.0, '750ml', '🍷', 'linear-gradient(135deg, #3d0c2a 0%, #6b1a45 100%)', 28);
  await upsertProd('Sauvignon Blanc Veramonte', 'Veramonte', 4490, null, 'Vinos', 'Blanco fresco del Valle de Casablanca con notas de limón, pomelo y hierbas.', 12.5, '750ml', '🥂', 'linear-gradient(135deg, #5c6b1a 0%, #9eb030 100%)', 35);
  await upsertProd('Montes Alpha Cabernet Sauvignon', 'Montes', 9990, 12990, 'Vinos', 'Ícono chileno de clase mundial, 12 meses en barrica de roble francés.', 14.5, '750ml', '🍷', 'linear-gradient(135deg, #5c1a1a 0%, #9e2b2b 100%)', 18, false, 'descuento');
  await upsertProd('Matetic Rosé EQ', 'Matetic', 5490, null, 'Vinos', 'Rosé elegante del Valle de Rosario con carácter frutal y acidez vibrante.', 12.0, '750ml', '🌸', 'linear-gradient(135deg, #8B3a5c 0%, #c96090 100%)', 22);
  await upsertProd('Sunrise Chardonnay', 'Concha y Toro', 3990, null, 'Vinos', 'Chardonnay suave y versátil con notas tropicales y un toque de madera.', 12.5, '750ml', '🥂', 'linear-gradient(135deg, #7a7020 0%, #c4b835 100%)', 30);
  await upsertProd('Don Melchor', 'Concha y Toro', 69990, null, 'Vinos', 'El vino ícono de Chile. Cabernet Sauvignon de clase mundial del Alto Maipo.', 14.5, '750ml', '🍷', 'linear-gradient(135deg, #1a0a0a 0%, #4a1515 100%)', 6, true);
  await upsertProd('Corona Extra', 'Corona', 1490, null, 'Cervezas', 'La cerveza mexicana más icónica, ligera y refrescante. Sírvela con limón.', 4.5, '355ml', '🍺', 'linear-gradient(135deg, #8B8000 0%, #d4bc00 100%)', 42, true);
  await upsertProd('Stella Artois', 'AB InBev', 1790, null, 'Cervezas', 'Pilsner belga premium con siglos de tradición. Elegante y sofisticada.', 5.0, '330ml', '🍺', 'linear-gradient(135deg, #2a1a0a 0%, #5c3a18 100%)', 38);
  await upsertProd('Budweiser Lager', 'Anheuser-Busch', 1590, null, 'Cervezas', 'La cerveza americana más famosa del mundo. Suave, limpia y refrescante.', 5.0, '355ml', '🍺', 'linear-gradient(135deg, #8B0a0a 0%, #cc1515 100%)', 44);
  await upsertProd('Leffe Blonde', 'AB InBev', 2490, null, 'Cervezas', 'Abadía belga con notas de naranja, clavo y dulzor especiado singular.', 6.6, '330ml', '🍺', 'linear-gradient(135deg, #8B6800 0%, #d4a500 100%)', 16);
  await upsertProd('Guinness Draught', 'Guinness', 2990, null, 'Cervezas', 'La stout irlandesa más emblemática del mundo. Cremosa con notas de cacao y café.', 4.2, '440ml', '🍺', 'linear-gradient(135deg, #0a0a0a 0%, #2a2a2a 100%)', 20);
  await upsertProd('Royal Guard IPA', 'Cervecería Austral', 2190, null, 'Cervezas', 'IPA artesanal chilena con aroma a frutas tropicales y amargor pronunciado.', 6.0, '500ml', '🍺', 'linear-gradient(135deg, #1a3d1a 0%, #2d6b2d 100%)', 14);
  await upsertProd('Chivas Regal 12 años', 'Chivas Brothers', 28990, 33990, 'Whisky', 'Blend premium escocés con 12 años de maduración. Suave, rico y generoso.', 40.0, '750ml', '🥃', 'linear-gradient(135deg, #8B6900 0%, #d4a800 100%)', 12, true, 'descuento');
  await upsertProd("Jack Daniel's Old No. 7", "Jack Daniel's", 22990, null, 'Whisky', 'Tennessee Whiskey filtrado por carbón de arce. Suave, afrutado y con vainilla.', 40.0, '750ml', '🥃', 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', 14, true);
  await upsertProd('Glenfiddich 12 años', 'William Grant & Sons', 39990, 44990, 'Whisky', 'El single malt más premiado del mundo. Peras, roble y un toque de avellana.', 40.0, '750ml', '🥃', 'linear-gradient(135deg, #2a4a1a 0%, #4a8030 100%)', 8, false, 'descuento');
  await upsertProd('Mistral Doble Destilado 40°', 'Mistral', 7490, null, 'Pisco', 'Pisco doble destilado de uva moscatel, suave y muy aromático.', 40.0, '700ml', '🍸', 'linear-gradient(135deg, #3d1a5c 0%, #6b30a0 100%)', 26);
  await upsertProd('Los Nichos Gran Reserva 43°', 'Los Nichos', 15990, null, 'Pisco', 'Gran pisco artesanal del Elqui, envejecido en roble americano. Perfil complejo.', 43.0, '700ml', '🍸', 'linear-gradient(135deg, #1a0a3d 0%, #35186b 100%)', 10);
  await upsertProd('Havana Club Añejo 3 años', 'Havana Club', 11990, null, 'Ron', 'Ron cubano joven con aromas frescos a caña y notas de banana y vainilla.', 40.0, '750ml', '🍹', 'linear-gradient(135deg, #5c2a0a 0%, #a04f1a 100%)', 18);
  await upsertProd('Captain Morgan Spiced Gold', 'Diageo', 14990, null, 'Ron', 'Ron especiado jamaicano con vainilla, canela y notas de caramelo.', 35.0, '750ml', '🍹', 'linear-gradient(135deg, #6B1a00 0%, #b03000 100%)', 16);
  await upsertProd('Ciroc Original', 'Diageo', 29990, null, 'Vodka', 'Vodka ultrapremium destilado 5 veces de uvas finas francesas. Suave y frutal.', 40.0, '750ml', '🫧', 'linear-gradient(135deg, #1a1a5c 0%, #2d2da0 100%)', 12);
  await upsertProd('Ketel One', 'Nolet', 19990, null, 'Vodka', 'Vodka artesanal holandés destilado en alambique de cobre. Excepcional pureza.', 40.0, '750ml', '🫧', 'linear-gradient(135deg, #0a1a5c 0%, #1a309e 100%)', 10);
  await upsertProd('Red Bull Energy Drink', 'Red Bull', 1990, null, 'Sin Alcohol', 'Bebida energizante que revitaliza la mente y el cuerpo. El original.', 0, '250ml', '⚡', 'linear-gradient(135deg, #8B8B00 0%, #cccc00 100%)', 48);
  await upsertProd("Watt's Mix Tropical", "Watt's", 890, null, 'Sin Alcohol', 'Jugo de frutas tropicales naturales, sin azúcar añadida.', 0, '1L', '🧃', 'linear-gradient(135deg, #5c8B00 0%, #9ecc00 100%)', 55);
  await upsertProd('Schweppes Indian Tonic', 'Schweppes', 1190, null, 'Sin Alcohol', 'Agua tónica clásica con quina natural. Perfecta para cócteles.', 0, '350ml', '🫧', 'linear-gradient(135deg, #1a5c8B 0%, #2d9ecc 100%)', 40);
  await upsertProd('Sprite 6-Pack', 'Coca-Cola', 3990, null, 'Sin Alcohol', 'Pack de 6 latas de la bebida cítrica más refrescante, sin cafeína.', 0, '6 x 355ml', '🥤', 'linear-gradient(135deg, #1a8B1a 0%, #2dcc2d 100%)', 35);
  console.log('✅ Productos adicionales sincronizados');

  // ─── Packs adicionales ────────────────────────────────────────────────────
  const upsertPack = async (
    nombre: string, descripcion: string, precio: number, emoji: string, colorFondo: string, orden: number,
    productos: Array<[string, number]>
  ) => {
    const r = await pool.query(
      `INSERT INTO packs (nombre, descripcion, precio, emoji, color_fondo, activo, orden)
       SELECT $1,$2,$3,$4,$5,true,$6
       WHERE NOT EXISTS (SELECT 1 FROM packs WHERE nombre = $1)
       RETURNING id`,
      [nombre, descripcion, precio, emoji, colorFondo, orden]
    );
    if (r.rows.length === 0) return;
    const packId = r.rows[0].id;
    for (const [prodNombre, cantidad] of productos) {
      const prodId = pId[prodNombre];
      if (prodId) await pool.query(
        `INSERT INTO pack_productos (pack_id, producto_id, cantidad) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [packId, prodId, cantidad]
      );
    }
  };

  await upsertPack('Pack Día de Campo', 'Rosé, cervezas frías y agua para el picnic perfecto', 12990, '🌿', 'linear-gradient(135deg, #3a6b1a 0%, #6bb030 100%)', 10, [['Matetic Rosé EQ', 1], ['Cristal Lager 6-Pack', 1], ['Agua Mineral Cachantun', 2]]);
  await upsertPack('Pack After Party', 'Vodka premium y energéticas para seguir la noche', 29990, '🎉', 'linear-gradient(135deg, #1a0a3d 0%, #4a18a0 100%)', 11, [['Absolut Original', 1], ['Smirnoff No. 21', 1], ['Red Bull Energy Drink', 4]]);
  await upsertPack('Pack Noche de Whisky', 'Los mejores blends para una velada sofisticada', 44990, '🥃', 'linear-gradient(135deg, #1a1000 0%, #4a3000 100%)', 12, [["Jack Daniel's Old No. 7", 1], ['Chivas Regal 12 años', 1]]);
  await upsertPack('Pack Ron Tropical', 'Ron cubano y especiado con jugo tropical', 19990, '🌴', 'linear-gradient(135deg, #3d1a00 0%, #8B4a00 100%)', 13, [['Havana Club Añejo 3 años', 1], ['Captain Morgan Spiced Gold', 1], ["Watt's Mix Tropical", 2]]);
  await upsertPack('Pack Vinos Premium', 'Selección de los mejores tintos chilenos', 24990, '🏆', 'linear-gradient(135deg, #3d0a0a 0%, #8B1a1a 100%)', 14, [['Montes Alpha Cabernet Sauvignon', 1], ['Escudo Rojo Reserva', 1], ['Casillero del Diablo Cab. Sauv.', 1]]);
  await upsertPack('Pack Fiesta Cervecera', 'Las mejores cervezas importadas para tu reunión', 16990, '🎊', 'linear-gradient(135deg, #1a3d1a 0%, #2d7a2d 100%)', 15, [['Corona Extra', 2], ['Stella Artois', 2], ['Heineken Lager', 2]]);
  await upsertPack('Pack Pisco Premium', 'Los mejores piscos chilenos en un solo pack', 22990, '🌟', 'linear-gradient(135deg, #2a0a4a 0%, #5a1a8B 100%)', 16, [['Pisco ABA 40°', 1], ['Tres Erres Gran Pisco', 1], ['Mistral Doble Destilado 40°', 1]]);
  await upsertPack('Pack Clásico Chileno', 'El sabor de Chile: buen vino, cerveza y pisco', 13990, '🇨🇱', 'linear-gradient(135deg, #0a1a4a 0%, #1a3a8B 100%)', 17, [['Carménère Santa Ema Reserva', 1], ['Cristal Lager 6-Pack', 1], ['Capel Especial 35°', 1]]);
  await upsertPack('Pack Importados Elite', 'Selección premium de lo mejor del mundo', 59990, '💎', 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3d 100%)', 18, [['Glenfiddich 12 años', 1], ['Ciroc Original', 1], ['Ketel One', 1]]);
  await upsertPack('Pack Aperitivo', 'Vodka artesanal con tónica para el aperitivo perfecto', 14990, '🍋', 'linear-gradient(135deg, #0a2a4a 0%, #1a5a8B 100%)', 19, [['Ketel One', 1], ['Schweppes Indian Tonic', 3]]);
  console.log('✅ Packs adicionales sincronizados');

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

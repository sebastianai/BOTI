CREATE TABLE IF NOT EXISTS categorias (
  id VARCHAR(50) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  emoji VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  marca VARCHAR(100) NOT NULL,
  precio INTEGER NOT NULL,
  precio_original INTEGER,
  categoria VARCHAR(50) NOT NULL REFERENCES categorias(id),
  descripcion TEXT NOT NULL,
  grados NUMERIC(4,1) NOT NULL DEFAULT 0,
  volumen VARCHAR(50) NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  color_fondo TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  imagen TEXT,
  top_ventas BOOLEAN DEFAULT false,
  promocion VARCHAR(50)
);

INSERT INTO categorias (id, nombre, emoji) VALUES
  ('Vinos', 'Vinos', '🍷'),
  ('Cervezas', 'Cervezas', '🍺'),
  ('Whisky', 'Whisky', '🥃'),
  ('Pisco', 'Pisco', '🍸'),
  ('Ron', 'Ron', '🍹'),
  ('Vodka', 'Vodka', '🫧'),
  ('Sin Alcohol', 'Sin Alcohol', '🥤');

INSERT INTO productos (nombre, marca, precio, precio_original, categoria, descripcion, grados, volumen, emoji, color_fondo, stock, top_ventas, promocion) VALUES
  ('Casillero del Diablo Cab. Sauv.', 'Concha y Toro', 5990, NULL, 'Vinos', 'Tinto con aromas a frutos negros, especias y un toque de roble.', 13.5, '750ml', '🍷', 'linear-gradient(135deg, #4a1040 0%, #8B1A1A 100%)', 24, false, '2x1'),
  ('Escudo Rojo Reserva', 'Baron Philippe de Rothschild', 7990, 9990, 'Vinos', 'Blend premium con carácter robusto y aromas de frutos negros.', 14.0, '750ml', '🍷', 'linear-gradient(135deg, #6B0F1A 0%, #A23030 100%)', 15, false, '3x2'),
  ('Santa Helena Chardonnay', 'Santa Helena', 3490, NULL, 'Vinos', 'Blanco refrescante con notas de durazno, pera y un toque de madera.', 12.5, '750ml', '🥂', 'linear-gradient(135deg, #7a6520 0%, #c4a832 100%)', 30, false, NULL),
  ('Gato Negro Merlot', 'San Pedro', 2990, NULL, 'Vinos', 'Suave y afrutado, con notas de ciruelas y chocolate negro.', 13.0, '750ml', '🍷', 'linear-gradient(135deg, #3d0c1f 0%, #7a1a3a 100%)', 40, false, NULL),
  ('Cristal Lager 6-Pack', 'Cervecería CCU', 5490, NULL, 'Cervezas', 'La clásica cerveza chilena. Pack de 6 latas formato familiar.', 5.0, '6 x 355ml', '🍺', 'linear-gradient(135deg, #a56323 0%, #D4A017 100%)', 50, false, NULL),
  ('Kunstmann Torobayo', 'Kunstmann', 2490, NULL, 'Cervezas', 'Cerveza artesanal estilo Märzen con carácter malteado y color ámbar.', 5.5, '500ml', '🍺', 'linear-gradient(135deg, #8B5e0a 0%, #c48020 100%)', 20, false, NULL),
  ('Heineken Lager', 'Heineken', 1990, NULL, 'Cervezas', 'Cerveza premium holandesa de sabor suave y equilibrado.', 5.0, '330ml', '🍺', 'linear-gradient(135deg, #1a5c1a 0%, #2d8f2d 100%)', 36, false, NULL),
  ('Escudo Cerveza', 'CCU', 1390, NULL, 'Cervezas', 'Cerveza lager suave y refrescante, ideal para el día a día.', 5.0, '355ml', '🍺', 'linear-gradient(135deg, #5c3d1a 0%, #9e6b30 100%)', 48, false, NULL),
  ('Johnnie Walker Red Label', 'Johnnie Walker', 19990, NULL, 'Whisky', 'El blend escocés más vendido del mundo. Ahumado, especiado y persistente.', 40.0, '750ml', '🥃', 'linear-gradient(135deg, #3d2b1f 0%, #8B6914 100%)', 18, false, NULL),
  ('Johnnie Walker Black Label', 'Johnnie Walker', 34990, 39990, 'Whisky', 'Envejecido 12 años. Complejo y suave con notas de frutas y turba leve.', 40.0, '750ml', '🥃', 'linear-gradient(135deg, #1a1a2e 0%, #2d2d4a 100%)', 10, false, NULL),
  ('Old Parr 12 años', 'Old Parr', 29990, NULL, 'Whisky', 'Blend suave con notas de miel, vainilla y un toque de turba.', 40.0, '750ml', '🥃', 'linear-gradient(135deg, #4a3010 0%, #8B5e28 100%)', 8, false, NULL),
  ('Pisco ABA 40°', 'ABA', 8990, NULL, 'Pisco', 'Pisco chileno premium, doble destilación. Suave y muy aromático.', 40.0, '700ml', '🍸', 'linear-gradient(135deg, #1a3a5c 0%, #2d6a9f 100%)', 22, false, NULL),
  ('Capel Especial 35°', 'Capel', 5990, NULL, 'Pisco', 'El clásico pisco del norte, ideal para preparar un buen pisco sour.', 35.0, '700ml', '🍸', 'linear-gradient(135deg, #2a1a5c 0%, #4d35a0 100%)', 30, false, NULL),
  ('Tres Erres Gran Pisco', 'Tres Erres', 12990, NULL, 'Pisco', 'Gran pisco envejecido con bouquet complejo y elegante. Premiado internacionalmente.', 43.0, '700ml', '🍸', 'linear-gradient(135deg, #3d1a5c 0%, #6b30a0 100%)', 12, false, NULL),
  ('Bacardí Carta Blanca', 'Bacardí', 12990, NULL, 'Ron', 'Ron blanco suave, base perfecta para daiquirís y mojitos.', 37.5, '750ml', '🍹', 'linear-gradient(135deg, #3d1515 0%, #8B3014 100%)', 14, false, NULL),
  ('Flor de Caña 7 años', 'Flor de Caña', 16990, 19990, 'Ron', 'Ron añejo nicaragüense premiado mundialmente. Notas de caramelo y vainilla.', 40.0, '750ml', '🍹', 'linear-gradient(135deg, #5c2a0a 0%, #a04f1a 100%)', 16, false, NULL),
  ('Absolut Original', 'Absolut', 15990, NULL, 'Vodka', 'Vodka sueco de pureza excepcional, destilado continuamente desde 1879.', 40.0, '750ml', '🫧', 'linear-gradient(135deg, #1a2a3d 0%, #2d4f7a 100%)', 20, false, NULL),
  ('Smirnoff No. 21', 'Smirnoff', 11990, NULL, 'Vodka', 'El vodka más vendido del mundo, triple destilado y filtrado en carbón.', 37.5, '750ml', '🫧', 'linear-gradient(135deg, #1a1a3d 0%, #2d2d7a 100%)', 25, false, NULL),
  ('Coca-Cola 6-Pack', 'Coca-Cola', 3990, NULL, 'Sin Alcohol', 'Pack de 6 latas de la bebida más icónica y refrescante del mundo.', 0, '6 x 355ml', '🥤', 'linear-gradient(135deg, #8B0000 0%, #cc0000 100%)', 60, false, NULL),
  ('Agua Mineral Cachantun', 'Cachantun', 990, NULL, 'Sin Alcohol', 'Agua mineral natural extraída de las profundidades de los Andes chilenos.', 0, '1.5L', '💧', 'linear-gradient(135deg, #1a4a6e 0%, #2d7ab5 100%)', 100, false, NULL),
  -- Vinos adicionales
  ('Carménère Santa Ema Reserva', 'Santa Ema', 4990, NULL, 'Vinos', 'Carménère característico con notas de pimienta, ciruela y hierbas verdes.', 14.0, '750ml', '🍷', 'linear-gradient(135deg, #3d0c2a 0%, #6b1a45 100%)', 28, false, NULL),
  ('Sauvignon Blanc Veramonte', 'Veramonte', 4490, NULL, 'Vinos', 'Blanco fresco del Valle de Casablanca con notas de limón, pomelo y hierbas.', 12.5, '750ml', '🥂', 'linear-gradient(135deg, #5c6b1a 0%, #9eb030 100%)', 35, false, NULL),
  ('Montes Alpha Cabernet Sauvignon', 'Montes', 9990, 12990, 'Vinos', 'Ícono chileno de clase mundial, 12 meses en barrica de roble francés.', 14.5, '750ml', '🍷', 'linear-gradient(135deg, #5c1a1a 0%, #9e2b2b 100%)', 18, false, 'descuento'),
  ('Matetic Rosé EQ', 'Matetic', 5490, NULL, 'Vinos', 'Rosé elegante del Valle de Rosario con carácter frutal y acidez vibrante.', 12.0, '750ml', '🌸', 'linear-gradient(135deg, #8B3a5c 0%, #c96090 100%)', 22, false, NULL),
  ('Sunrise Chardonnay', 'Concha y Toro', 3990, NULL, 'Vinos', 'Chardonnay suave y versátil con notas tropicales y un toque de madera.', 12.5, '750ml', '🥂', 'linear-gradient(135deg, #7a7020 0%, #c4b835 100%)', 30, false, NULL),
  ('Don Melchor', 'Concha y Toro', 69990, NULL, 'Vinos', 'El vino ícono de Chile. Cabernet Sauvignon de clase mundial del Alto Maipo.', 14.5, '750ml', '🍷', 'linear-gradient(135deg, #1a0a0a 0%, #4a1515 100%)', 6, true, NULL),
  -- Cervezas adicionales
  ('Corona Extra', 'Corona', 1490, NULL, 'Cervezas', 'La cerveza mexicana más icónica, ligera y refrescante. Sírvela con limón.', 4.5, '355ml', '🍺', 'linear-gradient(135deg, #8B8000 0%, #d4bc00 100%)', 42, true, NULL),
  ('Stella Artois', 'AB InBev', 1790, NULL, 'Cervezas', 'Pilsner belga premium con siglos de tradición. Elegante y sofisticada.', 5.0, '330ml', '🍺', 'linear-gradient(135deg, #2a1a0a 0%, #5c3a18 100%)', 38, false, NULL),
  ('Budweiser Lager', 'Anheuser-Busch', 1590, NULL, 'Cervezas', 'La cerveza americana más famosa del mundo. Suave, limpia y refrescante.', 5.0, '355ml', '🍺', 'linear-gradient(135deg, #8B0a0a 0%, #cc1515 100%)', 44, false, NULL),
  ('Leffe Blonde', 'AB InBev', 2490, NULL, 'Cervezas', 'Abadía belga con notas de naranja, clavo y dulzor especiado singular.', 6.6, '330ml', '🍺', 'linear-gradient(135deg, #8B6800 0%, #d4a500 100%)', 16, false, NULL),
  ('Guinness Draught', 'Guinness', 2990, NULL, 'Cervezas', 'La stout irlandesa más emblemática del mundo. Cremosa con notas de cacao y café.', 4.2, '440ml', '🍺', 'linear-gradient(135deg, #0a0a0a 0%, #2a2a2a 100%)', 20, false, NULL),
  ('Royal Guard IPA', 'Cervecería Austral', 2190, NULL, 'Cervezas', 'IPA artesanal chilena con aroma a frutas tropicales y amargor pronunciado.', 6.0, '500ml', '🍺', 'linear-gradient(135deg, #1a3d1a 0%, #2d6b2d 100%)', 14, false, NULL),
  -- Whisky adicional
  ('Chivas Regal 12 años', 'Chivas Brothers', 28990, 33990, 'Whisky', 'Blend premium escocés con 12 años de maduración. Suave, rico y generoso.', 40.0, '750ml', '🥃', 'linear-gradient(135deg, #8B6900 0%, #d4a800 100%)', 12, true, 'descuento'),
  ('Jack Daniel''s Old No. 7', 'Jack Daniel''s', 22990, NULL, 'Whisky', 'Tennessee Whiskey filtrado por carbón de arce. Suave, afrutado y con vainilla.', 40.0, '750ml', '🥃', 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', 14, true, NULL),
  ('Glenfiddich 12 años', 'William Grant & Sons', 39990, 44990, 'Whisky', 'El single malt más premiado del mundo. Peras, roble y un toque de avellana.', 40.0, '750ml', '🥃', 'linear-gradient(135deg, #2a4a1a 0%, #4a8030 100%)', 8, false, 'descuento'),
  -- Pisco adicional
  ('Mistral Doble Destilado 40°', 'Mistral', 7490, NULL, 'Pisco', 'Pisco doble destilado de uva moscatel, suave y muy aromático.', 40.0, '700ml', '🍸', 'linear-gradient(135deg, #3d1a5c 0%, #6b30a0 100%)', 26, false, NULL),
  ('Los Nichos Gran Reserva 43°', 'Los Nichos', 15990, NULL, 'Pisco', 'Gran pisco artesanal del Elqui, envejecido en roble americano. Perfil complejo.', 43.0, '700ml', '🍸', 'linear-gradient(135deg, #1a0a3d 0%, #35186b 100%)', 10, false, NULL),
  -- Ron adicional
  ('Havana Club Añejo 3 años', 'Havana Club', 11990, NULL, 'Ron', 'Ron cubano joven con aromas frescos a caña y notas de banana y vainilla.', 40.0, '750ml', '🍹', 'linear-gradient(135deg, #5c2a0a 0%, #a04f1a 100%)', 18, false, NULL),
  ('Captain Morgan Spiced Gold', 'Diageo', 14990, NULL, 'Ron', 'Ron especiado jamaicano con vainilla, canela y notas de caramelo.', 35.0, '750ml', '🍹', 'linear-gradient(135deg, #6B1a00 0%, #b03000 100%)', 16, false, NULL),
  -- Vodka adicional
  ('Ciroc Original', 'Diageo', 29990, NULL, 'Vodka', 'Vodka ultrapremium destilado 5 veces de uvas finas francesas. Suave y frutal.', 40.0, '750ml', '🫧', 'linear-gradient(135deg, #1a1a5c 0%, #2d2da0 100%)', 12, false, NULL),
  ('Ketel One', 'Nolet', 19990, NULL, 'Vodka', 'Vodka artesanal holandés destilado en alambique de cobre. Excepcional pureza.', 40.0, '750ml', '🫧', 'linear-gradient(135deg, #0a1a5c 0%, #1a309e 100%)', 10, false, NULL),
  -- Sin Alcohol adicional
  ('Red Bull Energy Drink', 'Red Bull', 1990, NULL, 'Sin Alcohol', 'Bebida energizante que revitaliza la mente y el cuerpo. El original.', 0, '250ml', '⚡', 'linear-gradient(135deg, #8B8B00 0%, #cccc00 100%)', 48, false, NULL),
  ('Watt''s Mix Tropical', 'Watt''s', 890, NULL, 'Sin Alcohol', 'Jugo de frutas tropicales naturales, sin azúcar añadida.', 0, '1L', '🧃', 'linear-gradient(135deg, #5c8B00 0%, #9ecc00 100%)', 55, false, NULL),
  ('Schweppes Indian Tonic', 'Schweppes', 1190, NULL, 'Sin Alcohol', 'Agua tónica clásica con quina natural. Perfecta para cócteles.', 0, '350ml', '🫧', 'linear-gradient(135deg, #1a5c8B 0%, #2d9ecc 100%)', 40, false, NULL),
  ('Sprite 6-Pack', 'Coca-Cola', 3990, NULL, 'Sin Alcohol', 'Pack de 6 latas de la bebida cítrica más refrescante, sin cafeína.', 0, '6 x 355ml', '🥤', 'linear-gradient(135deg, #1a8B1a 0%, #2dcc2d 100%)', 35, false, NULL);

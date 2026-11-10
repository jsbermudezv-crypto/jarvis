# JARVIS — Personal Performance Intelligence

App personal de entreno, nutrición, mercado y rugby. Funciona 100 % en el teléfono: sin servidores, sin claves de API, sin costos y sin conexión (después de abrirla la primera vez).

## Qué trae

- **Cerebro local**: chat que entiende preguntas en español ("¿qué entreno hoy?", "¿qué almuerzo?", "comí arroz con pollo y ensalada", "¿cuántas calorías tiene una arepa con queso?", "solo tengo 20 minutos", "receta de lentejas").
- **Base de alimentos**: 145 alimentos y platos colombianos con porción típica, calorías y macros (`js/foods.js`).
- **Recetario**: 36 recetas saludables colombianas con macros calculados desde la base de alimentos (`js/recipes.js`).
- **Menús**: arma el día, 3 días o la semana ajustando porciones a tus calorías, días de rugby, gustos y lo que tienes en casa, con lista de compras por tienda.
- **Guías**: plato saludable, porciones con la mano, cambios bajos en grasa, proteína, rugby, digestión, saciedad y más (`js/guides.js`).
- **Memoria y aprendizaje**: aprende tus horarios, tus alimentos frecuentes, tus porciones reales y tus gustos en recetas; evita lo que le dices que no te gusta.
- **Mercado conectado a tus tiendas**: catálogo de 120 productos por pasillo en D1, Ara, Éxito, Olímpica, Jumbo, Carulla, Makro, frutería, plaza, carnicería y tienda de barrio (`js/catalog.js`); **modo compra** con total en vivo, presupuesto y qué tan sano va el carrito; **gastos y consciencia**: en qué se va la plata, gasto en mecato, precios que suben y dónde está más barato, todo con tus precios reales.
- **Escáner de mercado**: lee códigos de barras en el teléfono (EAN-13, EAN-8, UPC; `js/barcode.js`), busca el producto en Open Food Facts y recuerda los que nombras; productos sin código con foto; facturas por foto (beta) o a mano (`js/scan.js`).
- **Voz masculina** seleccionable con tono JARVIS (JARVIS → Voz).
- Entreno con programa de 4 semanas, animaciones y reglas de seguridad para el hombro; misión diaria, chequeo, progreso, recordatorios y voz.

## Estructura

```
index.html            la app
js/store.js           guardado en el teléfono
js/foods.js           base de alimentos
js/recipes.js         recetario
js/guides.js          guías de nutrición
js/brain.js           cerebro local (chat, menús, aprendizaje, biblioteca)
js/catalog.js         catálogo de productos por tienda
js/plus.js            inicio 2.0, voz, tiendas, modo compra y gastos
js/barcode.js         lector de códigos de barras
js/scan.js            escáner de productos y facturas
css/theme.css         tema visual 2.0
sw.js                 funcionamiento sin conexión
manifest.webmanifest  instalación como app
icons/ splash/        ícono y pantallas de inicio del iPhone
```

## Publicar en GitHub Pages

1. Sube todo el contenido de esta carpeta al repositorio (incluye `.nojekyll`).
2. **Settings → Pages**: *Deploy from a branch*, `main`, `/ (root)`, **Save**.
3. Queda en `https://jsbermudezv-crypto.github.io/jarvis/`.

## Instalar en el iPhone

Abre la dirección en **Safari → Compartir → Agregar a pantalla de inicio**. Ábrela siempre desde el ícono: así tus datos quedan guardados de forma permanente.

## Actualizar

Edita los archivos y súbelos de nuevo. En `sw.js` cambia `VERSION` (por ejemplo `jarvis-v2`) para que el teléfono descargue la versión nueva.

## Datos

Todo queda en el teléfono. Respaldo: **Perfil y ajustes → Exportar mis datos**. Para pasarlos a otro dispositivo: **Importar**.

Los valores nutricionales son estimados de referencia. No reemplazan a tu médico ni a tu nutricionista.

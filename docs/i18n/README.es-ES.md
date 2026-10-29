# Property Order

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

Controla las sugerencias y los valores de listas en las propiedades de Obsidian.

- **[Sugerencias de nombres de propiedades](#sugerencias-de-nombres-de-propiedades):** fija, oculta, agrupa y ordena nombres como `status` y `owner` al añadir una propiedad.
- **[Sugerencias de valores de propiedades](#sugerencias-de-valores-de-propiedades):** elige cómo se sugieren los valores de cada propiedad, incluidos valores predefinidos como `todo`, `doing` y `done`.
- **[Reordenar valores de listas](#reordenar-valores-de-listas):** arrastra o usa la paleta de comandos para reordenar elementos o moverlos entre propiedades compatibles de la misma nota.

Estas funciones son independientes. Property Order gestiona sugerencias y valores de listas; no reorganiza los propios campos de propiedades de una nota. Requiere Obsidian 1.12.7 o posterior, en escritorio o móvil.

## Sugerencias de nombres de propiedades

Encuentra más fácilmente los nombres que usas en las sugerencias nativas de **Añadir propiedad** de Obsidian.

1. Abre **Ajustes → Property Order → Nombres sugeridos**.
2. Fija los nombres frecuentes arriba, coloca los ocasionales al final y oculta los que no necesites mediante nombres exactos o reglas con comodines.
3. Elige Por nombre, Uso reciente o Notas que contienen esta propiedad. La **agrupación por tipo de propiedad**, opcional, agrupa las sugerencias normales por tipo de Obsidian, manteniendo los nombres fijados arriba y los destinados al final abajo.

Por ejemplo, fija `status` y `owner` y oculta `legacy_code`. Abre **Añadir propiedad** en una nota para ver el resultado. Estas reglas organizan los nombres que Obsidian ya ofrece; fijar un nombre no crea una nueva sugerencia ni mueve un campo de la nota.

Sugerencias nativas antes de aplicar las reglas:

![Sugerencias nativas de nombres antes de personalizarlas](../assets/property-order-key-suggestions-before.png)

Las mismas sugerencias con los nombres frecuentes fijados y un nombre no deseado oculto:

![Sugerencias con status y owner fijados y legacy_code oculto](../assets/property-order-key-suggestions-after.png)

Uso reciente refleja el orden de las adiciones confirmadas, no pasar el puntero ni explorar las sugerencias. La ordenación por nombre y uso reciente no recorre la bóveda. El número de notas cuenta las notas Markdown que contienen cada propiedad a partir de los metadatos en caché.

## Sugerencias de valores de propiedades

Controla los valores que se ofrecen tras seleccionar una propiedad, como `todo` y `done` para `status`. Esta función está **desactivada por defecto** y es independiente de las sugerencias de nombres.

1. Abre **Ajustes → Property Order → Valores sugeridos** y activa **Personalizar los valores de propiedades sugeridos**.
2. Configura el comportamiento predeterminado de las propiedades sin regla o asigna a un nombre de propiedad exacto: Orden de Obsidian, Por nombre, Frecuencia de selección, Notas que contienen este valor, Sin sugerencias o Sugerencias personalizadas.
3. Para crear una lista reutilizable para `status`, añade una tarjeta de regla **Sugerencias personalizadas**, añade `status` y usa **Añadir valor predefinido** para introducir `todo`, `doing` y `done`.

![Valores predefinidos de status al editar el valor de una propiedad](../assets/property-order-value-suggestions.png)

Las sugerencias personalizadas se dividen en fijadas arriba, normales y al final. Los valores definidos explícitamente siguen disponibles aunque ninguna nota los use todavía, y se filtran según lo que escribas. **↔ (Pasar a sugerencias normales)** elimina la posición fija y mantiene el valor disponible. Quitar un valor predefinido de los ajustes no borra contenido de las notas.

La frecuencia de selección solo cuenta elecciones cuando Obsidian confirma que el valor se ha escrito. El número de notas mide las notas Markdown que contienen el valor, no cuántas veces lo has elegido. **Sin sugerencias** permite seguir escribiendo manualmente. Cambiar solo las reglas de sugerencias no edita las notas.

## Reordenar valores de listas

Reordena directamente en las propiedades los valores de listas de texto YAML de nivel superior compatibles o mueve un valor a otra propiedad de lista de la misma nota. Arrastrar entre propiedades está activado por defecto y se puede desactivar en **Orden de valores**.

![Mover un valor entre propiedades](../assets/property-order-cross-property-drag.gif)

- **Escritorio:** arrastra un valor a su nueva posición o a otra propiedad de lista compatible.
- **Móvil:** mantén pulsado un valor, elige **Reordenar** o **Reordenar o mover** en el menú nativo de Obsidian y arrastra ese valor. Si el menú no admite la extensión, la edición nativa sigue disponible y el complemento no lo sustituye por una imitación.
- **Teclado:** ejecuta **Property Order: Reordenar valores de propiedades** desde la paleta de comandos. Elige la propiedad de origen y el valor y muévelo arriba, abajo, a una posición que empieza en 1, al principio, al final o al final de otra propiedad. No tiene atajo asignado por defecto. El comando funciona con el arrastre desactivado; el ajuste entre propiedades solo afecta al arrastre con el puntero.

Cada reordenación o movimiento completado es una única edición que se puede deshacer. Antes de iniciar la actualización, **Escape** o **Cancelar** deja la nota intacta. Una vez iniciada, espera a que termine y usa Deshacer en el editor si lo necesitas. El arrastre admite valores distribuidos en varias líneas, diseños de derecha a izquierda, desplazamiento cerca de los bordes de paneles compatibles y anuncios de estado para lectores de pantalla.

**Comprueba los tipos antes de reordenar:** los elementos no textuales de listas de texto compatibles pueden convertirse en cadenas, como `true` en `"true"` y `123` en `"123"`. Esto puede cambiar el tipo de dato; revisa el resultado si los tipos numéricos o booleanos son importantes.

**Conservar el formato actual es la opción predeterminada.** Puedes elegir listas entre corchetes o un elemento por línea en **Orden de valores**. Cambiar a corchetes puede hacer perder comentarios o líneas en blanco; conserva el formato actual si son importantes. Despliega **Ejemplos de formato** junto a **Formato de lista tras reordenar** para comparar las opciones.

## Instalación

### Complementos de la comunidad (recomendado)

En Obsidian, abre **Ajustes → Complementos de la comunidad → Explorar**, busca **Property Order** y elige **Instalar** y **Activar**. También puedes abrir su [página en el catálogo de complementos de la comunidad](https://obsidian.md/plugins?id=property-order). Usa las instrucciones del ZIP siguientes solo si necesitas instalarlo manualmente.

### Instalación manual

Descarga `property-order-<version>.zip` de la [última versión publicada](https://github.com/ZHYX91/obsidian-property-order/releases/latest) y descomprímelo en `Vault/.obsidian/plugins/`. El archivo contiene la carpeta `property-order/` con `main.js`, `manifest.json` y `styles.css`. Recarga Obsidian y activa Property Order en los complementos de la comunidad.

### Actualización

Haz una copia de seguridad de `Vault/.obsidian/plugins/property-order/data.json` y conserva el archivo si existe. Sustituye únicamente `main.js`, `manifest.json` y `styles.css`. Borra `data.json` solo si quieres restablecer expresamente todas las preferencias del complemento.

## Referencia de ajustes

Todas las versiones de Obsidian compatibles usan las mismas cuatro pestañas:

| Pestaña | Qué controla |
| --- | --- |
| **General** | Idioma del complemento y avisos de diagnóstico opcionales. **Seguir el idioma de Obsidian** usa el idioma correspondiente o inglés si no está disponible. |
| **Orden de valores** | Arrastre dentro de una propiedad y entre propiedades, y formato de lista tras reordenar. Desactivar el arrastre conserva la preferencia independiente entre propiedades. |
| **Nombres sugeridos** | Nombres fijados, al final y ocultos; ordenación por nombre, uso reciente y número de notas; agrupación opcional por tipo; borrado del historial reciente y campo de prueba de reglas. |
| **Valores sugeridos** | Comportamiento predeterminado que requiere activación, reglas por propiedad, valores predefinidos y borrado de los contadores de selección. |

**Orden de propiedades en esta página** solo organiza las propiedades de las tarjetas de reglas y del editor personalizado. No cambia los campos de las notas ni el orden de las sugerencias de valores.

La interfaz y el README están disponibles en inglés, chino simplificado, chino tradicional, alemán, francés, español, portugués de Brasil, ruso, japonés, coreano, vietnamita y árabe.

## Compatibilidad y limitaciones

- El arrastre admite líneas de propiedades YAML ordinarias de nivel superior que Obsidian muestra como listas de texto. No se admiten documentos completos como mapas `{ ... }`, listas de objetos, listas anidadas, secuencias entre corchetes en varias líneas, arrastre de líneas en modo fuente ni movimientos entre archivos.
- Los valores vacíos o escalares pueden participar cuando Obsidian identifica la propiedad como lista. Algunas filas con discrepancias de tipo también funcionan si cada valor se distingue claramente. Las filas ambiguas con valores mixtos se tratan con cautela y puede que solo acepten añadir al final.
- El comando de teclado necesita un panel de propiedades visible y compatible en el panel Markdown activo. Si el archivo o los valores cambian mientras el diálogo está abierto, vuelve a abrir el comando.
- Los valores predefinidos solo aparecen al editar valores en las propiedades. Si no hay un menú emergente de sugerencias nativas, el complemento puede mostrarlos junto al campo de entrada. Si no puede identificar de forma segura el editor o la interfaz nativa de sugerencias, la escritura normal o las sugerencias nativas siguen disponibles.
- La reordenación comprueba el YAML antes de pedir a Obsidian que lo guarde. El contenido no compatible o conflictivo permanece intacto. Seleccionar o editar una propiedad en Obsidian puede modificar la nota; configurar solo las sugerencias no lo hace.

## Privacidad y seguridad

Property Order funciona localmente. No requiere cuenta, no sube contenido de las notas ni llama a servicios remotos. Reordenar o mover valores solo modifica las propiedades implicadas.

El número de notas usa los metadatos de frontmatter en caché en vez de leer el cuerpo de cada nota. El historial reciente de nombres (hasta 100) y los contadores de selección confirmada de valores solo se guardan en el almacenamiento local de esta bóveda en el dispositivo actual, separados de `data.json`. No se sincronizan y se pueden borrar desde los ajustes. Pasar el puntero, explorar, cancelar y las ediciones sin confirmar no los actualizan.

## Desarrollo y ayuda

Usa Node.js 24.19.0 y npm 11.17.0. Instala las versiones de las dependencias registradas en `package-lock.json` y ejecuta después todas las comprobaciones del repositorio:

```bash
npm ci
npm run check
```

### Documentación

- [Requisitos del producto (English)](../product-requirements.en.md)
- [Especificación de interacción (English)](../ux-spec.en.md)
- [Arquitectura (English)](../architecture.en.md)
- [Estrategia de pruebas (English)](../testing-strategy.en.md)
- [Registro de cambios (English)](../../CHANGELOG.md)
- [Guía de contribución (English)](../../CONTRIBUTING.md)
- [Política de seguridad (English)](../../SECURITY.md)

- [Preguntas y respuestas (Q&A)](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/q-a): dudas de uso y configuración.
- [Ideas](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/ideas): primeras propuestas de funciones y formas de trabajar.
- [Ejemplos y experiencias (Show and tell)](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/show-and-tell): consejos, flujos de trabajo e implementaciones de referencia.
- Usa los [formularios de incidencias de GitHub](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose) para errores reproducibles y peticiones concretas de funciones.
- Comunica las vulnerabilidades en privado siguiendo la [política de seguridad](https://github.com/ZHYX91/obsidian-property-order/security/policy) del repositorio.

Elimina las rutas privadas de tus bóvedas, el contenido de las notas, los valores YAML y las credenciales antes de publicar información.

## Licencia

[MIT](../../LICENSE) © ZhengYX

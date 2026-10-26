# Property Order

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

Property Order permite reordenar los valores de listas en el panel de propiedades de Obsidian arrastrándolos o desde la paleta de comandos y elegir qué nombres y valores de propiedades se sugieren mientras escribes. Ordena los valores de listas y las sugerencias de entrada; no reorganiza los campos de propiedades de la nota.

## Demostración

En el ordenador, arrastra un elemento de una propiedad de tipo lista a otra de la misma nota:

![Mover un valor entre propiedades](../assets/property-order-cross-property-drag.gif)

El arrastre entre propiedades está activado de forma predeterminada. Puedes desactivarlo en los ajustes de **Orden de valores**.

## Funciones

- Reordena valores de una lista YAML de primer nivel admitida arrastrándolos o desde la paleta de comandos.
- Mueve valores entre propiedades de tipo lista compatibles de la misma nota. El arrastre entre propiedades está activado de forma predeterminada y se puede desactivar.
- Cuando Obsidian trata un valor vacío o un valor único como una propiedad de tipo lista, Property Order puede mover valores hacia ella o desde ella de forma segura. Los elementos que no son texto se convierten en texto conservando su escritura original en YAML.
- Conserva el formato actual de cada lista o elige listas entre corchetes o con un elemento por línea. Cada reordenación o movimiento completado correctamente genera una única edición que se puede deshacer.
- El arrastre funciona con valores distribuidos en varias líneas y con interfaces de derecha a izquierda (RTL). Puede desplazar las zonas de propiedades compatibles al acercarte al borde y anuncia los cambios de estado a los lectores de pantalla.
- Personaliza los nombres que sugiere Obsidian: fíjalos arriba, colócalos al final, ocúltalos u ordénalos por nombre, uso reciente o número de notas, con una agrupación por tipo de propiedad opcional.
- Si lo necesitas, configura las sugerencias de valores por propiedad: orden de Obsidian, por nombre, frecuencia de selecciones confirmadas, número de notas, sin sugerencias o sugerencias personalizadas.
- Las sugerencias personalizadas pueden fijarse arriba, permanecer en la sección normal o situarse al final. Los valores predefinidos expresamente siguen disponibles aunque todavía no aparezcan en ninguna nota.
- El historial de nombres recientes y los recuentos de selecciones de valores solo cambian cuando Obsidian confirma la edición. Pasar el puntero, navegar, cancelar o dejar una edición sin confirmar no cuenta.
- Si Property Order no puede interpretar el YAML o reconocer la interfaz de sugerencias de Obsidian de forma segura, deja la nota o la interfaz original sin cambios.

## Requisitos y compatibilidad

- Obsidian 1.12.7 o posterior.
- En el ordenador se pueden arrastrar los valores directamente. En el móvil hay que elegir primero una acción en el menú de pulsación larga de Obsidian.
- El arrastre de valores solo funciona con propiedades YAML de primer nivel que Obsidian identifica como listas de texto. La personalización de sugerencias de valores normalmente reordena las opciones que ya ofrece Obsidian. Las reglas personalizadas también pueden añadir valores predefinidos expresamente mediante el mismo editor de propiedades. Más abajo se detallan las limitaciones.

## Instalación

### Complementos de la comunidad (recomendado)

En Obsidian, abre **Ajustes → Complementos de la comunidad → Explorar**, busca **Property Order** y elige **Instalar** y **Activar**. También puedes abrir su [página en el catálogo de complementos de la comunidad](https://obsidian.md/plugins?id=property-order). Usa las instrucciones del ZIP siguientes solo si necesitas instalarlo manualmente.

### Instalación manual

Descarga `property-order-<version>.zip` de la [última versión publicada](https://github.com/ZHYX91/obsidian-property-order/releases/latest) y descomprímelo en `Vault/.obsidian/plugins/`. El archivo contiene la carpeta `property-order/` con `main.js`, `manifest.json` y `styles.css`. Recarga Obsidian y activa Property Order en los complementos de la comunidad.

### Actualización

Haz una copia de seguridad de `Vault/.obsidian/plugins/property-order/data.json` y conserva el archivo si existe. Sustituye únicamente `main.js`, `manifest.json` y `styles.css`. Borra `data.json` solo si quieres restablecer expresamente todas las preferencias del complemento.

## Uso

1. Activa Property Order en **Ajustes → Complementos de la comunidad**.
2. Abre una nota con propiedades de lista YAML de primer nivel en el panel de propiedades de Obsidian.
3. En el ordenador, arrastra un valor directamente. En el móvil, mantén pulsado un valor, elige **Reordenar** o **Reordenar o mover** y después arrástralo.
4. Configura **Nombres sugeridos** para las sugerencias de nombres de propiedades. Si lo deseas, activa **Valores sugeridos** para ordenar las opciones que ya ofrece Obsidian mediante un ajuste predeterminado y reglas por propiedad.

**Con el teclado:** Abre la paleta de comandos de Obsidian y ejecuta **Property Order: Reordenar valores de propiedades**. Selecciona la propiedad de origen y el valor, y elige **Subir**, **Bajar** o **Mover a la propiedad**. Al moverlo a otra propiedad, se añade al final. El comando funciona incluso con el arrastre desactivado; el ajuste de arrastre entre propiedades solo afecta al puntero. Antes de iniciar el movimiento, **Escape** o **Cancelar** deja la nota intacta. Una vez iniciada la actualización, espera a que termine; puedes deshacer el cambio en el editor. No hay un atajo asignado por defecto.

En listas largas, introduce una posición desde 1 y elige **Mover a la posición**, o usa **Mover al principio** / **Mover al final**. Cada movimiento completado se deshace en un solo paso.

**Antes de cambiar el orden:** Al reordenar o mover valores de una lista de texto admitida, los valores YAML que no son texto pueden convertirse en cadenas: `true` pasa a `"true"` y `123` a `"123"`. Esto puede cambiar el tipo de dato; revisa el resultado si esos tipos son importantes.

**En móviles:** solo se puede arrastrar si el menú nativo de pulsación larga de Obsidian muestra **Reordenar** o **Reordenar o mover**. Si el menú no admite la extensión, el plugin no crea uno falso; la edición nativa sigue disponible.

**¿Qué ajuste de sugerencias debes usar?** Cuando añades una propiedad e introduces su **nombre**, **Nombres sugeridos** decide si nombres como `status` u `owner` se fijan arriba, se ocultan o se reordenan. Después de elegir `status`, al editar su **valor**, **Valores sugeridos** controla las opciones existentes, como `todo` o `done`, y permite añadir valores predefinidos propios. Las sugerencias de valores están desactivadas de forma predeterminada. Cambiar los ajustes de sugerencias no modifica las notas. Seleccionar o editar una propiedad en Obsidian puede modificar la nota.

**Ejemplo: añadir valores habituales para `status`.** Abre **Valores sugeridos**, activa **Personalizar los valores de propiedades sugeridos** y añade un grupo de reglas de **Sugerencias personalizadas**. Añade `status` al grupo. En **Sugerencias fijadas arriba**, escribe `todo` y pulsa **Añadir valor predefinido**. Repite estos pasos con `doing` y `done`. Los valores aparecerán al editar `status`, filtrados según lo que escribas. Para incluir un valor predefinido en el orden normal, pulsa **↔ (Pasar a sugerencias normales)** junto a él.

## Ajustes

Todas las versiones compatibles de Obsidian muestran las mismas cuatro pestañas de ajustes:

- **General** permite elegir el idioma del complemento y activar los mensajes de diagnóstico opcionales. La interfaz y el README están disponibles en inglés, chino simplificado, chino tradicional, alemán, francés, español, portugués de Brasil, ruso, japonés, coreano, vietnamita y árabe. **Seguir el idioma de Obsidian** elige el idioma correspondiente, o inglés si no está disponible.
- **Orden de valores** controla el formato de las listas después de reordenarlas y el arrastre dentro de una propiedad o entre propiedades. Desactivar el arrastre de valores no borra el ajuste independiente de arrastre entre propiedades. Forzar el cambio de una lista con un elemento por línea a corchetes puede perder comentarios o líneas en blanco. Conserva el formato original si los necesitas. Despliega **Ejemplos de formato** junto a **Formato de lista tras reordenar** para comparar la misma entrada en los tres formatos antes de elegir.
- **Nombres sugeridos** controla los nombres fijados arriba, situados al final u ocultos, además del orden por nombre, uso reciente o número de notas. La agrupación por tipo de propiedad opcional organiza las sugerencias normales en Texto, Lista, Número, Casilla de verificación, Fecha, Fecha y hora, Etiquetas y Automático / sin especificar. El orden elegido sigue aplicándose dentro de cada grupo.
- **Valores sugeridos** requiere activación expresa. Las propiedades sin una regla propia usan el ajuste predeterminado. Cada nombre de propiedad puede asignarse a **Por nombre**, **Frecuencia de selección**, **Notas que contienen este valor**, **Orden de Obsidian**, **Sin sugerencias** o **Sugerencias personalizadas**.
- Las reglas personalizadas usan las secciones **Sugerencias fijadas arriba**, **Sugerencias normales** y **Sugerencias al final**. Puedes introducir valores predefinidos directamente para que sigan siendo seleccionables aunque todavía no aparezcan en una nota.
- **Orden de propiedades en esta página** solo cambia el orden de las propiedades en los grupos de reglas y en el editor de sugerencias personalizadas. No reordena las propiedades de las notas ni sus valores sugeridos.
- El historial de nombres de propiedades recientes guarda como máximo 100 nombres en el dispositivo actual. La frecuencia de selección también es local al dispositivo. Ambos datos se guardan por separado de `data.json`, no se sincronizan y pueden borrarse desde los ajustes.

## Limitaciones

- El frontmatter debe usar líneas de propiedades normales de nivel superior. No se admite arrastrar valores si todo el documento YAML está encerrado en `{ ... }`.
- El arrastre de valores solo funciona con propiedades YAML de primer nivel que Obsidian muestra como listas de texto.
- No se admiten listas de objetos, listas anidadas, listas entre corchetes escritas en varias líneas, arrastre de líneas en modo de código fuente ni movimientos entre archivos.
- En el móvil, primero elige **Reordenar** o **Reordenar o mover** en el menú de pulsación larga de Obsidian y después arrastra el valor. Las acciones originales para editar, quitar de la lista y copiar siguen disponibles.
- Algunas propiedades con avisos de tipo incompatible pueden participar si Obsidian las identifica claramente como listas. Los campos ambiguos con valores de distintos tipos se tratan con cautela y, en algunos casos, solo permiten añadir un valor al final.
- Los valores predefinidos personalizados se sugieren únicamente al editar valores en el panel de propiedades. Si Obsidian no abre una lista de sugerencias, Property Order puede mostrarlos junto al campo de entrada. Si no puede identificar el campo con seguridad, puedes seguir escribiendo normalmente.
- Al convertir una lista con un elemento por línea en una lista entre corchetes, pueden perderse los comentarios y las líneas en blanco que la sintaxis entre corchetes no permite representar.
- El comando de teclado necesita un panel de propiedades visible y compatible en el panel Markdown activo. Si el archivo o los valores cambian con el diálogo abierto, vuelve a ejecutar el comando.

## Privacidad y seguridad

Property Order funciona de forma local. No requiere una cuenta, no sube el contenido de las notas ni llama a servicios remotos.

Reordenar o mover valores solo modifica las propiedades implicadas. El complemento comprueba el resultado antes de pedir a Obsidian que guarde la nota. No escribe estructuras que no pueda manejar de forma segura.

Para ordenar por número de notas, Property Order enumera los archivos Markdown y lee los metadatos de propiedades almacenados en caché; no lee el cuerpo de cada nota. El historial de nombres recientes y los recuentos de selecciones confirmadas de valores se guardan únicamente en el almacenamiento local de Obsidian correspondiente a esta bóveda y este dispositivo, por separado de `data.json`. Pueden borrarse desde los ajustes.

## Desarrollo

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

## Ayuda

- [Preguntas y respuestas (Q&A)](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/q-a): dudas de uso y configuración.
- [Ideas](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/ideas): primeras propuestas de funciones y formas de trabajar.
- [Ejemplos y experiencias (Show and tell)](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/show-and-tell): consejos, flujos de trabajo e implementaciones de referencia.
- Usa los [formularios de incidencias de GitHub](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose) para errores reproducibles y peticiones concretas de funciones.
- Comunica las vulnerabilidades en privado siguiendo la [política de seguridad](https://github.com/ZHYX91/obsidian-property-order/security/policy) del repositorio.

Elimina las rutas privadas de tus bóvedas, el contenido de las notas, los valores YAML y las credenciales antes de publicar información.

## Licencia

[MIT](../../LICENSE) © ZhengYX

# Dónde vive el menú de BüBa

Este archivo existe por algo concreto: el **12/09/2026 el menú estuvo caído varias
horas** porque había cuatro proyectos de Vercel con nombres casi idénticos
apuntando al mismo repositorio, y al limpiar los duplicados se borró justo el que
servía a los clientes. Nadie tenía anotado cuál era cuál.

---

## Vercel

| | |
|---|---|
| Cuenta | `christiansen06` (plan Hobby) |
| Proyecto | **`buba-mdq`** — es el único, y tiene que seguir siendo el único |
| Repositorio | `christiansen06/buba-menu`, rama `main` |
| Dominio de producción | **`buba-mdq.vercel.app`** |
| Redirect | `buba-menu.vercel.app` → 307 → `buba-mdq.vercel.app` |
| Vercel Authentication | **apagada** (si se prende, los clientes ven un login en vez del menú) |

Cada push a `main` dispara un deployment de producción solo. No hace falta tocar nada.

### ⚠️ Dos cosas que NO hay que hacer

**No importar el repo como proyecto nuevo.** Si Vercel ya tiene un proyecto para
este repositorio, importarlo otra vez crea un segundo proyecto con un sufijo random
(`buba-menu-3d6j`, `buba-menu-1ojg`) que también despliega cada commit. Así
aparecieron los duplicados, y así se gastó el triple de minutos de build durante
tres meses sin que nadie lo notara.

**No renombrar el proyecto ni tocar sus dominios** sin cambiar los QR del local.
Los QR impresos apuntan a un dominio fijo: si el dominio cambia, los carteles dejan
de funcionar y hay que reimprimirlos. Renombrar el proyecto **no** mueve el dominio
solo — hay que editarlo a mano en Domains y, sobre todo, dejar el viejo redirigiendo
al nuevo.

---

## Las direcciones y para qué sirve cada una

El menú mira la dirección con la que se abre para saber de dónde salió el pedido.
Eso se resuelve en [`src/config/unidad.js`](src/config/unidad.js).

| Para | Dirección | Queda registrado como |
|---|---|---|
| **QR del local** (clientes) | `https://buba-mdq.vercel.app` | `unidad=local`, `canal=qr` |
| **iPad del mostrador** | `https://buba-mdq.vercel.app/?mostrador=1` | `unidad=local`, `canal=mostrador` |
| **QR del food truck** (clientes) | `https://buba-mdq.vercel.app/?unidad=food_truck` | `unidad=food_truck`, `canal=qr` |
| **Tablet del food truck** | `https://buba-mdq.vercel.app/?unidad=food_truck&mostrador=1` | `unidad=food_truck`, `canal=mostrador` |
| Apagar el modo mostrador | `https://buba-mdq.vercel.app/?mostrador=0` | vuelve a `canal=qr` |

**Los dispositivos del personal se configuran UNA sola vez** y se acuerdan: el flag
de mostrador queda guardado en ese aparato. Cuando está activo aparece un cartelito
abajo a la izquierda (`🏠 Local · Mostrador`). Si el cartelito no está, el modo se
apagó —típicamente porque se limpiaron los datos del navegador— y hay que volver a
abrir el link. **Ese cartel es el único aviso**: sin él, todo se cuenta como QR y los
números salen mal en silencio.

La unidad **no** se guarda en el celular de un cliente, a propósito: el QR del food
truck lleva el parámetro siempre, y si se guardara, alguien que lo escaneó allá
seguiría contando como food truck al abrir el menú en el local.

### ⚠️ No agregar `start_url` al manifiesto

`public/site.webmanifest` **no** declara `start_url`, y tiene que seguir así. Si se
declara, iOS lo usa para el acceso directo de la pantalla de inicio y **descarta el
`?mostrador=1`** de la dirección con la que lo agregaste: el ícono del iPad quedaría
apuntando al menú de cliente. Sin `start_url`, el manifiesto toma la dirección de la
página actual, que es lo que se necesita acá.

Por el mismo motivo el manifiesto tampoco declara `display: standalone`: sin barra de
direcciones no habría forma de volver a abrir el link con `?mostrador=1` si alguna vez
se limpia la memoria del navegador del iPad.

Y los iconos del manifiesto van en **PNG**, no en WebP: Safari no puede decodificar
WebP para la pantalla de inicio y no muestra ningún ícono. El peso no importa —esos
archivos se bajan sólo al instalar, no en cada visita.

---

## Base de datos

| | |
|---|---|
| Supabase | proyecto `adrwdnzzctphfknocjvg`, Postgres 17, región `sa-east-1` |
| Credenciales del front | `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` en `.env.local` |

La clave que viaja en la app es la **publishable**, y es pública a propósito: lo que
protege los datos es el RLS, no la clave. La clave *secret* no va en el front.

Las migraciones son los `supabase-setup-*.sql` de la raíz, **en orden**. Cada archivo
explica arriba qué resuelve y trae su bloque de reversa comentado al final. Dos
advertencias que ya costaron caro:

- La **parte 5** quedó vieja: sus dos vistas las reemplaza la **parte 6**. Correr la 5
  después de la 6 revierte el arreglo sin avisar.
- Al agregarle parámetros a `registrar_pedido`, hay que **borrar la versión anterior
  primero**. Un `create or replace` con un parámetro nuevo con default no reemplaza la
  función: crea una segunda, y después las llamadas fallan con *"function is not
  unique"* y el menú deja de registrar pedidos.

---

## Para trabajar local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # verifica que compile antes de pushear
```

Sin `.env.local` la app funciona igual, sin base: el menú nunca depende de Supabase
para mostrarse.

## Web Analytics (Entrega 1)

`src/main.jsx` monta `<Analytics />` de `@vercel/analytics`. Cuenta visitas al
menú — nada más: sin cookies, sin nombre ni teléfono. Con eso, **conversión del
QR = pedidos con `canal = 'qr'` / visitas**.

El paquete solo no mide nada: hay que **prender el interruptor en Vercel**,
proyecto `buba-mdq` → pestaña **Analytics** → *Enable*. Es gratis en el plan
Hobby. Hasta que esté prendido, `get_web_analytics` responde
`web_analytics_not_enabled` y el script del cliente no reporta.

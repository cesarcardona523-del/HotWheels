# Mi Colección Hot Wheels

App web (mobile first) para registrar tu colección de carros a escala y saber en segundos, desde la tienda, si ya tienes un modelo.

- `web/` — React + TypeScript + Vite + Tailwind + TanStack Query.
- `supabase/migrations/` — esquema, triggers, RLS y políticas de almacenamiento.
- `supabase/functions/hw-import-image-url/` — Edge Function que descarga una imagen desde una URL y la guarda en el bucket privado.
- `web/tests/rls.test.mjs` — 51 pruebas de permisos y de no afectar otras apps que corren la migración real sobre Postgres (PGlite).

## Proyecto Supabase compartido

Esta app vive en el mismo proyecto Supabase que otras apps (`arpzkclltxguvixxfzej`). Para no afectarlas:
- Todo lleva prefijo: tablas, tipos y funciones `hw_*`, trigger `hw_on_auth_user_created`, bucket `hw-car-images` y Edge Function `hw-import-image-url`.
- No se modifican `public.profiles`, `public.handle_new_user()`, el trigger `on_auth_user_created` ni los buckets existentes. Las pruebas (`npm run test:db`) lo verifican.
- **El login es compartido:** las plantillas de correo, el Site URL y las URLs de redirección son del proyecto entero. **No cambies esas plantillas sin revisar las otras apps.**

## Instalación

### 1. Proyecto Supabase

1. Crea un proyecto en <https://supabase.com> (o usa `supabase start` si tienes Docker).
2. Vincula y aplica la migración:
   ```bash
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   supabase db push
   ```
3. **Authentication → Providers → Email**: activado. Desactiva el resto (Google, etc.).
4. **Authentication → URL Configuration**: `Site URL` = la URL donde publiques la app (ej. `https://tu-app.vercel.app`) y agrégala a *Redirect URLs* junto con `http://localhost:5173`.
5. **Authentication → Email Templates → Magic Link** y **Confirm signup**: pega el contenido de `supabase/templates/magic_link.html`. Es lo que hace que el correo traiga el **código de 6 dígitos** (`{{ .Token }}`) además del enlace.
6. **SMTP**: el correo integrado de Supabase sirve para probar, pero tiene un límite muy bajo de envíos por hora. Para uso real configura un SMTP propio (Resend, Brevo, etc.) en *Project Settings → Auth → SMTP*.
7. Despliega la función de importación de imágenes:
   ```bash
   supabase functions deploy hw-import-image-url
   ```
   No necesita secretos propios (usa `SUPABASE_URL` y `SUPABASE_ANON_KEY`, que Supabase inyecta). Opcional: `supabase secrets set ALLOWED_ORIGIN=https://tu-app.vercel.app` para restringir CORS.

### 2. App web

```bash
cd web
cp .env.example .env.local   # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev                  # http://localhost:5173
npm run build                # genera web/dist para publicar
npm run test:db              # pruebas de permisos (no necesita Supabase)
npm run dev:mock             # modo DEMO con datos de prueba para revisar el diseño sin backend (solo desarrollo)
```

### Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `VITE_SUPABASE_URL` | `web/.env.local` | URL del proyecto (pública) |
| `VITE_SUPABASE_ANON_KEY` | `web/.env.local` | Clave anónima (pública por diseño; la seguridad está en RLS) |
| `ALLOWED_ORIGIN` | secreto de Edge Functions (opcional) | Origen permitido por CORS en `import-image-url` |
| `GOOGLE_CSE_KEY`, `GOOGLE_CSE_CX` | secretos de Edge Functions | **Etapa 2** — búsqueda de imágenes |
| `GEMINI_API_KEY`, `VISION_PROVIDER` | secretos de Edge Functions | **Etapa 3** — búsqueda por foto |

Ninguna clave privada va en el frontend.

## Seguridad y permisos

- La pertenencia a una colección se guarda **por correo** en `collection_members`. Quien recibe la invitación ve la colección en cuanto entra con ese correo, aunque no tuviera cuenta.
- `has_role(collection, rol_mínimo)` se usa en **todas** las políticas: lector = leer; editor = crear, editar y borrar carros, imágenes y listas; dueño = además renombrar o borrar la colección y gestionar miembros.
- El bucket `car-images` es **privado**; las rutas son `{collection_id}/{car_id}/…` y las políticas de `storage.objects` aplican el mismo rol. Las imágenes se muestran con URLs firmadas de 1 hora.
- **Duplicados en el servidor:** un trigger rechaza (`DUPLICATE_CAR`) un carro con el mismo casting, año y color (sin distinguir mayúsculas, tildes ni signos) salvo que se marque `variant_confirmed`.
- **Otras protecciones:** una colección no puede quedarse sin dueño, un registro no puede moverse a otra colección y una imagen no puede apuntar a un carro de otra colección.

## Estado — Etapa 1

### Terminado y verificado
- Esquema, triggers, RLS y políticas de almacenamiento: **51/51 pruebas** (`npm run test:db`). Cubren los roles, las invitaciones antes de tener cuenta, el aislamiento entre colecciones, la revocación de accesos, el almacenamiento y los duplicados. Corresponden a los criterios de aceptación 2, 4 y 6, a nivel de base de datos.
- La app compila (`tsc` + `vite build`) sin errores y la pantalla de login se ve bien en el celular.

### Construido, pendiente de probar contra un Supabase real
No fue posible levantar Supabase en esta máquina (no hay Docker) ni hay un proyecto en la nube vinculado, así que estos flujos no se han ejecutado de punta a punta:
- Login por correo con código de 6 dígitos o enlace (envío real del correo).
- Crear y cambiar colecciones; invitar, cambiar roles y revocar accesos desde la interfaz.
- Formulario del carro con todos los campos, subida de foto comprimida (WEBP, 1600 px más miniatura de 480 px), aviso de duplicado con el carro existente y la opción "es una variante distinta".
- Buscador con "YA LO TIENES" / "NO ESTÁ EN TU COLECCIÓN" (búsqueda tolerante a errores en el celular, con coincidencia exacta por toy number o código de barras primero), catálogo en tarjetas con carga progresiva, filtros combinables y "Limpiar".
- Exportación a Excel y CSV.
- Edge Function `import-image-url` (pegar la URL de una imagen): escrita, pero no desplegada ni ejecutada.

### Limitaciones conocidas
- **Las invitaciones no envían correo**: el dueño agrega el correo y debe avisarle a la persona que entre. Enviar el correo automáticamente requiere SMTP y una Edge Function con la service key.
- La importación por URL guarda la imagen original (hasta 5 MB) sin miniatura; en las tarjetas se usa la imagen completa.
- La protección SSRF de `import-image-url` valida el DNS antes de descargar, pero no evita un ataque de *DNS rebinding* entre la validación y la descarga.
- La búsqueda en tiempo real carga toda la colección en el celular. Va bien hasta varios miles de carros; para colecciones muy grandes convendría buscar en el servidor (el índice `pg_trgm` ya existe).
- `xlsx` (SheetJS 0.18.5 de npm) tiene avisos de seguridad que afectan la **lectura** de archivos; aquí solo se usa para escribir. En la Etapa 3 (importación masiva) hay que cambiarlo por la versión del CDN de SheetJS o por otra librería.
- Se puede instalar en el celular ("Agregar a pantalla de inicio") con ícono propio, pero todavía no funciona sin conexión (no hay service worker).
- El logo es propio, en el estilo de Hot Wheels; no es el oficial, que es marca registrada de Mattel. Para usar otro logo con permiso, guárdalo en `web/public/logo.svg` y activa `USE_CUSTOM_LOGO` en `web/src/components/Logo.tsx`.

### Etapas siguientes
- **Etapa 2:** búsqueda de imágenes en Google (el botón ya está en la interfaz, deshabilitado), lista de deseados (la tabla y su RLS ya existen), resumen, series incompletas, escáner de código de barras, respaldo ZIP con imágenes.
- **Etapa 3:** búsqueda por foto con Gemini, importación masiva, historial de cambios, estadísticas.

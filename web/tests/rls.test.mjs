import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import { readFileSync } from 'fs'

const db = new PGlite({ extensions: { pg_trgm, unaccent } })
const migration = ['20261014000001_hw_init.sql', '20261015000001_hw_cars_formulario_simple.sql']
  .map((f) => readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8')).join('\n')

await db.exec(`
create schema extensions;
create role authenticated nologin; create role anon nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
create function auth.email() returns text language sql stable as $$ select auth.jwt()->>'email' $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema auth, storage, extensions to authenticated;
grant all on storage.objects to authenticated;
grant execute on all functions in schema auth to authenticated;
-- Lo que ya existe en el proyecto compartido y NO debe cambiar:
create table public.profiles (id uuid primary key, email text);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing; return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create table public.socios_cafes (id int primary key, nombre text);
insert into public.socios_cafes values (1, 'existente');
insert into storage.buckets (id, name, public) values ('socios-cafes', 'socios-cafes', false);
`)
const before = (await db.query(`select md5(pg_get_functiondef('public.handle_new_user'::regproc)) h`)).rows[0].h
await db.exec(migration)
await db.exec(`grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;`)

const U = {
  A: ['11111111-1111-1111-1111-111111111111', 'dueno@x.com'],
  B: ['22222222-2222-2222-2222-222222222222', 'editor@x.com'],
  C: ['33333333-3333-3333-3333-333333333333', 'lector@x.com'],
  D: ['44444444-4444-4444-4444-444444444444', 'extrano@x.com'],
}
const signup = (k) => db.query('insert into auth.users values ($1,$2)', U[k])

let pass = 0, fail = 0
async function as(k, sql, params = []) {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: U[k][0], email: U[k][1], role: 'authenticated' })])
  await db.exec('set role authenticated')
  try { return await db.query(sql, params) } finally { await db.exec('reset role') }
}
async function expectOk(name, fn, check) {
  try { const r = await fn(); if (check && !check(r)) throw new Error('check failed: ' + JSON.stringify(r.rows ?? r)); pass++; console.log('  ✔', name) }
  catch (e) { fail++; console.log('  ✘', name, '→', e.message) }
}
async function expectFail(name, fn, re) {
  try { const r = await fn(); fail++; console.log('  ✘', name, '→ no falló', JSON.stringify(r.rows ?? r).slice(0, 120)) }
  catch (e) { if (re && !re.test(e.message)) { fail++; console.log('  ✘', name, '→ error distinto:', e.message) } else { pass++; console.log('  ✔', name, `(${e.message.slice(0, 60)})`) } }
}
const rows = (n) => (r) => r.rows.length === n

const CID = 'aaaaaaaa-0000-0000-0000-000000000001'
const CAR = 'cccccccc-0000-0000-0000-000000000001'

console.log('Cuentas y colección')
await signup('A'); await signup('C'); await signup('D')
await expectOk('A crea colección', () => as('A', `insert into hw_collections (id,name,owner_id) values ($1,'Mía',$2)`, [CID, U.A[0]]))
await expectFail('D no puede crear colección a nombre de A', () => as('D', `insert into hw_collections (name,owner_id) values ('x',$1)`, [U.A[0]]), /row-level security/)
await expectOk('A queda como dueño', () => as('A', `select role from hw_collection_members where collection_id=$1`, [CID]), (r) => r.rows[0]?.role === 'owner')
await expectOk('Marcas y líneas iniciales', () => as('A', `select (select count(*) from hw_brands where collection_id=$1)::int b, (select count(*) from hw_lines where collection_id=$1)::int l`, [CID]), (r) => r.rows[0].b === 4 && r.rows[0].l === 8)

console.log('Invitaciones')
await expectOk('A invita a B (sin cuenta) como editor', () => as('A', `insert into hw_collection_members (collection_id,email,role) values ($1,' Editor@X.com ','editor')`, [CID]))
await expectOk('A invita a C como lector', () => as('A', `insert into hw_collection_members (collection_id,email,role) values ($1,'lector@x.com','viewer')`, [CID]))
await signup('B')
await expectOk('B se registra y queda vinculado', () => as('B', `select user_id from hw_collection_members where email='editor@x.com'`), (r) => r.rows[0]?.user_id === U.B[0])
await expectOk('B ve la colección', () => as('B', `select id from hw_collections`), rows(1))
await expectFail('B (editor) no puede invitar', () => as('B', `insert into hw_collection_members (collection_id,email,role) values ($1,'otro@x.com','owner')`, [CID]), /row-level security/)
await expectOk('B (editor) no puede subirse de rol (0 filas)', () => as('B', `update hw_collection_members set role='owner' where email='editor@x.com' returning id`), rows(0))
await expectFail('A no puede quitarse siendo único dueño', () => as('A', `delete from hw_collection_members where email='dueno@x.com'`), /al menos un dueño/)

console.log('Carros y roles')
const ins = (k, id, extra = '') => as(k, `insert into hw_cars (id,collection_id,casting_name,year,color${extra ? ',variant_confirmed' : ''}) values ($1,$2,$3,2024,$4${extra ? ',true' : ''})`, [id, CID, "'67 Camaro", 'Rojo'])
await expectOk('B (editor) agrega un carro', () => ins('B', CAR))
await expectOk('created_by = B', () => as('A', `select created_by from hw_cars where id=$1`, [CAR]), (r) => r.rows[0].created_by === U.B[0])
await expectOk('A edita el carro', () => as('A', `update hw_cars set notes='ok' where id=$1 returning updated_by`, [CAR]), (r) => r.rows[0]?.updated_by === U.A[0])
await expectFail('C (lector) no puede agregar', () => ins('C', 'cccccccc-0000-0000-0000-000000000009'), /row-level security/)
await expectOk('C (lector) no puede editar (0 filas)', () => as('C', `update hw_cars set notes='hack' where id=$1 returning id`, [CAR]), rows(0))
await expectOk('C (lector) no puede borrar (0 filas)', () => as('C', `delete from hw_cars where id=$1 returning id`, [CAR]), rows(0))
await expectOk('C (lector) sí puede leer', () => as('C', `select id from hw_cars`), rows(1))

console.log('Duplicados (servidor)')
await expectFail('Mismo casting/año/color se rechaza', () => ins('B', 'cccccccc-0000-0000-0000-000000000002'), /DUPLICATE_CAR/)
await expectFail('Detecta con mayúsculas/acentos/espacios', () => as('B', `insert into hw_cars (collection_id,casting_name,year,color) values ($1,'67  CAMARO',2024,'rojó')`, [CID]), /DUPLICATE_CAR/)
await expectOk('Con confirmación de variante se permite', () => ins('B', 'cccccccc-0000-0000-0000-000000000002', true))
await expectOk('Otro año no es duplicado', () => as('B', `insert into hw_cars (collection_id,casting_name,year,color) values ($1,'''67 Camaro',2023,'Rojo')`, [CID]))
await expectOk('find_duplicates encuentra 2', () => as('B', `select id from hw_find_duplicates($1,'67 camaro',2024,'ROJO')`, [CID]), rows(2))
await expectFail('Editar otro carro para que choque se rechaza', () => as('B', `update hw_cars set year=2024 where year=2023`), /DUPLICATE_CAR/)

console.log('Usuario sin acceso')
await expectOk('D no ve colecciones', () => as('D', `select * from hw_collections`), rows(0))
await expectOk('D no ve carros', () => as('D', `select * from hw_cars`), rows(0))
await expectOk('D no ve miembros', () => as('D', `select * from hw_collection_members`), rows(0))
await expectOk('find_duplicates no filtra datos a D', () => as('D', `select * from hw_find_duplicates($1,'67 camaro',2024,'rojo')`, [CID]), rows(0))
await expectFail('D no puede insertar carro en la colección', () => as('D', `insert into hw_cars (collection_id,casting_name) values ($1,'x')`, [CID]), /row-level security/)
await expectOk('D no puede auto-invitarse', () => expectFail('', () => as('D', `insert into hw_collection_members (collection_id,email,role) values ($1,'extrano@x.com','owner')`, [CID]), /row-level security/))

console.log('Almacenamiento')
const path = `${CID}/${CAR}/front-1.webp`
await expectOk('B (editor) sube imagen', () => as('B', `insert into storage.objects (bucket_id,name) values ('hw-car-images',$1)`, [path]))
await expectOk('C (lector) puede leerla', () => as('C', `select * from storage.objects`), rows(1))
await expectFail('C (lector) no puede subir', () => as('C', `insert into storage.objects (bucket_id,name) values ('hw-car-images',$1)`, [`${CID}/x/y.webp`]), /row-level security/)
await expectOk('D no ve la imagen', () => as('D', `select * from storage.objects`), rows(0))
await expectFail('D no puede subir a la colección', () => as('D', `insert into storage.objects (bucket_id,name) values ('hw-car-images',$1)`, [`${CID}/x/y.webp`]), /row-level security/)
await expectFail('Ruta basura no rompe y se niega', () => as('B', `insert into storage.objects (bucket_id,name) values ('hw-car-images','../hack.webp')`), /row-level security/)
await expectOk('B registra hw_car_images', () => as('B', `insert into hw_car_images (car_id,collection_id,side,source,storage_path) values ($1,$2,'front','upload',$3)`, [CAR, CID, path]))

console.log('Aislamiento entre colecciones')
const CID2 = 'aaaaaaaa-0000-0000-0000-000000000002'
await as('D', `insert into hw_collections (id,name,owner_id) values ($1,'De D',$2)`, [CID2, U.D[0]])
await expectFail('D no puede apuntar imagen a carro de otra colección', () => as('D', `insert into hw_car_images (car_id,collection_id,side,source,storage_path) values ($1,$2,'back','url',$3)`, [CAR, CID2, `${CID2}/x.webp`]), /no corresponde/)
await expectFail('B no puede mover carro a otra colección', () => as('B', `update hw_cars set collection_id=$2 where id=$1`, [CAR, CID2]), /row-level security|No se puede cambiar/)

console.log('Gestión de miembros')
await expectOk('A cambia C a editor', () => as('A', `update hw_collection_members set role='editor' where email='lector@x.com' returning id`), rows(1))
await expectOk('A revoca a C', () => as('A', `delete from hw_collection_members where email='lector@x.com' returning id`), rows(1))
await expectOk('C ya no ve nada', () => as('C', `select * from hw_cars`), rows(0))
await expectOk('C ya no ve fotos', () => as('C', `select * from storage.objects`), rows(0))
await expectOk('B puede salir por su cuenta', () => as('B', `delete from hw_collection_members where email='editor@x.com' returning id`), rows(1))
await expectOk('A borra la colección (cascada)', () => as('A', `delete from hw_collections where id=$1 returning id`, [CID]), rows(1))

console.log('No se dañó lo existente')
await expectOk('handle_new_user sigue idéntica', () => db.query(`select md5(pg_get_functiondef('public.handle_new_user'::regproc)) h`), (r) => r.rows[0].h === before)
await expectOk('profiles se sigue llenando al registrarse', () => db.query(`select count(*)::int n from public.profiles`), (r) => r.rows[0].n === 4)
await expectOk('Ambos triggers en auth.users', () => db.query(`select count(*)::int n from pg_trigger where tgrelid='auth.users'::regclass and tgname in ('on_auth_user_created','hw_on_auth_user_created')`), (r) => r.rows[0].n === 2)
await expectOk('Tabla de otra app intacta', () => db.query(`select nombre from public.socios_cafes`), (r) => r.rows[0]?.nombre === 'existente')
await expectOk('Bucket de otra app intacto', () => db.query(`select count(*)::int n from storage.buckets`), (r) => r.rows[0].n === 2)

console.log(`\n${pass} correctas, ${fail} fallidas`)
process.exit(fail ? 1 : 0)

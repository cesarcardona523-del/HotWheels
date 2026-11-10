-- Mi Colección Hot Wheels — esquema inicial (Etapa 1)
-- Proyecto Supabase compartido con otras apps: todo lleva el prefijo hw_ (o hw-)
-- y NO se modifica nada existente (public.profiles, handle_new_user, otros buckets).
-- Permisos: todo se aplica con RLS. La pertenencia a una colección se basa en
-- el correo (minúsculas), así una persona invitada sin cuenta ve la colección
-- en cuanto inicia sesión con ese correo.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ───────────────────────── Tipos ─────────────────────────
create type hw_member_role as enum ('owner', 'editor', 'viewer');
create type hw_car_condition as enum ('carded', 'loose', 'damaged_card');
create type hw_image_side as enum ('front', 'back');
create type hw_image_source as enum ('upload', 'google', 'url');

-- ───────────────────────── Utilidades ─────────────────────────
-- unaccent no es IMMUTABLE; este envoltorio permite usarlo en columnas generadas.
create or replace function public.hw_norm(t text)
returns text language sql immutable parallel safe
set search_path = public, extensions
as $$
  select nullif(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))), '[^a-z0-9]+', '', 'g'), '')
$$;

create or replace function public.hw_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ───────────────────────── Tablas ─────────────────────────
create table public.hw_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  owner_id uuid not null references auth.users (id),
  currency text not null default 'COP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hw_collection_members (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.hw_collections (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%_@_%'),
  user_id uuid references auth.users (id) on delete set null,
  role hw_member_role not null,
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (collection_id, email)
);
create index on public.hw_collection_members (email);
create index on public.hw_collection_members (user_id);

create table public.hw_brands (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.hw_collections (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  sort int not null default 0,
  unique (collection_id, name)
);

create table public.hw_lines (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.hw_collections (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  sort int not null default 0,
  unique (collection_id, name)
);

create table public.hw_cars (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.hw_collections (id) on delete cascade,
  casting_name text not null check (length(trim(casting_name)) between 1 and 120),
  brand_id uuid references public.hw_brands (id) on delete set null,
  real_maker text,
  line_id uuid references public.hw_lines (id) on delete set null,
  year int check (year between 1950 and 2100),
  series_number int check (series_number > 0),
  series_total int check (series_total > 0),
  mini_collection text,
  toy_number text,
  barcode text,
  color text,
  variant text,
  condition hw_car_condition,
  is_th boolean not null default false,
  is_sth boolean not null default false,
  price_paid numeric(12, 2) check (price_paid >= 0),
  store text,
  city text,
  purchased_at date,
  notes text,
  variant_confirmed boolean not null default false,
  norm_key text generated always as (
    coalesce(public.hw_norm(casting_name), '') || '|' || coalesce(year::text, '') || '|' || coalesce(public.hw_norm(color), '')
  ) stored,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (series_number is null or series_total is null or series_number <= series_total)
);
create index on public.hw_cars (collection_id, norm_key);
create index on public.hw_cars (collection_id, barcode);
create index on public.hw_cars (collection_id, toy_number);
create index cars_casting_trgm on public.hw_cars using gin (casting_name extensions.gin_trgm_ops);

create table public.hw_car_images (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.hw_cars (id) on delete cascade,
  collection_id uuid not null references public.hw_collections (id) on delete cascade,
  side hw_image_side not null,
  source hw_image_source not null,
  is_reference boolean not null default false,
  storage_path text not null,
  thumb_path text,
  source_url text,
  source_domain text,
  width int,
  height int,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (car_id, side)
);

-- Listas de deseados (la UI llega en la Etapa 2; la tabla y su RLS quedan listas).
create table public.hw_wishlist_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.hw_collections (id) on delete cascade,
  casting_name text not null check (length(trim(casting_name)) between 1 and 120),
  brand_id uuid references public.hw_brands (id) on delete set null,
  line_id uuid references public.hw_lines (id) on delete set null,
  year int check (year between 1950 and 2100),
  color text,
  mini_collection text,
  toy_number text,
  priority smallint not null default 2 check (priority between 1 and 3),
  link text,
  notes text,
  purchased_car_id uuid references public.hw_cars (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create trigger collections_updated before update on public.hw_collections
  for each row execute function public.hw_set_updated_at();
create or replace function public.hw_cars_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end $$;
create trigger cars_updated before update on public.hw_cars
  for each row execute function public.hw_cars_touch();

-- ───────────────────────── Funciones de permisos ─────────────────────────
-- SECURITY DEFINER para evitar recursión de RLS sobre hw_collection_members.
create or replace function public.hw_has_role(cid uuid, min_role hw_member_role)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.hw_collection_members m
    where m.collection_id = cid
      and m.email = lower(auth.jwt() ->> 'email')
      and case min_role
            when 'viewer' then true
            when 'editor' then m.role in ('owner', 'editor')
            when 'owner'  then m.role = 'owner'
          end
  )
$$;
revoke all on function public.hw_has_role(uuid, hw_member_role) from public;
grant execute on function public.hw_has_role(uuid, hw_member_role) to authenticated;

-- ───────────────────────── Triggers de negocio ─────────────────────────
-- Al registrarse: vincular invitaciones pendientes por correo (no toca public.profiles ni otras apps).
create or replace function public.hw_handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  update public.hw_collection_members set user_id = new.id
  where email = lower(new.email) and user_id is null;
  return new;
end $$;
create trigger hw_on_auth_user_created after insert on auth.users
  for each row execute function public.hw_handle_new_user();

-- Al crear una colección: el creador es dueño y se cargan listas iniciales.
create or replace function public.hw_handle_new_collection()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_email text;
begin
  select lower(email) into owner_email from auth.users where id = new.owner_id;
  insert into public.hw_collection_members (collection_id, email, user_id, role, invited_by)
  values (new.id, owner_email, new.owner_id, 'owner', new.owner_id);
  insert into public.hw_brands (collection_id, name, sort)
  select new.id, b, i from unnest(array['Hot Wheels', 'Matchbox', 'Fantasía', 'Otra']) with ordinality as t(b, i);
  insert into public.hw_lines (collection_id, name, sort)
  select new.id, l, i from unnest(array['Mainline', 'Premium', 'Car Culture', 'Silver Series', 'RLC', 'Treasure Hunt', 'Super Treasure Hunt', 'Otra']) with ordinality as t(l, i);
  return new;
end $$;
create trigger on_collection_created after insert on public.hw_collections
  for each row execute function public.hw_handle_new_collection();

-- Una colección nunca se queda sin dueño, y el dueño no se degrada por esta vía.
create or replace function public.hw_guard_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner'
     and exists (select 1 from public.hw_collections where id = old.collection_id) then
    if (tg_op = 'DELETE' or new.role <> 'owner') and
       (select count(*) from public.hw_collection_members
        where collection_id = old.collection_id and role = 'owner') <= 1 then
      raise exception 'La colección debe tener al menos un dueño' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    new.email := lower(trim(new.email));
    if new.user_id is null then
      select id into new.user_id from auth.users where lower(email) = new.email limit 1;
    end if;
    return new;
  end if;
  return old;
end $$;
create trigger collection_members_guard before insert or update or delete on public.hw_collection_members
  for each row execute function public.hw_guard_members();

-- Verificación de duplicados en el servidor: no se guarda otro carro con el
-- mismo casting + año + color sin confirmar explícitamente que es una variante.
create or replace function public.hw_guard_duplicate_car()
returns trigger language plpgsql as $$
begin
  -- Sin permiso de edición se deja que RLS rechace con su propio error.
  if new.variant_confirmed or not public.hw_has_role(new.collection_id, 'editor') then
    return new;
  end if;
  if exists (
    select 1 from public.hw_cars c
    where c.collection_id = new.collection_id
      and c.norm_key = (coalesce(public.hw_norm(new.casting_name), '') || '|' || coalesce(new.year::text, '') || '|' || coalesce(public.hw_norm(new.color), ''))
      and c.id <> new.id
  ) then
    raise exception 'DUPLICATE_CAR' using errcode = 'P0001',
      hint = 'Ya existe un carro con el mismo casting, año y color. Confirma que es una variante distinta.';
  end if;
  return new;
end $$;
create trigger cars_duplicate_guard before insert or update of casting_name, year, color, variant_confirmed on public.hw_cars
  for each row execute function public.hw_guard_duplicate_car();

-- La imagen debe pertenecer a la misma colección que el carro.
create or replace function public.hw_guard_car_image()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.hw_cars where id = new.car_id and collection_id = new.collection_id) then
    raise exception 'La imagen no corresponde a la colección del carro';
  end if;
  if split_part(new.storage_path, '/', 1) <> new.collection_id::text then
    raise exception 'Ruta de imagen inválida';
  end if;
  return new;
end $$;
create trigger car_images_guard before insert or update on public.hw_car_images
  for each row execute function public.hw_guard_car_image();

-- Posibles duplicados para mostrar en la app antes de guardar.
create or replace function public.hw_find_duplicates(cid uuid, p_casting text, p_year int, p_color text, p_exclude uuid default null)
returns setof public.hw_cars language sql stable
set search_path = public
as $$
  select * from public.hw_cars c
  where c.collection_id = cid
    and public.hw_has_role(cid, 'viewer')
    and c.norm_key = (coalesce(public.hw_norm(p_casting), '') || '|' || coalesce(p_year::text, '') || '|' || coalesce(public.hw_norm(p_color), ''))
    and (p_exclude is null or c.id <> p_exclude)
$$;

-- ───────────────────────── RLS ─────────────────────────
alter table public.hw_collections enable row level security;
alter table public.hw_collection_members enable row level security;
alter table public.hw_brands enable row level security;
alter table public.hw_lines enable row level security;
alter table public.hw_cars enable row level security;
alter table public.hw_car_images enable row level security;
alter table public.hw_wishlist_items enable row level security;

-- hw_collections
create policy collections_select on public.hw_collections for select to authenticated
  using (public.hw_has_role(id, 'viewer'));
create policy collections_insert on public.hw_collections for insert to authenticated
  with check (owner_id = auth.uid());
create policy collections_update on public.hw_collections for update to authenticated
  using (public.hw_has_role(id, 'owner')) with check (public.hw_has_role(id, 'owner'));
create policy collections_delete on public.hw_collections for delete to authenticated
  using (public.hw_has_role(id, 'owner'));

-- hw_collection_members: cualquier miembro ve quién más tiene acceso; solo el dueño gestiona.
create policy members_select on public.hw_collection_members for select to authenticated
  using (public.hw_has_role(collection_id, 'viewer'));
create policy members_insert on public.hw_collection_members for insert to authenticated
  with check (public.hw_has_role(collection_id, 'owner'));
create policy members_update on public.hw_collection_members for update to authenticated
  using (public.hw_has_role(collection_id, 'owner')) with check (public.hw_has_role(collection_id, 'owner'));
create policy members_delete on public.hw_collection_members for delete to authenticated
  using (public.hw_has_role(collection_id, 'owner') or email = lower(auth.jwt() ->> 'email'));

-- Tablas de contenido: leer = miembro; escribir = editor o dueño.
do $$
declare t text;
begin
  foreach t in array array['hw_brands', 'hw_lines', 'hw_cars', 'hw_car_images', 'hw_wishlist_items'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.hw_has_role(collection_id, ''viewer''))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.hw_has_role(collection_id, ''editor''))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.hw_has_role(collection_id, ''editor'')) with check (public.hw_has_role(collection_id, ''editor''))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.hw_has_role(collection_id, ''editor''))', t);
  end loop;
end $$;

-- Impedir mover un carro a otra colección.
create or replace function public.hw_lock_collection_id()
returns trigger language plpgsql as $$
begin
  if new.collection_id <> old.collection_id then
    raise exception 'No se puede cambiar la colección de un registro';
  end if;
  return new;
end $$;
create trigger cars_lock before update on public.hw_cars for each row execute function public.hw_lock_collection_id();
create trigger car_images_lock before update on public.hw_car_images for each row execute function public.hw_lock_collection_id();
create trigger members_lock before update on public.hw_collection_members for each row execute function public.hw_lock_collection_id();

-- ───────────────────────── Almacenamiento ─────────────────────────
-- Bucket privado; ruta: {collection_id}/{car_id}/{archivo}. Límite 5 MB, solo imágenes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hw-car-images', 'hw-car-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.hw_storage_collection(path text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create policy hw_car_images_read on storage.objects for select to authenticated using (
  bucket_id = 'hw-car-images' and public.hw_has_role(public.hw_storage_collection(name), 'viewer')
);
create policy hw_car_images_write on storage.objects for insert to authenticated with check (
  bucket_id = 'hw-car-images' and public.hw_has_role(public.hw_storage_collection(name), 'editor')
);
create policy hw_car_images_modify on storage.objects for update to authenticated using (
  bucket_id = 'hw-car-images' and public.hw_has_role(public.hw_storage_collection(name), 'editor')
);
create policy hw_car_images_remove on storage.objects for delete to authenticated using (
  bucket_id = 'hw-car-images' and public.hw_has_role(public.hw_storage_collection(name), 'editor')
);

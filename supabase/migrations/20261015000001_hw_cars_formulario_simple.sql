-- Formulario simplificado: carro real (marca + línea del vehículo) o fantasía (nombre),
-- serie con su número propio y una agrupación personal del usuario.
-- Solo agrega columnas a hw_cars; no toca nada fuera de las tablas hw_.

alter table public.hw_cars
  add column is_real boolean,                                   -- null = no indicado
  add column real_model text,                                   -- "Línea" del vehículo real (ej. Camaro); real_maker = Marca
  add column mini_number int check (mini_number > 0),           -- número dentro de la serie (ej. 3 de 10)
  add column mini_total int check (mini_total > 0),
  add column user_group text,                                   -- agrupación personal
  add constraint hw_cars_mini_range check (mini_number is null or mini_total is null or mini_number <= mini_total);

comment on column public.hw_cars.mini_collection is 'Serie / mini colección (ej. HW Flames)';
comment on column public.hw_cars.series_number is '# del carro en la colección del año (ej. 5 de 250)';
comment on column public.hw_cars.user_group is 'Agrupación personal definida por el usuario';

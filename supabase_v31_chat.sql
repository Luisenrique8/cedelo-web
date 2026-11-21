-- ============================================================
--  CÉDELO · v31 · Chat mejorado
--  Pegar TODO en Supabase → SQL Editor → Run (una sola vez).
--  Es seguro volver a ejecutarlo: no borra datos.
--  Agrega: reservar para un vecino, "visto" (✓✓), archivar chats.
-- ============================================================

-- 1) RESERVAR: a qué vecino se le reservó el artículo
alter table public.articulos
  add column if not exists reservado_para uuid references public.perfiles(id) on delete set null;

-- 2) VISTO y ARCHIVAR: por cada persona de la conversación
alter table public.conversaciones
  add column if not exists leido_dueno          timestamptz,
  add column if not exists leido_interesado     timestamptz,
  add column if not exists archivado_dueno      boolean not null default false,
  add column if not exists archivado_interesado boolean not null default false;

-- 3) Marcar como leído (solo tu lado de la conversación)
create or replace function public.marcar_leido(conv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update conversaciones set
    leido_dueno      = case when dueno      = auth.uid() then now() else leido_dueno end,
    leido_interesado = case when interesado = auth.uid() then now() else leido_interesado end
  where id = conv and auth.uid() in (dueno, interesado);
end $$;

-- 4) Archivar / desarchivar (solo tu lado; el otro vecino no se entera)
create or replace function public.archivar_chat(conv uuid, valor boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update conversaciones set
    archivado_dueno      = case when dueno      = auth.uid() then valor else archivado_dueno end,
    archivado_interesado = case when interesado = auth.uid() then valor else archivado_interesado end
  where id = conv and auth.uid() in (dueno, interesado);
end $$;

revoke all on function public.marcar_leido(uuid) from public, anon;
revoke all on function public.archivar_chat(uuid, boolean) from public, anon;
grant execute on function public.marcar_leido(uuid) to authenticated;
grant execute on function public.archivar_chat(uuid, boolean) to authenticated;

-- 5) Si te escriben en un chat que archivaste, vuelve solo a "Activos"
create or replace function public.desarchivar_al_escribir()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update conversaciones set
    archivado_dueno      = case when dueno      <> new.autor then false else archivado_dueno end,
    archivado_interesado = case when interesado <> new.autor then false else archivado_interesado end
  where id = new.conversacion;
  return new;
end $$;

drop trigger if exists tr_desarchivar_al_escribir on public.mensajes;
create trigger tr_desarchivar_al_escribir
  after insert on public.mensajes
  for each row execute function public.desarchivar_al_escribir();

-- 6) Tiempo real: que el "visto" y la reserva se actualicen al instante
do $$
begin
  begin alter publication supabase_realtime add table public.conversaciones; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.articulos;      exception when duplicate_object then null; end;
end $$;

-- 7) En el chat solo se pueden enviar FOTOS (máx. 10 MB)
update storage.buckets
   set allowed_mime_types = array['image/*'], file_size_limit = 10485760
 where id = 'adjuntos';

-- 8) Registro: ¿acepta recibir novedades por correo? (opcional, por defecto NO)
alter table public.perfiles
  add column if not exists acepta_novedades boolean not null default false;

-- Listo. Debe decir "Success. No rows returned".

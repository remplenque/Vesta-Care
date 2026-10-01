-- Crea el usuario demo "Don Luis" (Luis Soto) + su contacto de emergencia y deja la BD en modo 'full'.
-- Correr en el SQL Editor de Supabase (o vía MCP execute_sql) reemplazando email y password
-- por DEMO_USER_EMAIL / DEMO_USER_PASSWORD del .env. Idempotente: si el email ya existe no hace nada.
-- El uuid que devuelve va en NEXT_PUBLIC_DEMO_USER_ID.

do $$
declare
  v_email text := 'demo@vestacare.cl';
  v_password text := 'CAMBIAR_POR_DEMO_USER_PASSWORD';
  v_id uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = v_email) then
    raise notice 'El usuario % ya existe', v_email;
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Luis Soto"}', now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now());

  -- El profile lo crea el trigger on_auth_user_created
  update public.profiles set birth_date = '1948-03-12', timezone = 'America/Santiago' where id = v_id;

  insert into public.emergency_contacts (user_id, name, relation, phone)
  values (v_id, 'Baptiste Soto', 'hijo', '+56 9 8765 4321');

  perform public.reset_demo('full', v_id);
end $$;

select p.id as demo_user_id, ec.access_token as contact_token
from public.profiles p
join auth.users u on u.id = p.id
left join public.emergency_contacts ec on ec.user_id = p.id
where u.email = 'demo@vestacare.cl';

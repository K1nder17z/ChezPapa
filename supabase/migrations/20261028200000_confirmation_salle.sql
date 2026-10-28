-- Le restaurant confirme une commande envoyée par le client, sans QR de récupération.

create or replace function public.assert_order_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if not (
      (old.status = 'draft' and new.status in ('submitted', 'cancelled')) or
      (old.status = 'submitted' and new.status in ('ready_for_pickup', 'claimed', 'cancelled')) or
      (old.status = 'ready_for_pickup' and new.status in ('claimed', 'cancelled')) or
      (old.status = 'claimed' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'transition interdite' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.assert_order_transition() from public, anon, authenticated;

-- Lock down column tampering on user-scoped UPDATEs.
-- Service-role (admin) writes have auth.uid() = NULL and are exempt.

-- 1) direct_messages: recipients may only change read_at
create or replace function public.direct_messages_recipient_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- privileged writes (service role / no JWT) are exempt
  if auth.uid() is null then
    return new;
  end if;
  if new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.body is distinct from old.body
     or new.media_path is distinct from old.media_path
     or new.media_type is distinct from old.media_type
     or new.order_id is distinct from old.order_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Recipients may only update read_at on direct messages';
  end if;
  return new;
end;
$$;

drop trigger if exists direct_messages_recipient_update_guard on public.direct_messages;
create trigger direct_messages_recipient_update_guard
before update on public.direct_messages
for each row execute function public.direct_messages_recipient_update_guard();

-- 2) orders: buyers may not change financial, escrow, or lifecycle fields.
-- All legitimate buyer actions (confirm receipt, dispute, etc.) run through
-- trusted server logic with the service role, which is exempt.
create or replace function public.orders_buyer_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.seller_id is distinct from old.seller_id
     or new.buyer_id is distinct from old.buyer_id
     or new.product_id is distinct from old.product_id
     or new.status is distinct from old.status
     or new.escrow_status is distinct from old.escrow_status
     or new.total_usd is distinct from old.total_usd
     or new.seller_share_usd is distinct from old.seller_share_usd
     or new.platform_share_usd is distinct from old.platform_share_usd
     or new.display_currency is distinct from old.display_currency
     or new.display_total is distinct from old.display_total
     or new.original_currency is distinct from old.original_currency
     or new.original_amount is distinct from old.original_amount
     or new.fx_snapshot is distinct from old.fx_snapshot
     or new.paid_at is distinct from old.paid_at
     or new.refunded_at is distinct from old.refunded_at
     or new.released_at is distinct from old.released_at
     or new.released_by is distinct from old.released_by
     or new.delivered_at is distinct from old.delivered_at
     or new.delivered_by is distinct from old.delivered_by
     or new.buyer_confirmed_at is distinct from old.buyer_confirmed_at
     or new.dispute_status is distinct from old.dispute_status
     or new.auto_release_at is distinct from old.auto_release_at
     or new.auto_refund_at is distinct from old.auto_refund_at
     or new.payout_release_at is distinct from old.payout_release_at
     or new.paystack_ref is distinct from old.paystack_ref
     or new.payment_method is distinct from old.payment_method then
    raise exception 'Order financial and escrow fields can only change through Oventric checkout and settlement';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_buyer_update_guard on public.orders;
create trigger orders_buyer_update_guard
before update on public.orders
for each row execute function public.orders_buyer_update_guard();
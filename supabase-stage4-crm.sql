-- Precision Electronics Repair — workshop software, stage 4: CRM
-- Contacts, trade accounts, leads pipeline, follow-ups and reporting.
-- Run after supabase-stage3.sql

-- ---------------------------------------------------------------
-- Contacts (customers and trade accounts)
-- ---------------------------------------------------------------

create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'customer',   -- customer | trade
  name        text,
  company     text,
  email       text,
  phone       text,
  address     text,
  notes       text,
  source      text,                                -- how they found you
  created_at  timestamptz not null default now()
);

create unique index if not exists contacts_email_key on public.contacts (lower(email)) where email is not null;

alter table public.contacts enable row level security;

drop policy if exists "admin all contacts" on public.contacts;
create policy "admin all contacts" on public.contacts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.jobs add column if not exists contact_id uuid references public.contacts(id);

-- ---------------------------------------------------------------
-- Leads (prospects before they become jobs)
-- ---------------------------------------------------------------

create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  company      text not null,
  contact_name text,
  email        text,
  phone        text,
  town         text,
  type         text default 'phone/laptop shop',
  source       text,
  status       text not null default 'to_contact',  -- to_contact | contacted | interested | quoted | won | lost
  notes        text,
  next_action  date,
  contact_id   uuid references public.contacts(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.leads enable row level security;

drop policy if exists "admin all leads" on public.leads;
create policy "admin all leads" on public.leads
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- Follow-ups (things to chase)
-- ---------------------------------------------------------------

create table if not exists public.follow_ups (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  due_date    date not null default current_date,
  done        boolean not null default false,
  done_at     timestamptz,
  job_id      uuid references public.jobs(id),
  lead_id     uuid references public.leads(id),
  contact_id  uuid references public.contacts(id),
  created_at  timestamptz not null default now()
);

alter table public.follow_ups enable row level security;

drop policy if exists "admin all follow ups" on public.follow_ups;
create policy "admin all follow ups" on public.follow_ups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- Link jobs to contacts automatically
-- ---------------------------------------------------------------

create or replace function public.find_or_create_contact(
  p_name text, p_email text, p_phone text, p_company text default null, p_kind text default 'customer'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_email),'') <> '' then
    select id into v_id from public.contacts where lower(email) = lower(trim(p_email));
  end if;

  if v_id is null and coalesce(trim(p_phone),'') <> '' then
    select id into v_id from public.contacts
     where regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
       and regexp_replace(p_phone, '[^0-9]', '', 'g') <> ''
     limit 1;
  end if;

  if v_id is null then
    insert into public.contacts (kind, name, email, phone, company)
    values (coalesce(p_kind,'customer'), nullif(trim(coalesce(p_name,'')),''),
            nullif(trim(coalesce(p_email,'')),''), nullif(trim(coalesce(p_phone,'')),''),
            nullif(trim(coalesce(p_company,'')),''))
    returning id into v_id;
  else
    update public.contacts
       set name    = coalesce(nullif(trim(coalesce(p_name,'')),''), name),
           phone   = coalesce(phone, nullif(trim(coalesce(p_phone,'')),'')),
           company = coalesce(company, nullif(trim(coalesce(p_company,'')),''))
     where id = v_id;
  end if;

  return v_id;
end;
$$;

-- create_job now also files the customer in the CRM
drop function if exists public.create_job(text, text);

create or replace function public.create_job(
  p_customer_name  text default null,
  p_customer_email text default null,
  p_customer_phone text default null,
  p_company        text default null
)
returns table (job_number text, access_key text, link text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_next int;
  v_num  text;
  v_key  text;
  v_contact uuid;
begin
  if not public.is_admin() then raise exception 'Not authorised.'; end if;

  select coalesce(max((substring(j.job_number from 5))::int), 2416) + 1
    into v_next from public.jobs j where j.job_number ~ '^PER-[0-9]+$';

  v_num := 'PER-' || v_next::text;
  v_key := encode(extensions.gen_random_bytes(12), 'hex');

  if coalesce(trim(coalesce(p_customer_email,'')),'') <> '' or coalesce(trim(coalesce(p_customer_phone,'')),'') <> '' then
    v_contact := public.find_or_create_contact(
      p_customer_name, p_customer_email, p_customer_phone, p_company,
      case when coalesce(trim(coalesce(p_company,'')),'') <> '' then 'trade' else 'customer' end
    );
  end if;

  insert into public.jobs (job_number, access_key, customer_name, customer_email, contact_id)
  values (v_num, v_key,
          nullif(trim(coalesce(p_customer_name,'')),''),
          nullif(trim(coalesce(p_customer_email,'')),''),
          v_contact);

  return query select v_num, v_key,
    'https://precisionelectronicsrepair.co.uk/intake.html?job=' || v_num || '&k=' || v_key;
end;
$$;

revoke all on function public.create_job(text, text, text, text) from public, anon;
grant execute on function public.create_job(text, text, text, text) to authenticated;

-- fill contact details in from the booking form once it arrives
create or replace function public.sync_contact_from_intake()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_contact uuid;
begin
  select contact_id into v_contact from public.jobs where id = new.job_id;

  if v_contact is null then
    v_contact := public.find_or_create_contact(new.customer_name, new.email, new.phone, null, 'customer');
    update public.jobs set contact_id = v_contact where id = new.job_id;
  end if;

  update public.contacts
     set name    = coalesce(nullif(trim(coalesce(new.customer_name,'')),''), name),
         phone   = coalesce(nullif(trim(coalesce(new.phone,'')),''), phone),
         address = coalesce(nullif(trim(coalesce(new.address,'')),''), address)
   where id = v_contact;

  return new;
end;
$$;

drop trigger if exists intakes_sync_contact on public.intakes;
create trigger intakes_sync_contact
  after insert on public.intakes
  for each row execute function public.sync_contact_from_intake();

-- backfill contacts for jobs that already exist
do $$
declare r record; v_id uuid;
begin
  for r in select j.id, j.job_number, coalesce(i.customer_name, j.customer_name) as nm,
                  coalesce(i.email, j.customer_email) as em, i.phone as ph, i.address as ad
             from public.jobs j
             left join public.intakes i on i.job_id = j.id
            where j.contact_id is null
  loop
    if coalesce(r.em,'') <> '' or coalesce(r.ph,'') <> '' then
      v_id := public.find_or_create_contact(r.nm, r.em, r.ph, null, 'customer');
      update public.jobs set contact_id = v_id where id = r.id;
      update public.contacts set address = coalesce(address, r.ad) where id = v_id;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------
-- Turning a lead into a job
-- ---------------------------------------------------------------

create or replace function public.convert_lead(p_lead_id uuid)
returns table (job_number text, access_key text, link text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_lead public.leads;
  v_contact uuid;
  v_job record;
begin
  if not public.is_admin() then raise exception 'Not authorised.'; end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if not found then raise exception 'Lead not found.'; end if;

  v_contact := public.find_or_create_contact(v_lead.contact_name, v_lead.email, v_lead.phone, v_lead.company, 'trade');

  update public.leads set status = 'won', contact_id = v_contact, updated_at = now() where id = p_lead_id;

  for v_job in select * from public.create_job(v_lead.contact_name, v_lead.email, v_lead.phone, v_lead.company) loop
    job_number := v_job.job_number;
    access_key := v_job.access_key;
    link := v_job.link;
    return next;
  end loop;
end;
$$;

grant execute on function public.convert_lead(uuid) to authenticated;

-- ---------------------------------------------------------------
-- Views for the CRM pages and reports
-- ---------------------------------------------------------------

create or replace view public.contact_list
with (security_invoker = true) as
select
  c.*,
  (select count(*) from public.jobs j where j.contact_id = c.id)                     as job_count,
  (select coalesce(sum(v.amount), 0) from public.invoices v
     join public.jobs j2 on j2.id = v.job_id
    where j2.contact_id = c.id and v.status = 'paid')                                as total_paid,
  (select max(j3.created_at) from public.jobs j3 where j3.contact_id = c.id)         as last_job_at
from public.contacts c;

grant select on public.contact_list to authenticated;

create or replace view public.report_monthly
with (security_invoker = true) as
select
  to_char(date_trunc('month', j.created_at), 'YYYY-MM')                              as month,
  count(*)                                                                            as jobs,
  count(*) filter (where j.status = 'returned')                                       as completed,
  count(*) filter (where j.status = 'unrepairable')                                   as unrepairable,
  (select coalesce(sum(v.amount),0) from public.invoices v
     join public.jobs jj on jj.id = v.job_id
    where v.status = 'paid'
      and date_trunc('month', jj.created_at) = date_trunc('month', j.created_at))     as revenue
from public.jobs j
group by date_trunc('month', j.created_at)
order by 1 desc;

grant select on public.report_monthly to authenticated;

create or replace view public.report_summary
with (security_invoker = true) as
select
  (select count(*) from public.jobs)                                                  as jobs_total,
  (select count(*) from public.jobs
    where status not in ('returned','unrepairable','declined'))                       as jobs_open,
  (select coalesce(sum(amount),0) from public.invoices where status = 'paid')         as revenue_total,
  (select coalesce(sum(amount),0) from public.invoices where status = 'unpaid')       as owed,
  (select coalesce(round(avg(amount), 2),0) from public.invoices)                     as avg_job,
  (select count(*) from public.quotes)                                                as quotes_sent,
  (select count(*) from public.quotes where status = 'approved')                      as quotes_approved,
  (select count(*) from public.contacts)                                              as contacts,
  (select count(*) from public.contacts c where
     (select count(*) from public.jobs j where j.contact_id = c.id) > 1)              as repeat_customers,
  (select count(*) from public.leads where status not in ('won','lost'))              as leads_open,
  (select count(*) from public.follow_ups where not done and due_date <= current_date) as followups_due;

grant select on public.report_summary to authenticated;

-- job_detail also carries the contact link
create or replace view public.job_detail
with (security_invoker = true) as
select
  j.id, j.job_number, j.status, j.created_at, j.link_sent_at, j.access_key, j.contact_id,
  coalesce(i.customer_name, j.customer_name) as customer_name,
  coalesce(i.email, j.customer_email)        as customer_email,
  i.phone, i.address, i.device_type, i.make_model, i.serial_imei,
  i.fault_description, i.fault_history, i.accessories, i.max_spend,
  i.signature_name, i.submitted_at, i.record_hash,
  (i.id is not null) as has_intake
from public.jobs j
left join public.intakes i on i.job_id = j.id;

grant select on public.job_detail to authenticated;

create table if not exists public.project_own_stay_reasons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  explanation text,
  how_to_sell text,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.project_investment_reasons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  investment_logic text,
  how_to_sell text,
  supporting_data text,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.project_customer_concerns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  customer_concern text,
  real_issue text,
  analysis text,
  suggested_counter text,
  supporting_data text,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.project_own_stay_reasons enable row level security;
alter table public.project_investment_reasons enable row level security;
alter table public.project_customer_concerns enable row level security;

create index if not exists project_own_stay_reasons_project_sort_created_idx
  on public.project_own_stay_reasons(project_id, sort_order, created_at)
  where is_deleted = false;

create index if not exists project_investment_reasons_project_sort_created_idx
  on public.project_investment_reasons(project_id, sort_order, created_at)
  where is_deleted = false;

create index if not exists project_customer_concerns_project_sort_created_idx
  on public.project_customer_concerns(project_id, sort_order, created_at)
  where is_deleted = false;

create or replace function public.set_project_knowledge_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_project_own_stay_reasons_updated_at on public.project_own_stay_reasons;
create trigger set_project_own_stay_reasons_updated_at
before update on public.project_own_stay_reasons
for each row execute function public.set_project_knowledge_updated_at();

drop trigger if exists set_project_investment_reasons_updated_at on public.project_investment_reasons;
create trigger set_project_investment_reasons_updated_at
before update on public.project_investment_reasons
for each row execute function public.set_project_knowledge_updated_at();

drop trigger if exists set_project_customer_concerns_updated_at on public.project_customer_concerns;
create trigger set_project_customer_concerns_updated_at
before update on public.project_customer_concerns
for each row execute function public.set_project_knowledge_updated_at();

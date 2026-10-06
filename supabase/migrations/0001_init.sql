-- ==========================================
-- Manga Reader — Supabase schema (Postgres + Auth + RLS)
-- الصق هذا كامل في Supabase SQL Editor وشغّله، أو عبر: supabase db push
-- ==========================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------- profiles (مرتبطة بـ auth.users من Supabase Auth) ----------
create table public.profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    is_admin     boolean not null default false,
    created_at   timestamptz not null default now()
);

-- يُنشئ صف profile تلقائيًا عند تسجيل أي مستخدم جديد
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- المحتوى (زي ما هي تقريبًا) ----------
create table public.sources (
    id              serial primary key,
    name            varchar(150) not null,
    base_url        text,
    api_key         text,
    license_status  varchar(50) not null default 'unverified',
    notes           text,
    is_active       boolean not null default true,
    created_at      timestamptz not null default now()
);

create table public.series (
    id              serial primary key,
    title_ar        varchar(255) not null,
    title_original  varchar(255),
    slug            varchar(255) unique not null,
    description_ar  text,
    cover_url       text,
    status          varchar(30) not null default 'ongoing',
    author          varchar(150),
    artist          varchar(150),
    genres          text[],
    license_status  varchar(50) not null default 'unverified',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index idx_series_title on public.series using gin (to_tsvector('simple', title_ar || ' ' || coalesce(title_original, '')));

create table public.series_sources (
    id           serial primary key,
    series_id    integer not null references public.series(id) on delete cascade,
    source_id    integer not null references public.sources(id) on delete cascade,
    external_ref text,
    unique (series_id, source_id)
);

create table public.chapters (
    id             serial primary key,
    series_id      integer not null references public.series(id) on delete cascade,
    source_id      integer references public.sources(id),
    chapter_number numeric(10,2) not null,
    title_ar       varchar(255),
    status         varchar(30) not null default 'pending',
    -- pending -> downloading -> ocr -> translating -> ready -> failed
    released_at    timestamptz,
    created_at     timestamptz not null default now(),
    unique (series_id, chapter_number)
);
create index idx_chapters_series on public.chapters(series_id);

create table public.pages (
    id                    serial primary key,
    chapter_id            integer not null references public.chapters(id) on delete cascade,
    page_number           integer not null,
    original_image_url    text,
    ocr_text              jsonb,
    translated_text       jsonb, -- [{x,y,width,height,text,translated}] — يُرسم فوق الصورة بالمتصفح
    unique (chapter_id, page_number)
);

create table public.glossary_terms (
    id            serial primary key,
    series_id     integer not null references public.series(id) on delete cascade,
    original_term varchar(150) not null,
    arabic_term   varchar(150) not null,
    term_type     varchar(30) default 'name',
    unique (series_id, original_term)
);

create table public.processing_jobs (
    id            serial primary key,
    chapter_id    integer not null references public.chapters(id) on delete cascade,
    stage         varchar(30) not null,
    status        varchar(30) not null default 'queued',
    error_message text,
    started_at    timestamptz,
    finished_at   timestamptz
);

create table public.system_settings (
    key   varchar(100) primary key,
    value text not null
);
insert into public.system_settings (key, value) values ('auto_update_enabled', 'false');

create table public.favorites (
    user_id    uuid not null references public.profiles(id) on delete cascade,
    series_id  integer not null references public.series(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, series_id)
);

create table public.reading_progress (
    user_id    uuid not null references public.profiles(id) on delete cascade,
    series_id  integer not null references public.series(id) on delete cascade,
    chapter_id integer not null references public.chapters(id) on delete cascade,
    last_page  integer not null default 1,
    updated_at timestamptz not null default now(),
    primary key (user_id, series_id)
);

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.sources enable row level security;
alter table public.series enable row level security;
alter table public.series_sources enable row level security;
alter table public.chapters enable row level security;
alter table public.pages enable row level security;
alter table public.glossary_terms enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.system_settings enable row level security;
alter table public.favorites enable row level security;
alter table public.reading_progress enable row level security;

-- دالة مساعدة: هل المستخدم الحالي مشرف؟
create function public.is_admin()
returns boolean as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$ language sql stable security definer;

-- profiles: كل واحد يشوف/يعدّل بروفايله بس (ما يقدر يغيّر is_admin نفسه لأنه ما مسموح
-- له بالـ UPDATE إلا لو مشرف أصلًا — التفعيل الأول لازم من SQL Editor يدويًا)
create policy "profiles readable by owner" on public.profiles for select using (id = auth.uid());
create policy "profiles updatable by owner" on public.profiles for update using (id = auth.uid());

-- محتوى القراءة: عام للجميع (حتى الزوار)
create policy "series public read" on public.series for select using (true);
create policy "chapters public read" on public.chapters for select using (true);
create policy "pages public read" on public.pages for select using (true);
create policy "sources public read" on public.sources for select using (true);
create policy "glossary public read" on public.glossary_terms for select using (true);

-- كتابة المحتوى: مشرف بس
create policy "series admin write" on public.series for all using (public.is_admin()) with check (public.is_admin());
create policy "chapters admin write" on public.chapters for all using (public.is_admin()) with check (public.is_admin());
create policy "pages admin write" on public.pages for all using (public.is_admin()) with check (public.is_admin());
create policy "sources admin write" on public.sources for all using (public.is_admin()) with check (public.is_admin());
create policy "series_sources admin write" on public.series_sources for all using (public.is_admin()) with check (public.is_admin());
create policy "glossary admin write" on public.glossary_terms for all using (public.is_admin()) with check (public.is_admin());
create policy "processing_jobs admin read" on public.processing_jobs for select using (public.is_admin());
create policy "system_settings admin all" on public.system_settings for all using (public.is_admin()) with check (public.is_admin());

-- مفضلة ومتابعة القراءة: كل مستخدم يشوف/يعدّل بياناته بس
create policy "favorites own" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reading_progress own" on public.reading_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- التحديث التلقائي المجدول (pg_cron يستبدل node-cron) ----------
-- ملاحظة: شغّل هذا الجزء من SQL Editor بعد ما تنشر دالة check-new-chapters وتعرف رابطها،
-- أو خله كما هو الآن ويتفعّل لاحقًا. غيّر YOUR_PROJECT_REF و YOUR_SERVICE_ROLE_KEY.
--
-- select cron.schedule(
--   'auto-update-chapters',
--   '*/15 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-new-chapters',
--     headers := jsonb_build_object('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY', 'Content-Type', 'application/json')
--   );
--   $$
-- );

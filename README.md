# Manga Reader — Supabase Edition (لا حاجة لسيرفر)

هذا الإصدار يستغني كليًا عن الباكند القديم (Express/BullMQ/Redis/canvas)
ويعتمد بالكامل على Supabase:

- **قاعدة البيانات:** Supabase Postgres (نفس الجداول القديمة تقريبًا).
- **المصادقة:** Supabase Auth (تسجيل دخول/حساب جاهز، بدل JWT اليدوي).
- **المعالجة بالخلفية (OCR + ترجمة):** Edge Functions تتفعّل تلقائيًا عند
  إضافة فصل جديد (عبر Database Webhook)، وتكمل الشغل بالخلفية بدون ما ينتظر
  المشرف.
- **التحديث التلقائي المجدول:** `pg_cron` يستدعي Edge Function كل 15 دقيقة
  بدل `node-cron`.
- **رسم النص المترجم فوق الصورة:** انتقل إلى **المتصفح نفسه** (Canvas API في
  صفحة القارئ) بدل السيرفر، لأن مكتبة `canvas` ما تشتغل داخل Edge Functions.

## البنية

```
manga-reader/
├── supabase/
│   ├── migrations/0001_init.sql   جداول + RLS + دالة is_admin + جدولة pg_cron (تعليق جاهز للتفعيل)
│   └── functions/
│       ├── process-chapter/       OCR + ترجمة لفصل، تعمل بالخلفية (EdgeRuntime.waitUntil)
│       ├── check-new-chapters/    فحص المصادر المرخّصة واكتشاف فصول جديدة (مجدولة)
│       ├── discover-search/       بحث عن عمل في المصادر المرخّصة (من لوحة التحكم)
│       ├── discover-import/       تجميع كل فصول عمل بعد اختياره
│       └── _shared/sourceConnector.ts
├── frontend/    Next.js + @supabase/supabase-js — الموقع نفسه
└── admin/       Next.js + @supabase/supabase-js — لوحة التحكم
```

## خطوات النشر (بالترتيب)

### 1. أنشئ مشروع Supabase
من https://supabase.com/dashboard → New Project. بعد ما يجهز، من
**Project Settings → API** خذ:
- **Project URL**
- **anon public key**
- **service_role secret key** (سري — لا تحطه بأي كود عام أو frontend)

### 2. طبّق قاعدة البيانات
من **SQL Editor** بالداشبورد، افتح `supabase/migrations/0001_init.sql`
وانسخ محتواه كامل وشغّله. هذا ينشئ الجداول، الصلاحيات (RLS)، ودالة `is_admin()`.

### 3. ثبّت Supabase CLI وانشر الدوال
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF   # موجود برابط مشروعك بالداشبورد

supabase functions deploy process-chapter
supabase functions deploy check-new-chapters
supabase functions deploy discover-search
supabase functions deploy discover-import
```

### 4. اضبط أسرار الدوال (Function Secrets)
```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set OCR_PROVIDER=mock                 # أو google_vision
supabase secrets set TRANSLATION_PROVIDER=mock          # أو claude
supabase secrets set GOOGLE_VISION_API_KEY=xxx           # لو فعّلت google_vision
supabase secrets set ANTHROPIC_API_KEY=xxx                # لو فعّلت claude
```

### 5. فعّل Database Webhook (المعالجة التلقائية بالخلفية)
من **Database → Webhooks** بالداشبورد:
- Table: `chapters`
- Event: `INSERT`
- Type: `Edge Function`
- اختر `process-chapter`

بهذا أي فصل جديد (رفع يدوي أو تجميع تلقائي) يبدأ معالجته بالخلفية لحاله،
بدون ما ينتظر المشرف — بالضبط زي ما طلبت.

### 6. فعّل الجدولة (اختياري، للتحديث التلقائي)
من **SQL Editor**، افتح آخر تعليق بملف `0001_init.sql` (`cron.schedule...`)،
عدّل `YOUR_PROJECT_REF` و `YOUR_SERVICE_ROLE_KEY`، وشغّله. تقدر تشغّله لاحقًا
مو شرط الآن.

### 7. اضبط متغيرات الموقع ولوحة التحكم
في `frontend/.env.local` و `admin/.env.local` (أنشئهم):
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```
**تنبيه:** حط anon key بس هنا، أبدًا لا تحط service_role key في الفرونت أو
اللوحة — هو للدوال (Edge Functions) فقط.

### 8. شغّل محليًا للتجربة
```bash
cd frontend && npm install && npm run dev   # http://localhost:3000
cd admin && npm install && npm run dev      # http://localhost:3001
```

### 9. رشّح نفسك مشرف (مرة وحدة)
سجّل حساب عادي من `/register` بالموقع. بعدها من **SQL Editor**:
```sql
update public.profiles set is_admin = true where id =
  (select id from auth.users where email = 'your@email.com');
```
بعدها سجّل دخولك من لوحة التحكم (`/login`) بنفس الإيميل وكلمة المرور.

### 10. انشر الفرونت واللوحة (بدون أي سيرفر خاص بك)
Vercel لكل واحد لحاله (Root Directory: `frontend` ثم `admin`)، مع نفس متغيرات
البيئة اللي بخطوة 7. خلّي اللوحة إما بدومين خاص ما تشاركه، أو فعّل Password
Protection من إعدادات Vercel — الحماية الأساسية موجودة أصلًا عبر تسجيل
الدخول + فحص `is_admin`، لكن طبقة حماية إضافية أفضل.

## حدود مهمة تعرفها

- **حجم الصور:** الرسم صار بالمتصفح (Canvas)، فما فيه نسخة "جاهزة" مخزّنة —
  كل قارئ يرسمها وقت الفتح. هذا أخف على التخزين لكن يحمّل شوي على جهاز القارئ.
- **وقت تنفيذ Edge Functions:** فيه حد أقصى لوقت التنفيذ (حسب خطتك بـ
  Supabase). فصل فيه صفحات كثير جدًا قد يحتاج تقسيم أو خطة أعلى — إذا واجهت
  هذا، قول لي وأقسّم المعالجة لكل صفحة لحالها بدل الفصل كامل.
- **discover-search / discover-import:** لسا يعملان فقط مع مصادر عندها API
  فعلي تملك صلاحية استخدامه، نفس القيد السابق تمامًا.

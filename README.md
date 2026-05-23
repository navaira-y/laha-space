# Laha Space — Deployment Guide

## Stack
- Node.js + Express + EJS
- Supabase (PostgreSQL) for database
- Hostinger Business Plan (Node.js hosting)

---

## Step 1 — Set up Supabase

1. Go to https://supabase.com and create a free account
2. Create a new project — name it `lahaspace`, pick a strong DB password, save it
3. Wait for the project to be ready (takes about a minute)
4. Go to **SQL Editor** and run the following to create all tables:

```sql
create table admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table applicants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  country_city text not null,
  photo_path text,
  qualifications text,
  experience text,
  categories jsonb default '[]',
  languages jsonb default '[]',
  availability_text text,
  extra_info text,
  stage integer default 1,
  status text default 'active',
  not_proceeding_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table applicant_documents (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid references applicants(id) on delete cascade,
  file_path text not null,
  original_name text not null,
  created_at timestamptz default now()
);

create table stage_notes (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid references applicants(id) on delete cascade,
  note text not null,
  stage_at_time integer,
  created_at timestamptz default now()
);

create table teachers (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid references applicants(id),
  name text not null,
  email text not null,
  photo_path text,
  bio text,
  qualifications text,
  experience text,
  categories jsonb default '[]',
  languages jsonb default '[]',
  laha_endorsement text,
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table teacher_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete cascade,
  day_of_week integer not null,
  start_time text not null,
  end_time text not null
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id),
  student_name text not null,
  student_email text not null,
  student_phone text not null,
  slot_date text not null,
  slot_start_time text not null,
  slot_end_time text not null,
  looking_for text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id),
  student_name text not null,
  rating integer not null,
  review_text text not null,
  is_approved boolean default false,
  created_at timestamptz default now()
);

create table sessions (
  sid text primary key,
  sess jsonb not null,
  expire timestamptz not null
);
create index on sessions (expire);
```

5. Go to **Project Settings → API**
   - Copy **Project URL** → this is your `SUPABASE_URL`
   - Copy **service_role** key (under API keys) → this is your `SUPABASE_SERVICE_KEY`

6. Go to **Project Settings → Database**
   - Copy the **Connection string (URI)** → this is your `DATABASE_URL`
   - Replace `[YOUR-PASSWORD]` in the URI with your DB password

---

## Step 2 — Set up the repo on GitHub

```bash
# In your project folder
git init
git add .
git commit -m "initial commit"

# Create a new repo on github.com named lahaspace
git remote add origin https://github.com/YOUR_USERNAME/lahaspace.git
git branch -M main
git push -u origin main
```

---

## Step 3 — Deploy on Hostinger

1. Log in to Hostinger hPanel
2. Go to **Hosting → Manage → Node.js**
3. Set **Node.js version** to 18 or 20
4. Set **Application root** to `public_html` (or wherever you put the files)
5. Set **Application startup file** to `server.js`
6. Click **Set up environment variables** and add:

```
SUPABASE_URL         = https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY = your-service-role-key
DATABASE_URL         = postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres
SESSION_SECRET       = any-long-random-string-minimum-32-chars
ADMIN_EMAIL          = admin@lahaspace.com
ADMIN_PASSWORD       = YourStrongPasswordHere
PORT                 = 3000
```

7. In Hostinger File Manager (or via SSH), upload all project files to `public_html`
   - Do NOT upload `node_modules/` — Hostinger will install them
   - Do NOT upload `.env` — you set these via hPanel

8. In Hostinger Node.js panel, click **Install dependencies** (runs `npm install`)

9. Run the seed script once to create your admin account:
   ```bash
   node seed.js
   ```
   (You can do this via SSH or Hostinger's terminal)

10. Start the app — click **Restart** in the Node.js panel

---

## Step 4 — Point the domain

1. In hPanel → **Domains**, point `lahaspace.com` to this hosting
2. Enable SSL (free with Hostinger)
3. Your site is live at `https://lahaspace.com`
4. Admin panel is at `https://lahaspace.com/admin`

---

## Admin login

After running `seed.js`, log in with:
- Email: whatever you set as `ADMIN_EMAIL`
- Password: whatever you set as `ADMIN_PASSWORD`

**Change your password after first login.**

---

## How the admin workflow works

1. Teacher submits application → appears in **Applicants** at Stage 1
2. Move them through Stages 1–7 using the stage selector, add notes at each stage
3. When they reach Stage 7, click **Create Teacher Profile**
4. Fill in their profile details, upload photo, add the Laha endorsement note
5. Set their weekly availability (e.g. Monday 7am–10am)
6. Click **Publish** — they appear on the public site
7. Students book slots → shows in **Bookings**
8. Students submit reviews → approve them in **Reviews**

---

## Local development

```bash
cp .env.example .env
# Fill in your real Supabase values in .env
npm install
node seed.js
npm run dev
```

Visit http://localhost:3000

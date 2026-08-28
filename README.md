# SocZen (Next-Gen Architecture)

SocZen is an ultra-modern, AI-native platform for collecting, triaging, and managing premium subscription access requests (e.g. ChatGPT Plus, Canva Pro, Netflix, Spotify, Notion AI, Adobe Creative Cloud).

---

## ⚡ Tech Stack

- **Framework:** [React 19](https://react.dev/) + [TanStack Start](https://tanstack.com/start) (Vite + Nitro Engine)
- **Database & ORM:** [Neon Serverless PostgreSQL](https://neon.tech/) + [Drizzle ORM](https://orm.drizzle.team/) & [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview)
- **AI Intelligence:** [Vercel AI SDK](https://sdk.vercel.ai/) with [Google Gemini](https://ai.google.dev/) for automated request triage and fraud/spam detection
- **Security & Rate Limiting:** [Upstash Redis](https://upstash.com/) (`@upstash/ratelimit`) with graceful in-memory fallback
- **Styling & UI:** [Tailwind CSS v4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) (shadcn/ui design tokens) + Lucide Icons + Recharts
- **Emails:** [Resend](https://resend.com/) for transactional email notifications
- **Deployment:** [Vercel](https://vercel.com/) (Serverless-optimized, zero cold-start database connection via `@neondatabase/serverless`)

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create your local `.env` file:

```bash
cp .env.example .env
```

Set your configuration values:

```env
# Neon Serverless Postgres or Local Docker
DATABASE_URL=postgresql://[user]:[password]@[neon-hostname]/neondb?sslmode=require
DATABASE_SSL=require

# Admin Security
ADMIN_PASSWORD=your-secure-admin-password

# Google Gemini AI (Vercel AI SDK)
GEMINI_API_KEY=your-gemini-api-key

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Resend Email Delivery (Optional)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=SocZen <access@yourdomain.com>
RESEND_ADMIN_EMAIL=admin@yourdomain.com
```

### 3. Setup Database Schema (Drizzle ORM)

Push the Drizzle schema directly to your Neon database:

```bash
npm run db:push
```

Or generate migration files:

```bash
npm run db:generate
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` for the public request flow and `http://localhost:3000/admin` for the admin desk.

---

## 🌐 Deploying to Vercel

1. **Create a Neon Database:**
   - Go to [Neon.tech](https://neon.tech) and create a new project.
   - Copy your connection string (e.g. `postgresql://.../neondb?sslmode=require`).

2. **Push Database Schema to Neon:**
   ```bash
   DATABASE_URL="your-neon-connection-string" npm run db:push
   ```

3. **Deploy on Vercel:**
   - Import your repository on [Vercel](https://vercel.com).
   - In **Project Settings > Environment Variables**, add:
     - `DATABASE_URL` = Your Neon connection string
     - `DATABASE_SSL` = `require`
     - `ADMIN_PASSWORD` = Your desired admin password
     - `GEMINI_API_KEY` = Your Google AI Studio Gemini API key
     - `UPSTASH_REDIS_REST_URL` = Your Upstash REST URL (optional)
     - `UPSTASH_REDIS_REST_TOKEN` = Your Upstash REST Token (optional)
     - `RESEND_API_KEY` = Your Resend API key (optional)
     - `RESEND_FROM_EMAIL` = Sender address (e.g. `SocZen <access@yourdomain.com>`)
     - `RESEND_ADMIN_EMAIL` = Admin notification email
   - Click **Deploy**!

---

## 🛠️ Available Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Starts local development server |
| `npm run build` | Builds the production bundle for Vercel / serverless |
| `npm run preview` | Previews the production build locally |
| `npm run db:generate` | Generates SQL migrations from `src/db/schema.ts` |
| `npm run db:push` | Pushes the Drizzle schema directly to the database |
| `npm run db:studio` | Opens Drizzle Studio GUI for visual database management |
| `npm run lint` | Runs ESLint |
| `npm run format` | Formats files with Prettier |

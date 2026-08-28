import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing");

  const sqlClient = neon(url);
  const db = drizzle(sqlClient, { schema });

  console.log("Seeding initial services and form fields to Neon...");

  const initialServices = [
    { slug: "chatgpt-plus", name: "ChatGPT Plus", category: "AI", emoji: "🤖", bgClass: "bg-brand-lime", sortOrder: 10 },
    { slug: "canva-pro", name: "Canva Pro", category: "Design", emoji: "🎨", bgClass: "bg-brand-cyan", sortOrder: 20 },
    { slug: "netflix", name: "Netflix", category: "Streaming", emoji: "🎬", bgClass: "bg-brand-pink", sortOrder: 30 },
    { slug: "spotify", name: "Spotify Premium", category: "Music", emoji: "🎵", bgClass: "bg-brand-lime", sortOrder: 40 },
    { slug: "youtube-premium", name: "YouTube Premium", category: "Streaming", emoji: "📺", bgClass: "bg-brand-pink", sortOrder: 50 },
    { slug: "adobe-cc", name: "Adobe Creative Cloud", category: "Design", emoji: "🖌️", bgClass: "bg-brand-violet text-white", sortOrder: 60 },
    { slug: "notion-ai", name: "Notion AI", category: "Productivity", emoji: "📝", bgClass: "bg-brand-yellow", sortOrder: 70 },
    { slug: "midjourney", name: "Midjourney", category: "AI", emoji: "🪄", bgClass: "bg-brand-violet text-white", sortOrder: 80 },
    { slug: "grammarly", name: "Grammarly Premium", category: "Productivity", emoji: "✍️", bgClass: "bg-brand-cyan", sortOrder: 90 },
    { slug: "disney-plus", name: "Disney+", category: "Streaming", emoji: "🏰", bgClass: "bg-brand-orange", sortOrder: 100 },
  ];

  for (const s of initialServices) {
    await db
      .insert(schema.services)
      .values({
        slug: s.slug,
        name: s.name,
        category: s.category,
        emoji: s.emoji,
        bgClass: s.bgClass,
        sortOrder: s.sortOrder,
        isActive: true,
      })
      .onConflictDoNothing({ target: schema.services.slug });
  }

  const initialFields = [
    {
      fieldKey: "company",
      label: "Company",
      fieldType: "text" as const,
      placeholder: "Analytical Engines Inc.",
      isRequired: false,
      isBuiltin: true,
      maxLength: 150,
      sortOrder: 10,
    },
    {
      fieldKey: "use_case",
      label: "What will you use these for?",
      fieldType: "textarea" as const,
      placeholder: "Tell us a bit about how you'll use these...",
      isRequired: false,
      isBuiltin: true,
      maxLength: 2000,
      sortOrder: 20,
    },
    {
      fieldKey: "message",
      label: "Anything else?",
      fieldType: "textarea" as const,
      placeholder: "Optional message",
      isRequired: false,
      isBuiltin: true,
      maxLength: 1000,
      sortOrder: 30,
    },
  ];

  for (const f of initialFields) {
    await db
      .insert(schema.formFields)
      .values({
        fieldKey: f.fieldKey,
        label: f.label,
        fieldType: f.fieldType,
        placeholder: f.placeholder,
        isRequired: f.isRequired,
        isBuiltin: f.isBuiltin,
        maxLength: f.maxLength,
        sortOrder: f.sortOrder,
        isActive: true,
      })
      .onConflictDoNothing({ target: schema.formFields.fieldKey });
  }

  console.log("Seeding completed successfully!");
}

seed().catch(console.error);


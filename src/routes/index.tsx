import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Check, ArrowRight, Gift, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { RequestTracker } from "@/components/RequestTracker";
import {
  getPublicCatalog,
  submitSubscriptionRequest,
  trackSubscriptionRequest,
  type PublicService,
  type PublicFormField,
  type PublicTrackedRequest,
} from "@/utils/public.functions";

export const Route = createFileRoute("/")({
  component: Index,
});

type FieldValue = string | boolean;
type SubmittedRequest = {
  email: string;
  name: string;
  referenceCode: string;
  selectedServices: string[];
};

const NAV_LINKS = [
  { href: "#catalog", label: "Subscriptions" },
  { href: "#how", label: "How it works" },
] as const;

type HeroService = Pick<PublicService, "id" | "name" | "emoji" | "category" | "bg_class">;

const HERO_FALLBACK_SERVICES: HeroService[] = [
  {
    id: "chatgpt-plus",
    name: "ChatGPT Plus",
    emoji: "AI",
    category: "AI",
    bg_class: "bg-brand-lime",
  },
  {
    id: "canva-pro",
    name: "Canva Pro",
    emoji: "UI",
    category: "Design",
    bg_class: "bg-brand-cyan",
  },
  {
    id: "netflix",
    name: "Netflix",
    emoji: "TV",
    category: "Streaming",
    bg_class: "bg-brand-pink",
  },
  {
    id: "spotify",
    name: "Spotify Premium",
    emoji: "MX",
    category: "Music",
    bg_class: "bg-brand-lime",
  },
  {
    id: "notion-ai",
    name: "Notion AI",
    emoji: "DOC",
    category: "Productivity",
    bg_class: "bg-brand-yellow",
  },
];

const HERO_ORBIT_CARDS = [
  {
    position: "left-1/2 top-9 -translate-x-1/2",
    tilt: "rotate-[2deg]",
    animation: "animate-hero-float",
  },
  {
    position: "right-3 top-[39%]",
    tilt: "rotate-[-4deg]",
    animation: "animate-hero-float-alt",
  },
  {
    position: "left-1/2 bottom-5 -translate-x-1/2",
    tilt: "rotate-[1deg]",
    animation: "animate-hero-float",
  },
  {
    position: "left-3 top-[39%]",
    tilt: "rotate-[3deg]",
    animation: "animate-hero-float-alt",
  },
] as const;

function Index() {
  const [services, setServices] = useState<PublicService[]>([]);
  const [fields, setFields] = useState<PublicFormField[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<SubmittedRequest | null>(null);
  const [trackedRequest, setTrackedRequest] = useState<PublicTrackedRequest | null>(null);
  const [trackingReference, setTrackingReference] = useState("");
  const [trackingEmail, setTrackingEmail] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const heroServices = (services.length > 0 ? services : HERO_FALLBACK_SERVICES).slice(0, 5);
  const heroOrbitServices = heroServices.slice(0, HERO_ORBIT_CARDS.length);
  const heroStats = [
    {
      value: services.length > 0 ? String(services.length) : "10+",
      label: "live subscriptions",
    },
    { value: "30 sec", label: "request flow" },
    { value: "1 code", label: "status tracking" },
  ];

  useEffect(() => {
    void (async () => {
      try {
        const data = await getPublicCatalog();
        setServices(data.services);
        setFields(data.fields);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleService = (n: string) => {
    setSelected((prev) => (prev.includes(n) ? prev.filter((s) => s !== n) : [...prev, n]));
    if (errors.selected_services) setErrors((e) => ({ ...e, selected_services: "" }));
  };

  const scrollToForm = () => {
    document.getElementById("request")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToTracker = () => {
    document.getElementById("track")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const copyReferenceCode = async (referenceCode: string) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API not available");
      }

      await navigator.clipboard.writeText(referenceCode);
      toast.success("Reference code copied");
    } catch {
      toast.error("Could not copy the reference code");
    }
  };

  function validate(): { ok: true; data: ReturnType<typeof buildPayload> } | { ok: false } {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Please enter your name";
    else if (name.length > 100) errs.name = "Max 100 characters";
    const emailOk = z.string().email().safeParse(email.trim());
    if (!email.trim()) errs.email = "Please enter your email";
    else if (!emailOk.success) errs.email = "That doesn't look like a valid email";
    if (selected.length === 0) errs.selected_services = "Please pick at least one subscription";
    if (selected.length > 10) errs.selected_services = "Up to 10 only";

    for (const f of fields) {
      const v = values[f.field_key];
      if (f.is_required) {
        const empty =
          v === undefined || v === "" || (f.field_type === "checkbox" ? v !== true : false);
        if (empty) errs[f.field_key] = `${f.label} is required`;
      }
      if (typeof v === "string" && v.length > f.max_length) {
        errs[f.field_key] = `Max ${f.max_length} characters`;
      }
      if (f.field_type === "email" && typeof v === "string" && v.trim()) {
        if (!z.string().email().safeParse(v.trim()).success) errs[f.field_key] = "Invalid email";
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return { ok: false };
    return { ok: true, data: buildPayload() };
  }

  function buildPayload() {
    const builtin: { company?: string; use_case?: string; message?: string } = {};
    const custom: Record<string, FieldValue> = {};
    for (const f of fields) {
      const v = values[f.field_key];
      if (v === undefined || v === "" || v === false) continue;
      if (
        f.is_builtin &&
        (f.field_key === "company" || f.field_key === "use_case" || f.field_key === "message")
      ) {
        builtin[f.field_key] = String(v);
      } else {
        custom[f.field_key] = v;
      }
    }
    return {
      name: name.trim(),
      email: email.trim(),
      selected_services: selected,
      company: builtin.company ?? null,
      use_case: builtin.use_case ?? null,
      message: builtin.message ?? null,
      custom_fields: custom,
    };
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validate();
    if (!result.ok) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSubmitting(true);
    try {
      const response = await submitSubscriptionRequest({ data: result.data });
      toast.success("Request received! We'll be in touch soon. 🎉");
      setSubmittedRequest({
        email: result.data.email,
        name: result.data.name,
        referenceCode: response.request.reference_code,
        selectedServices: [...result.data.selected_services],
      });
      setTrackingEmail(result.data.email);
      setTrackingReference(response.request.reference_code);
      setTrackedRequest(response.request);
      setTrackingError(null);
      setName("");
      setEmail("");
      setValues({});
      setSelected([]);
      setErrors({});
      document.getElementById("request")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const reference = trackingReference.trim();
    const requestEmail = trackingEmail.trim();
    if (!reference) {
      setTrackingError("Enter your reference code to track the request.");
      return;
    }
    if (!requestEmail) {
      setTrackingError("Enter the same email used during submission.");
      return;
    }
    if (!z.string().email().safeParse(requestEmail).success) {
      setTrackingError("Enter a valid request email.");
      return;
    }

    setTrackingLoading(true);
    setTrackingError(null);

    try {
      const response = await trackSubscriptionRequest({ data: { reference, email: requestEmail } });
      setTrackedRequest(response.request);
      setTrackingReference(response.request.reference_code);
    } catch (error) {
      setTrackedRequest(null);
      setTrackingError(
        error instanceof Error ? error.message : "Could not load the request timeline.",
      );
    } finally {
      setTrackingLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden">
      <Toaster richColors position="top-center" />

      {/* Nav */}
      <header className="sticky top-0 z-30 px-3 pt-2 sm:px-6 sm:pt-3">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-foreground bg-background/85 shadow-brutal-lg backdrop-blur-xl">
            <span
              aria-hidden
              className="pointer-events-none absolute -left-12 top-[-4.5rem] h-32 w-32 rounded-full blur-3xl"
              style={{ background: "color-mix(in oklab, var(--brand-pink) 28%, transparent)" }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-6 top-1 h-24 w-24 rounded-full blur-3xl"
              style={{ background: "color-mix(in oklab, var(--brand-cyan) 24%, transparent)" }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-hero opacity-90"
            />

            <div className="relative px-4 py-3 sm:px-6 sm:py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <a
                    href="#top"
                    aria-label="SocZen home"
                    className="inline-flex items-center transition-transform hover:-translate-y-0.5"
                  >
                    <BrandLogo size="sm" />
                  </a>
                </div>

                <nav className="hidden md:flex items-center gap-1 rounded-full border-2 border-foreground bg-card/80 p-1 shadow-brutal-sm">
                  {NAV_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="rounded-full px-4 py-1.5 text-sm font-bold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={scrollToForm}
                    className="hidden h-10 rounded-full border-2 border-foreground bg-foreground px-4 text-background shadow-brutal-sm transition-all hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none sm:inline-flex"
                  >
                    Get free access
                  </Button>
                  <button
                    type="button"
                    aria-label={menuOpen ? "Close menu" : "Open menu"}
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((open) => !open)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-foreground bg-card shadow-brutal-sm md:hidden"
                  >
                    {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            {menuOpen && (
              <div className="border-t-2 border-foreground bg-card/90 px-4 pb-4 pt-4 md:hidden">
                <nav className="flex flex-col gap-2">
                  {NAV_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-2xl border-2 border-foreground bg-background px-4 py-3 text-sm font-bold shadow-brutal-sm"
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>

                <Button
                  onClick={() => {
                    setMenuOpen(false);
                    scrollToForm();
                  }}
                  className="mt-4 w-full rounded-full border-2 border-foreground bg-foreground text-background shadow-brutal-sm transition-all hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none"
                >
                  Start your request <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        id="top"
        className="relative mx-auto flex min-h-[calc(100svh-5.75rem)] max-w-6xl items-stretch px-4 pb-8 pt-4 sm:min-h-[calc(100svh-7.5rem)] sm:px-6 sm:pb-10 sm:pt-6"
      >
        <div className="hero-grid-lines pointer-events-none absolute inset-0 opacity-45" />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-20 top-[-5.5rem] h-64 w-64 rounded-full blur-3xl"
          style={{ background: "color-mix(in oklab, var(--brand-pink) 34%, transparent)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-[-4rem] top-10 h-56 w-56 rounded-full blur-3xl"
          style={{ background: "color-mix(in oklab, var(--brand-cyan) 28%, transparent)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-[-5rem] left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "color-mix(in oklab, var(--brand-yellow) 34%, transparent)" }}
        />

        <div className="relative grid w-full gap-6 py-2 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-8">
          <div className="flex max-w-3xl flex-col justify-center text-center lg:text-left">
            <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border-2 border-foreground bg-card/90 px-3 py-1.5 text-xs font-bold shadow-brutal-sm sm:px-4 sm:text-sm lg:justify-start">
              <Gift className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              100% free access
              <span className="hidden h-1.5 w-1.5 rounded-full bg-foreground/40 sm:inline-block" />
              No credit card
            </div>

            <div className="mt-5 sm:mt-6">
              <h1 className="text-4xl font-bold leading-[0.96] sm:text-5xl md:text-6xl lg:text-[4.35rem]">
                Premium access,
                <span className="mt-2 block text-gradient-hero">without the paywall.</span>
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7 md:text-lg lg:mx-0">
                Pick the subscriptions you need, send one request, and track everything with a
                single code.
              </p>
            </div>

            <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button
                size="lg"
                onClick={scrollToForm}
                className="rounded-full border-2 border-foreground bg-gradient-cta px-6 py-4 text-base text-white shadow-brutal transition-all hover:translate-y-1 hover:translate-x-1 hover:shadow-none sm:px-8 sm:py-5"
              >
                Request access <ArrowRight className="ml-1 h-5 w-5" />
              </Button>
              <Button
                type="button"
                onClick={scrollToTracker}
                className="rounded-full border-2 border-foreground bg-card px-6 py-4 text-base text-foreground shadow-brutal-sm transition-all hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none sm:px-8 sm:py-5"
              >
                Track request
              </Button>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-background/85 px-3 py-2 shadow-brutal-sm backdrop-blur-sm"
                >
                  <p className="text-sm font-bold sm:text-base">{stat.value}</p>
                  <p className="whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-[26rem] lg:block lg:min-h-[27rem]">
            <div className="animate-hero-float hidden rounded-full border border-foreground/12 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-foreground/70 shadow-[0_20px_35px_-24px_rgba(25,20,56,0.4)] backdrop-blur-md md:inline-flex md:absolute md:right-1 md:top-[4.75rem]">
              Curated picks
            </div>

            <span
              aria-hidden
              className="pointer-events-none absolute -left-8 top-6 h-36 w-36 rounded-full blur-3xl"
              style={{ background: "color-mix(in oklab, var(--brand-pink) 20%, transparent)" }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 bottom-6 h-40 w-40 rounded-full blur-3xl"
              style={{ background: "color-mix(in oklab, var(--brand-cyan) 18%, transparent)" }}
            />

            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/45 sm:text-[11px]">
                  SocZen
                </p>
                <h2 className="mt-2 text-2xl font-bold leading-none sm:text-3xl">Access stack</h2>
              </div>
              <span className="rounded-full border border-foreground/15 bg-brand-lime/85 px-3 py-1 text-xs font-bold shadow-[0_16px_25px_-18px_rgba(23,20,50,0.35)]">
                {heroStats[0]?.value} live
              </span>
            </div>

            <div className="relative mt-10 flex min-h-[21rem] items-center justify-center">
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-yellow)_24%,transparent),transparent_66%)] blur-2xl"
              />
              <span className="absolute inset-x-12 top-7 bottom-6 rounded-[2rem] border border-dashed border-foreground/8" />
              <span className="absolute inset-x-20 top-14 bottom-14 rounded-[2rem] border border-foreground/6" />

              {heroOrbitServices.map((service, index) => {
                const orbitCard = HERO_ORBIT_CARDS[index];

                return (
                  <div
                    key={service.id}
                    className={`${orbitCard?.position ?? ""} absolute z-10 w-[7.05rem]`}
                  >
                    <div
                      className={`${orbitCard?.tilt ?? ""} ${orbitCard?.animation ?? ""} rounded-[1.25rem] border border-foreground/12 bg-white/92 px-2.5 py-2.5 text-left shadow-[0_22px_40px_-26px_rgba(25,20,56,0.45)] backdrop-blur-md`}
                    >
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-foreground/15 text-[10px] font-black shadow-[0_10px_18px_-14px_rgba(25,20,56,0.45)] ${service.bg_class}`}
                      >
                        {service.emoji}
                      </span>
                      <p className="mt-2.5 truncate text-[13px] font-semibold leading-tight">
                        {service.name}
                      </p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-foreground/45">
                        {service.category}
                      </p>
                    </div>
                  </div>
                );
              })}

              <div className="relative z-20 flex w-40 flex-col items-center rounded-[1.8rem] border border-foreground/12 bg-white/96 px-5 py-5 text-center shadow-[0_34px_65px_-28px_rgba(25,20,56,0.5),0_0_0_1px_rgba(31,26,58,0.06)] backdrop-blur-md">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-5 top-4 h-12 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95),transparent_72%)] blur-xl"
                />
                <BrandLogo size="md" className="relative z-10" />
                <div className="mt-4 inline-flex rounded-full bg-background/95 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  One code
                </div>
                <p className="mt-3 text-sm font-semibold leading-5 text-foreground/88">
                  Clean request tracking.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-20">
        <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
          {[
            {
              step: "1",
              title: "Browse",
              desc: "Pick any subscriptions you want from our catalog.",
              color: "bg-brand-lime",
            },
            {
              step: "2",
              title: "Request",
              desc: "Fill the quick form — takes 30 seconds.",
              color: "bg-brand-orange",
            },
            {
              step: "3",
              title: "Enjoy",
              desc: "We'll set you up and send your access. Free forever.",
              color: "bg-brand-violet text-white",
            },
          ].map((f) => (
            <div
              key={f.step}
              className={`${f.color} rounded-2xl border-2 border-foreground p-5 shadow-brutal sm:p-6`}
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-foreground bg-card font-bold text-foreground shadow-brutal-sm">
                {f.step}
              </div>
              <h3 className="mt-4 text-xl font-bold sm:text-2xl">{f.title}</h3>
              <p className="mt-2 text-sm opacity-80 sm:text-base">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Catalog */}
      <section id="catalog" className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold sm:text-4xl md:text-5xl">
            Available <span className="text-gradient-hero">subscriptions</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:mt-4 sm:text-base">
            All the premium tools you actually want — bundled and free.
          </p>
        </div>

        {loading ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border-2 border-foreground bg-muted"
              />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="mt-8 rounded-2xl border-2 border-dashed border-foreground bg-card p-10 text-center">
            <p className="font-bold">No subscriptions available right now.</p>
            <p className="text-sm text-muted-foreground">Check back soon!</p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
            {services.map((s) => (
              <div
                key={s.id}
                className={`${s.bg_class} rounded-2xl border-2 border-foreground p-4 shadow-brutal-sm transition-transform hover:-translate-y-1 hover:shadow-brutal sm:p-5`}
              >
                <div className="text-3xl sm:text-4xl">{s.emoji}</div>
                <h3 className="mt-3 text-base font-bold leading-tight sm:text-lg">{s.name}</h3>
                <p className="text-[10px] font-semibold uppercase opacity-70 sm:text-xs">
                  {s.category}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center sm:mt-10">
          <Button
            onClick={scrollToForm}
            className="rounded-full border-2 border-foreground bg-foreground text-background text-base px-6 py-5 shadow-brutal hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all sm:px-8 sm:py-6"
          >
            Request access now <ArrowRight className="ml-1 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Request form */}
      <section id="request" className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="rounded-3xl border-2 border-foreground bg-card p-5 shadow-brutal-lg sm:p-8 md:p-12">
          <div className="text-center">
            <span className="inline-block rounded-full border-2 border-foreground bg-brand-lime px-3 py-1 text-[10px] font-bold shadow-brutal-sm sm:px-4 sm:text-xs">
              REQUEST ACCESS
            </span>
            <h2 className="mt-3 text-3xl font-bold sm:mt-4 sm:text-4xl md:text-5xl">
              Pick what you <span className="text-gradient-hero">need</span>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-base">
              Select one or more subscriptions and tell us a bit about yourself.
            </p>
          </div>

          {submittedRequest ? (
            <div className="mt-8 rounded-3xl border-2 border-foreground bg-background p-6 text-center shadow-brutal sm:p-8">
              <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-foreground bg-brand-lime shadow-brutal-sm">
                <Check className="h-8 w-8" strokeWidth={3} />
              </div>
              <h3 className="mt-5 text-2xl font-bold sm:text-3xl">
                Request submitted successfully
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                Thanks {submittedRequest.name}. We received your request and will contact you at{" "}
                <span className="font-semibold text-foreground">{submittedRequest.email}</span>.
              </p>
              <div className="mt-6 rounded-2xl border-2 border-foreground bg-card p-4 shadow-brutal-sm">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Reference code
                </p>
                <div className="mt-3 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <div className="inline-flex rounded-full border-2 border-foreground bg-background px-4 py-2 font-mono text-sm font-bold shadow-brutal-sm sm:text-base">
                    {submittedRequest.referenceCode}
                  </div>
                  <Button
                    type="button"
                    onClick={() => void copyReferenceCode(submittedRequest.referenceCode)}
                    className="rounded-full border-2 border-foreground bg-card text-foreground shadow-brutal-sm transition-all hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none"
                  >
                    Copy code
                  </Button>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Save this code. You can use it anytime in the tracker below to see your status
                  timeline.
                </p>
              </div>
              {submittedRequest.selectedServices.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                    Requested subscriptions
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {submittedRequest.selectedServices.map((service) => (
                      <span
                        key={service}
                        className="rounded-full border-2 border-foreground bg-card px-3 py-1.5 text-sm font-bold shadow-brutal-sm"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  onClick={scrollToTracker}
                  className="rounded-full border-2 border-foreground bg-brand-cyan text-foreground shadow-brutal-sm transition-all hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none"
                >
                  Track this request
                </Button>
                <Button
                  type="button"
                  onClick={() => setSubmittedRequest(null)}
                  className="rounded-full border-2 border-foreground bg-foreground text-background shadow-brutal-sm transition-all hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none"
                >
                  Submit another request
                </Button>
                <a
                  href="#catalog"
                  className="rounded-full border-2 border-foreground bg-card px-6 py-3 text-center text-sm font-bold shadow-brutal-sm transition-all hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none"
                >
                  Back to catalog
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {/* Service multi-select */}
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <Label className="font-bold">
                    Subscriptions you want *{" "}
                    <span className="font-normal text-muted-foreground">(tap to select)</span>
                  </Label>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {selected.length} selected
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {services.map((s) => {
                    const isOn = selected.includes(s.name);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleService(s.name)}
                        aria-pressed={isOn}
                        className={`relative rounded-xl border-2 border-foreground p-3 text-left transition-all ${
                          isOn
                            ? `${s.bg_class} shadow-brutal-sm -translate-y-0.5`
                            : "bg-background hover:bg-muted shadow-brutal-sm hover:-translate-y-0.5"
                        }`}
                      >
                        {isOn && (
                          <span className="absolute -top-2 -right-2 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-foreground bg-foreground text-background shadow-brutal-sm">
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                        )}
                        <div className="text-2xl">{s.emoji}</div>
                        <div className="mt-1 text-sm font-bold leading-tight">{s.name}</div>
                      </button>
                    );
                  })}
                </div>
                {errors.selected_services && (
                  <p className="text-sm font-medium text-destructive">{errors.selected_services}</p>
                )}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-bold">
                    Name *
                  </Label>
                  <Input
                    id="name"
                    maxLength={100}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((x) => ({ ...x, name: "" }));
                    }}
                    aria-invalid={!!errors.name}
                    className={`rounded-xl border-2 bg-background h-12 shadow-brutal-sm focus-visible:ring-0 ${errors.name ? "border-destructive" : "border-foreground"}`}
                    placeholder="Ada Lovelace"
                  />
                  {errors.name && (
                    <p className="text-sm font-medium text-destructive">{errors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold">
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    maxLength={255}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((x) => ({ ...x, email: "" }));
                    }}
                    aria-invalid={!!errors.email}
                    className={`rounded-xl border-2 bg-background h-12 shadow-brutal-sm focus-visible:ring-0 ${errors.email ? "border-destructive" : "border-foreground"}`}
                    placeholder="ada@example.com"
                  />
                  {errors.email && (
                    <p className="text-sm font-medium text-destructive">{errors.email}</p>
                  )}
                </div>
              </div>

              {/* Dynamic fields */}
              {fields.map((f) => (
                <DynamicField
                  key={f.id}
                  field={f}
                  value={values[f.field_key]}
                  error={errors[f.field_key]}
                  onChange={(v) => {
                    setValues((prev) => ({ ...prev, [f.field_key]: v }));
                    if (errors[f.field_key]) setErrors((prev) => ({ ...prev, [f.field_key]: "" }));
                  }}
                />
              ))}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full border-2 border-foreground bg-gradient-cta text-white text-base font-bold py-6 shadow-brutal hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Submit request"}
                {!submitting && <ArrowRight className="ml-2 h-5 w-5" />}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                No credit card. No spam. 100% free.
              </p>
            </form>
          )}
        </div>
      </section>

      <RequestTracker
        reference={trackingReference}
        email={trackingEmail}
        onReferenceChange={(value) => {
          setTrackingReference(value);
          if (trackingError) setTrackingError(null);
        }}
        onEmailChange={(value) => {
          setTrackingEmail(value);
          if (trackingError) setTrackingError(null);
        }}
        onSubmit={handleTrackSubmit}
        loading={trackingLoading}
        error={trackingError}
        request={trackedRequest}
        latestReference={submittedRequest?.referenceCode ?? trackedRequest?.reference_code ?? null}
        latestEmail={submittedRequest?.email ?? null}
        onUseLatestRequest={() => {
          const nextReference =
            submittedRequest?.referenceCode ?? trackedRequest?.reference_code ?? "";
          if (!nextReference) return;
          setTrackingReference(nextReference);
          setTrackingEmail(submittedRequest?.email ?? "");
          setTrackingError(null);
        }}
        onCopyReference={(referenceCode) => void copyReferenceCode(referenceCode)}
      />

      <footer className="border-t-2 border-foreground bg-card">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-foreground bg-background/80 px-4 py-5 shadow-brutal-sm sm:px-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -left-10 top-[-3.5rem] h-24 w-24 rounded-full blur-3xl"
              style={{ background: "color-mix(in oklab, var(--brand-pink) 26%, transparent)" }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-0 top-2 h-20 w-20 rounded-full blur-3xl"
              style={{ background: "color-mix(in oklab, var(--brand-cyan) 24%, transparent)" }}
            />

            <div className="relative flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:items-end sm:text-left">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground sm:text-xs">
                  SocZen access desk
                </p>
                <p className="mt-2 text-sm font-medium">
                  © {new Date().getFullYear()} SocZen. Free subscriptions, shared manually.
                </p>
              </div>

              <div className="rounded-[1.6rem] border-2 border-foreground bg-card px-4 py-3 shadow-brutal-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-muted-foreground sm:text-[11px]">
                  Powered by
                </p>
                <p className="mt-2 font-display text-xl font-bold tracking-[-0.08em] text-foreground sm:text-3xl">
                  <span className="text-foreground/85">SocZen</span>{" "}
                  <span className="text-gradient-hero">Access Desk</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function DynamicField({
  field,
  value,
  error,
  onChange,
}: {
  field: PublicFormField;
  value: FieldValue | undefined;
  error: string | undefined;
  onChange: (v: FieldValue) => void;
}) {
  const labelEl = (
    <Label htmlFor={field.field_key} className="font-bold">
      {field.label}
      {field.is_required ? " *" : ""}{" "}
      {!field.is_required && <span className="font-normal text-muted-foreground">(optional)</span>}
    </Label>
  );

  if (field.field_type === "textarea") {
    return (
      <div className="space-y-2">
        {labelEl}
        <Textarea
          id={field.field_key}
          maxLength={field.max_length}
          rows={3}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ""}
          className={`rounded-xl border-2 bg-background shadow-brutal-sm focus-visible:ring-0 resize-none ${error ? "border-destructive" : "border-foreground"}`}
        />
        {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>
    );
  }

  if (field.field_type === "select") {
    return (
      <div className="space-y-2">
        {labelEl}
        <Select value={(value as string) ?? ""} onValueChange={(v) => onChange(v)}>
          <SelectTrigger
            id={field.field_key}
            className={`rounded-xl border-2 bg-background h-12 shadow-brutal-sm ${error ? "border-destructive" : "border-foreground"}`}
          >
            <SelectValue placeholder={field.placeholder ?? "Pick one…"} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 border-foreground">
            {field.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>
    );
  }

  if (field.field_type === "checkbox") {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-3 rounded-xl border-2 border-foreground bg-background p-3 shadow-brutal-sm">
          <Checkbox
            id={field.field_key}
            checked={value === true}
            onCheckedChange={(v) => onChange(v === true)}
            className="mt-0.5 border-2 border-foreground"
          />
          <div>
            <Label htmlFor={field.field_key} className="font-bold cursor-pointer">
              {field.label}
              {field.is_required ? " *" : ""}
            </Label>
            {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
          </div>
        </div>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>
    );
  }

  // text or email
  return (
    <div className="space-y-2">
      {labelEl}
      <Input
        id={field.field_key}
        type={field.field_type === "email" ? "email" : "text"}
        maxLength={field.max_length}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? ""}
        className={`rounded-xl border-2 bg-background h-12 shadow-brutal-sm focus-visible:ring-0 ${error ? "border-destructive" : "border-foreground"}`}
      />
      {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import {
  Check,
  ArrowRight,
  Gift,
  Menu,
  X,
  Search,
  Sparkles,
  Zap,
  ShieldCheck,
  Plus,
  Trash2,
} from "lucide-react";
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
  { href: "#track", label: "Track request" },
] as const;

type HeroService = Pick<PublicService, "id" | "name" | "emoji" | "category" | "bg_class">;

const HERO_FALLBACK_SERVICES: HeroService[] = [
  {
    id: "chatgpt-plus",
    name: "ChatGPT Plus",
    emoji: "🤖",
    category: "AI",
    bg_class: "bg-brand-lime",
  },
  {
    id: "canva-pro",
    name: "Canva Pro",
    emoji: "🎨",
    category: "Design",
    bg_class: "bg-brand-cyan",
  },
  {
    id: "netflix",
    name: "Netflix",
    emoji: "🎬",
    category: "Streaming",
    bg_class: "bg-brand-pink",
  },
  {
    id: "spotify",
    name: "Spotify Premium",
    emoji: "🎵",
    category: "Music",
    bg_class: "bg-brand-lime",
  },
  {
    id: "notion-ai",
    name: "Notion AI",
    emoji: "📝",
    category: "Productivity",
    bg_class: "bg-brand-yellow",
  },
];

const HERO_ORBIT_CARDS = [
  {
    position: "left-1/2 top-7 -translate-x-1/2",
    tilt: "rotate-[2deg]",
    animation: "animate-hero-float",
  },
  {
    position: "right-2 top-[38%]",
    tilt: "rotate-[-4deg]",
    animation: "animate-hero-float-alt",
  },
  {
    position: "left-1/2 bottom-4 -translate-x-1/2",
    tilt: "rotate-[1deg]",
    animation: "animate-hero-float",
  },
  {
    position: "left-2 top-[38%]",
    tilt: "rotate-[3deg]",
    animation: "animate-hero-float-alt",
  },
] as const;

function Index() {
  const [services, setServices] = useState<PublicService[]>([]);
  const [fields, setFields] = useState<PublicFormField[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<string[]>([]);
  const [catalogCategory, setCatalogCategory] = useState<string>("All");
  const [catalogSearch, setCatalogSearch] = useState<string>("");

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

  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    for (const s of services) {
      if (s.category) set.add(s.category);
    }
    return Array.from(set);
  }, [services]);

  const filteredCatalogServices = useMemo(() => {
    return services.filter((s) => {
      const matchesCategory =
        catalogCategory === "All" || s.category.toLowerCase() === catalogCategory.toLowerCase();
      const q = catalogSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [services, catalogCategory, catalogSearch]);

  const heroStats = [
    {
      value: services.length > 0 ? String(services.length) : "10+",
      label: "Live Subscriptions",
    },
    { value: "30 sec", label: "Zero-Friction Request" },
    { value: "1 Code", label: "Instant Status Tracker" },
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

  const toggleService = (serviceName: string) => {
    setSelected((prev) => {
      const exists = prev.includes(serviceName);
      if (exists) {
        return prev.filter((s) => s !== serviceName);
      }
      if (prev.length >= 10) {
        toast.error("You can select up to 10 subscriptions at a time.");
        return prev;
      }
      toast.success(`Added "${serviceName}" to request`);
      return [...prev, serviceName];
    });

    if (errors.selected_services) {
      setErrors((e) => ({ ...e, selected_services: "" }));
    }
  };

  const removeService = (serviceName: string) => {
    setSelected((prev) => prev.filter((s) => s !== serviceName));
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
      toast.success("Reference code copied to clipboard!");
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
    else if (!emailOk.success) errs.email = "That doesn't look like a valid email address";

    if (selected.length === 0) errs.selected_services = "Please pick at least one subscription";
    if (selected.length > 10) errs.selected_services = "You can select up to 10 subscriptions only";

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
      toast.error("Please fill all required fields properly");
      return;
    }
    setSubmitting(true);
    try {
      const response = await submitSubscriptionRequest({ data: result.data });
      toast.success("Request received! AI Triage completed 🎉");
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
        error instanceof Error ? error.message : "Could not load the request timeline."
      );
    } finally {
      setTrackingLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden pb-12">
      <Toaster richColors position="top-center" />

      {/* Floating Selected Services Bar */}
      {selected.length > 0 && !submittedRequest && (
        <aside
          aria-label="Selected subscriptions bar"
          className="fixed bottom-5 inset-x-0 z-50 flex justify-center px-4 pointer-events-none animate-in fade-in slide-in-from-bottom-5 duration-300"
        >
          <div className="pointer-events-auto flex items-center justify-between gap-3 sm:gap-6 rounded-full border-2 border-foreground bg-foreground text-background px-4 py-3 shadow-brutal-lg max-w-xl w-full">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-lime text-foreground font-black text-xs">
                {selected.length}
              </span>
              <p className="text-xs sm:text-sm font-bold truncate">
                {selected.length === 1
                  ? "1 Subscription selected"
                  : `${selected.length} Subscriptions selected`}
              </p>
            </div>
            <Button
              type="button"
              onClick={scrollToForm}
              className="shrink-0 rounded-full border-2 border-foreground bg-brand-lime text-foreground font-black text-xs sm:text-sm px-4 py-2 hover:bg-brand-yellow hover:scale-105 transition-all shadow-brutal-sm"
            >
              Continue to Request <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </aside>
      )}

      {/* Header / Nav */}
      <header className="sticky top-0 z-30 px-3 pt-2 sm:px-6 sm:pt-3">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-foreground bg-background/90 shadow-brutal-lg backdrop-blur-xl">
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
                    className="hidden h-10 rounded-full border-2 border-foreground bg-foreground px-5 text-background font-bold shadow-brutal-sm transition-all hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none sm:inline-flex"
                  >
                    Get Free Access
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
              <div className="border-t-2 border-foreground bg-card/95 px-4 pb-4 pt-4 md:hidden">
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
                  className="mt-4 w-full rounded-full border-2 border-foreground bg-foreground text-background font-bold shadow-brutal-sm py-4"
                >
                  Start Request <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="top"
        className="relative mx-auto flex min-h-[calc(100svh-5.75rem)] max-w-6xl items-stretch px-4 pb-8 pt-4 sm:min-h-[calc(100svh-7.5rem)] sm:px-6 sm:pb-12 sm:pt-6"
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

        <div className="relative grid w-full gap-8 py-2 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10">
          <div className="flex max-w-3xl flex-col justify-center text-center lg:text-left">
            <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border-2 border-foreground bg-card/90 px-3.5 py-1.5 text-xs font-black shadow-brutal-sm sm:px-4 sm:text-sm lg:justify-start">
              <Gift className="h-4 w-4 text-brand-pink" />
              100% Free Access
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
              Zero Gatekeeping
            </div>

            <div className="mt-5 sm:mt-6">
              <h1 className="text-4xl font-black leading-[0.98] sm:text-5xl md:text-6xl lg:text-[4.5rem]">
                Premium tools,
                <span className="mt-2 block text-gradient-hero">without the subscription.</span>
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7 md:text-lg lg:mx-0 font-medium">
                Pick the premium tools you need (ChatGPT, Canva, Netflix, Notion & more), send one fast request, and track everything live with a single code.
              </p>
            </div>

            <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button
                size="lg"
                onClick={scrollToForm}
                className="rounded-full border-2 border-foreground bg-gradient-cta px-7 py-5 text-base font-black text-white shadow-brutal transition-all hover:translate-y-1 hover:translate-x-1 hover:shadow-none sm:px-9 sm:py-6"
              >
                Request Access Now <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                type="button"
                onClick={scrollToTracker}
                className="rounded-full border-2 border-foreground bg-card px-7 py-5 text-base font-bold text-foreground shadow-brutal-sm transition-all hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none sm:px-8 sm:py-6"
              >
                Track Live Request
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2.5 lg:justify-start">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-background/90 px-3.5 py-2 shadow-brutal-sm backdrop-blur-sm"
                >
                  <p className="text-sm font-black sm:text-base">{stat.value}</p>
                  <p className="whitespace-nowrap text-[11px] font-bold text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Orbit Visual */}
          <div className="relative mx-auto hidden w-full max-w-[27rem] lg:block lg:min-h-[28rem]">
            <div className="animate-hero-float hidden rounded-full border-2 border-foreground bg-white px-3.5 py-1.5 text-xs font-black text-foreground shadow-brutal-sm backdrop-blur-md md:inline-flex md:absolute md:right-1 md:top-[4.5rem] z-30">
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-brand-pink" /> Instant Grant
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
                <p className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">
                  SocZen Lineup
                </p>
                <h2 className="mt-1 text-2xl font-black leading-none sm:text-3xl">Access Stack</h2>
              </div>
              <span className="rounded-full border-2 border-foreground bg-brand-lime px-3 py-1 text-xs font-black shadow-brutal-sm">
                {heroStats[0]?.value} Active
              </span>
            </div>

            <div className="relative mt-8 flex min-h-[22rem] items-center justify-center">
              <span className="absolute inset-x-8 top-5 bottom-4 rounded-[2.5rem] border-2 border-dashed border-foreground/20" />
              <span className="absolute inset-x-16 top-12 bottom-12 rounded-[2rem] border-2 border-foreground/15" />

              {heroOrbitServices.map((service, index) => {
                const orbitCard = HERO_ORBIT_CARDS[index];
                const isSelected = selected.includes(service.name);

                return (
                  <div
                    key={service.id}
                    className={`${orbitCard?.position ?? ""} absolute z-10 w-[7.5rem] cursor-pointer`}
                    onClick={() => toggleService(service.name)}
                  >
                    <div
                      className={`${orbitCard?.tilt ?? ""} ${orbitCard?.animation ?? ""} rounded-[1.3rem] border-2 border-foreground bg-card p-3 text-left shadow-brutal transition-all hover:scale-105 ${
                        isSelected ? "ring-4 ring-brand-pink" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border-2 border-foreground text-sm font-black shadow-brutal-sm ${service.bg_class}`}
                        >
                          {service.emoji}
                        </span>
                        {isSelected && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-lime border border-foreground text-foreground">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </div>
                      <p className="mt-2.5 truncate text-xs font-black leading-tight">
                        {service.name}
                      </p>
                      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                        {service.category}
                      </p>
                    </div>
                  </div>
                );
              })}

              <div className="relative z-20 flex w-44 flex-col items-center rounded-[2rem] border-2 border-foreground bg-card p-5 text-center shadow-brutal-lg">
                <BrandLogo size="md" className="relative z-10" />
                <div className="mt-3 inline-flex rounded-full bg-background px-3 py-1 text-[10px] font-black uppercase tracking-wider text-foreground border border-foreground">
                  AI Triaged
                </div>
                <p className="mt-2 text-xs font-bold leading-4 text-muted-foreground">
                  Instant tracking with 1 Reference Code.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how" className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-20">
        <div className="text-center mb-8">
          <span className="inline-block rounded-full border-2 border-foreground bg-brand-yellow px-3.5 py-1 text-xs font-black shadow-brutal-sm uppercase">
            3 Simple Steps
          </span>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">How It Works</h2>
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Pick Tools",
              desc: "Choose from AI, Design, Streaming, and Productivity tools from our catalog.",
              color: "bg-brand-lime",
              icon: Zap,
            },
            {
              step: "02",
              title: "Quick Request",
              desc: "Submit your request in 30 seconds with your email and basic use-case.",
              color: "bg-brand-cyan",
              icon: Sparkles,
            },
            {
              step: "03",
              title: "Get Access",
              desc: "Track status live. Our desk reviews and sets up your credentials.",
              color: "bg-brand-pink",
              icon: ShieldCheck,
            },
          ].map((f) => (
            <div
              key={f.step}
              className={`${f.color} rounded-3xl border-2 border-foreground p-6 shadow-brutal transition-transform hover:-translate-y-1`}
            >
              <div className="flex items-center justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-foreground bg-card font-black text-lg text-foreground shadow-brutal-sm">
                  {f.step}
                </div>
                <f.icon className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="mt-5 text-2xl font-black">{f.title}</h3>
              <p className="mt-2 text-sm font-medium opacity-90 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Catalog Section */}
      <section id="catalog" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="text-center">
          <span className="inline-block rounded-full border-2 border-foreground bg-brand-lime px-3.5 py-1 text-xs font-black shadow-brutal-sm uppercase">
            Full Catalog
          </span>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl md:text-5xl">
            Pick your <span className="text-gradient-hero">subscriptions</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base font-medium">
            Click any card to select or deselect. Pick up to 10 subscriptions for your stack.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatalogCategory(cat)}
                className={`rounded-full border-2 border-foreground px-4 py-1.5 text-xs sm:text-sm font-bold shadow-brutal-sm transition-all ${
                  catalogCategory === cat
                    ? "bg-foreground text-background -translate-y-0.5 shadow-brutal"
                    : "bg-card text-foreground hover:bg-muted"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Search tools..."
              className="h-11 rounded-full border-2 border-foreground bg-card pl-10 text-sm shadow-brutal-sm focus-visible:ring-0"
            />
            {catalogSearch && (
              <button
                type="button"
                onClick={() => setCatalogSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-2xl border-2 border-foreground bg-muted"
              />
            ))}
          </div>
        ) : filteredCatalogServices.length === 0 ? (
          <div className="mt-8 rounded-3xl border-2 border-dashed border-foreground bg-card p-10 text-center shadow-brutal">
            <p className="text-lg font-bold">No subscriptions match your search.</p>
            <Button
              variant="outline"
              onClick={() => {
                setCatalogCategory("All");
                setCatalogSearch("");
              }}
              className="mt-4 rounded-full border-2 border-foreground font-bold shadow-brutal-sm"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
            {filteredCatalogServices.map((s) => {
              const isSelected = selected.includes(s.name);

              return (
                <div
                  key={s.id}
                  onClick={() => toggleService(s.name)}
                  className={`group relative cursor-pointer rounded-2xl border-2 border-foreground p-4 text-left transition-all ${
                    s.bg_class
                  } ${
                    isSelected
                      ? "-translate-y-1 shadow-brutal ring-4 ring-foreground"
                      : "shadow-brutal-sm hover:-translate-y-1 hover:shadow-brutal"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-3xl sm:text-4xl group-hover:scale-110 transition-transform">
                      {s.emoji}
                    </span>
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-foreground shadow-brutal-sm transition-colors ${
                        isSelected
                          ? "bg-foreground text-background"
                          : "bg-card text-foreground group-hover:bg-foreground group-hover:text-background"
                      }`}
                    >
                      {isSelected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5" />}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-black leading-tight sm:text-lg">{s.name}</h3>
                  <p className="mt-1 text-[10px] font-bold uppercase opacity-80 sm:text-xs">
                    {s.category}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-center">
          <Button
            onClick={scrollToForm}
            className="rounded-full border-2 border-foreground bg-foreground text-background text-base font-black px-8 py-6 shadow-brutal hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all"
          >
            {selected.length > 0
              ? `Proceed with ${selected.length} Tool${selected.length === 1 ? "" : "s"} →`
              : "Request Access Now →"}
          </Button>
        </div>
      </section>

      {/* Request Form Section */}
      <section id="request" className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="rounded-3xl border-2 border-foreground bg-card p-6 shadow-brutal-lg sm:p-8 md:p-12">
          <div className="text-center">
            <span className="inline-block rounded-full border-2 border-foreground bg-brand-pink text-white px-3.5 py-1 text-xs font-black shadow-brutal-sm uppercase">
              Application Form
            </span>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl md:text-5xl">
              Complete your <span className="text-gradient-hero">request</span>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base font-medium">
              Review your stack and tell us where to send your access details.
            </p>
          </div>

          {submittedRequest ? (
            <div className="mt-8 rounded-3xl border-2 border-foreground bg-background p-6 text-center shadow-brutal sm:p-8">
              <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-foreground bg-brand-lime shadow-brutal-sm">
                <Check className="h-8 w-8" strokeWidth={3} />
              </div>
              <h3 className="mt-5 text-2xl font-black sm:text-3xl">
                Request Submitted Successfully!
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                Thanks <strong>{submittedRequest.name}</strong>. We received your request and will contact you at{" "}
                <span className="font-bold text-foreground">{submittedRequest.email}</span>.
              </p>

              {/* Reference Code Box */}
              <div className="mt-6 rounded-2xl border-2 border-foreground bg-card p-5 shadow-brutal">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Your Unique Tracking Reference Code
                </p>
                <div className="mt-3 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <div className="inline-flex rounded-full border-2 border-foreground bg-brand-yellow px-5 py-2.5 font-mono text-base sm:text-lg font-black shadow-brutal-sm">
                    {submittedRequest.referenceCode}
                  </div>
                  <Button
                    type="button"
                    onClick={() => void copyReferenceCode(submittedRequest.referenceCode)}
                    className="rounded-full border-2 border-foreground bg-card text-foreground font-bold shadow-brutal-sm hover:bg-muted"
                  >
                    Copy Code
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Save this code to check your live review and handoff progress below.
                </p>
              </div>

              {submittedRequest.selectedServices.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Requested Stack
                  </p>
                  <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                    {submittedRequest.selectedServices.map((service) => (
                      <span
                        key={service}
                        className="rounded-full border-2 border-foreground bg-card px-3.5 py-1 text-xs font-bold shadow-brutal-sm"
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
                  className="rounded-full border-2 border-foreground bg-brand-lime text-foreground font-black px-6 py-3 shadow-brutal-sm hover:bg-brand-yellow"
                >
                  Track Live Status →
                </Button>
                <Button
                  type="button"
                  onClick={() => setSubmittedRequest(null)}
                  className="rounded-full border-2 border-foreground bg-card text-foreground font-bold px-6 py-3 shadow-brutal-sm hover:bg-muted"
                >
                  Submit Another
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {/* Selected Services Pill Box */}
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <Label className="font-black text-sm">
                    Selected Subscriptions *{" "}
                    <span className="font-normal text-muted-foreground">({selected.length}/10 selected)</span>
                  </Label>
                  {selected.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelected([])}
                      className="text-xs font-bold text-destructive hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {selected.length > 0 ? (
                  <div className="flex flex-wrap gap-2 rounded-2xl border-2 border-foreground bg-background p-3 shadow-brutal-sm">
                    {selected.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1.5 rounded-full border-2 border-foreground bg-card px-3 py-1 text-xs font-black shadow-brutal-sm"
                      >
                        {name}
                        <button
                          type="button"
                          onClick={() => removeService(name)}
                          className="rounded-full hover:bg-destructive hover:text-destructive-foreground p-0.5 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="cursor-pointer rounded-2xl border-2 border-dashed border-foreground bg-background p-4 text-center text-xs font-bold text-muted-foreground hover:bg-muted transition-colors"
                  >
                    No subscriptions selected yet. Tap tools above in the catalog or choose below!
                  </div>
                )}

                {/* Grid selection buttons */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 pt-2">
                  {services.map((s) => {
                    const isOn = selected.includes(s.name);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleService(s.name)}
                        aria-pressed={isOn}
                        className={`relative rounded-xl border-2 border-foreground p-2.5 text-left transition-all ${
                          isOn
                            ? `${s.bg_class} shadow-brutal-sm -translate-y-0.5 font-black ring-2 ring-foreground`
                            : "bg-background hover:bg-muted shadow-brutal-sm"
                        }`}
                      >
                        {isOn && (
                          <span className="absolute -top-2 -right-2 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-foreground bg-foreground text-background">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                        <div className="text-xl">{s.emoji}</div>
                        <div className="mt-1 text-xs font-bold leading-tight">{s.name}</div>
                      </button>
                    );
                  })}
                </div>

                {errors.selected_services && (
                  <p className="text-xs font-bold text-destructive">{errors.selected_services}</p>
                )}
              </div>

              {/* Name & Email Fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-bold text-sm">
                    Full Name *
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
                    className={`rounded-xl border-2 bg-background h-12 shadow-brutal-sm focus-visible:ring-0 ${
                      errors.name ? "border-destructive" : "border-foreground"
                    }`}
                    placeholder="Ada Lovelace"
                  />
                  {errors.name && <p className="text-xs font-bold text-destructive">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold text-sm">
                    Email Address *
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
                    className={`rounded-xl border-2 bg-background h-12 shadow-brutal-sm focus-visible:ring-0 ${
                      errors.email ? "border-destructive" : "border-foreground"
                    }`}
                    placeholder="ada@example.com"
                  />
                  {errors.email && <p className="text-xs font-bold text-destructive">{errors.email}</p>}
                </div>
              </div>

              {/* Dynamic Fields */}
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

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full border-2 border-foreground bg-gradient-cta text-white text-base font-black py-6 shadow-brutal hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all disabled:opacity-60"
              >
                {submitting ? (
                  "Sending & Running AI Triage…"
                ) : (
                  <>
                    Submit Request {selected.length > 0 ? `(${selected.length} Tools)` : ""}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-muted-foreground pt-1">
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-brand-lime" /> No Credit Card Required
                </span>
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-brand-cyan" /> Free Forever
                </span>
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-brand-pink" /> 1-Code Tracking
                </span>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* Tracker Component */}
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

      {/* Footer */}
      <footer className="border-t-2 border-foreground bg-card mt-12">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-foreground bg-background/80 px-5 py-6 shadow-brutal-sm sm:px-8">
            <div className="relative flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:items-end sm:text-left">
              <div>
                <BrandLogo size="sm" />
                <p className="mt-3 text-xs font-medium text-muted-foreground">
                  © {new Date().getFullYear()} SocZen. Premium subscription access desk.
                </p>
              </div>

              <div className="rounded-2xl border-2 border-foreground bg-card px-4 py-2.5 shadow-brutal-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Powered by
                </p>
                <p className="font-display text-lg font-black text-foreground">
                  SocZen <span className="text-gradient-hero">Access Desk</span>
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
    <Label htmlFor={field.field_key} className="font-bold text-sm">
      {field.label}
      {field.is_required ? " *" : ""}{" "}
      {!field.is_required && <span className="font-normal text-muted-foreground">(optional)</span>}
    </Label>
  );

  if (field.field_type === "textarea") {
    const textVal = (value as string) ?? "";
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          {labelEl}
          <span className="text-[10px] text-muted-foreground font-mono">
            {textVal.length}/{field.max_length}
          </span>
        </div>
        <Textarea
          id={field.field_key}
          maxLength={field.max_length}
          rows={3}
          value={textVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ""}
          className={`rounded-xl border-2 bg-background shadow-brutal-sm focus-visible:ring-0 resize-none ${
            error ? "border-destructive" : "border-foreground"
          }`}
        />
        {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
        {error && <p className="text-xs font-bold text-destructive">{error}</p>}
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
            className={`rounded-xl border-2 bg-background h-12 shadow-brutal-sm ${
              error ? "border-destructive" : "border-foreground"
            }`}
          >
            <SelectValue placeholder={field.placeholder ?? "Choose one…"} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 border-foreground bg-card">
            {field.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
        {error && <p className="text-xs font-bold text-destructive">{error}</p>}
      </div>
    );
  }

  if (field.field_type === "checkbox") {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-3 rounded-xl border-2 border-foreground bg-background p-3.5 shadow-brutal-sm cursor-pointer">
          <Checkbox
            id={field.field_key}
            checked={value === true}
            onCheckedChange={(v) => onChange(v === true)}
            className="mt-0.5 border-2 border-foreground"
          />
          <div>
            <Label htmlFor={field.field_key} className="font-bold cursor-pointer text-sm">
              {field.label}
              {field.is_required ? " *" : ""}
            </Label>
            {field.help_text && <p className="text-xs text-muted-foreground mt-0.5">{field.help_text}</p>}
          </div>
        </div>
        {error && <p className="text-xs font-bold text-destructive">{error}</p>}
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
        className={`rounded-xl border-2 bg-background h-12 shadow-brutal-sm focus-visible:ring-0 ${
          error ? "border-destructive" : "border-foreground"
        }`}
      />
      {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
      {error && <p className="text-xs font-bold text-destructive">{error}</p>}
    </div>
  );
}

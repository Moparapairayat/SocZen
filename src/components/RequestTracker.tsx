import type { FormEvent } from "react";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Mail,
  PhoneCall,
  Search,
  Sparkles,
  XCircle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicRequestStatus, PublicTrackedRequest } from "@/utils/public.functions";

type RequestTrackerProps = {
  reference: string;
  email: string;
  onReferenceChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  error: string | null;
  request: PublicTrackedRequest | null;
  latestReference?: string | null;
  latestEmail?: string | null;
  onUseLatestRequest?: () => void;
  onCopyReference?: (reference: string) => void;
};

const STATUS_META: Record<
  PublicRequestStatus,
  {
    label: string;
    summary: string;
    bgClass: string;
    Icon: typeof Clock3;
  }
> = {
  pending: {
    label: "Under Review",
    summary: "Your request is in the queue and being analyzed by our AI triage engine.",
    bgClass: "bg-brand-yellow",
    Icon: Clock3,
  },
  approved: {
    label: "Approved & Queued",
    summary: "Congratulations! Your request cleared review and access setup is in progress.",
    bgClass: "bg-brand-lime",
    Icon: CheckCircle2,
  },
  contacted: {
    label: "Access Dispatched",
    summary: "SocZen desk has reached out. Please check your inbox (and spam) for login details.",
    bgClass: "bg-brand-cyan",
    Icon: PhoneCall,
  },
  rejected: {
    label: "Request Closed",
    summary: "This request could not be fulfilled at this time due to slot availability.",
    bgClass: "bg-destructive text-destructive-foreground",
    Icon: XCircle,
  },
};

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);

  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;

  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;

  return new Date(iso).toLocaleDateString();
}

export function RequestTracker({
  reference,
  email,
  onReferenceChange,
  onEmailChange,
  onSubmit,
  loading,
  error,
  request,
  latestReference,
  latestEmail,
  onUseLatestRequest,
  onCopyReference,
}: RequestTrackerProps) {
  const current = request ? STATUS_META[request.status] : null;
  const canUseLatestRequest =
    !!latestReference &&
    !!latestEmail &&
    onUseLatestRequest &&
    (latestReference !== reference.trim() || latestEmail !== email.trim());

  return (
    <section id="track" className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="rounded-3xl border-2 border-foreground bg-card p-6 shadow-brutal-lg sm:p-8 md:p-10">
        <div className="text-center">
          <span className="inline-block rounded-full border-2 border-foreground bg-brand-cyan px-3.5 py-1 text-xs font-black shadow-brutal-sm uppercase">
            LIVE TRACKER
          </span>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            Track your <span className="text-gradient-hero">access status</span>
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base font-medium">
            Enter your email and reference code to see real-time review progress.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="tracking-email" className="text-xs font-black uppercase text-foreground">
                Request Email *
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tracking-email"
                  type="email"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  placeholder="ada@example.com"
                  className="h-12 rounded-xl border-2 border-foreground bg-background pl-10 text-sm shadow-brutal-sm focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="tracking-reference" className="text-xs font-black uppercase text-foreground">
                Reference Code *
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tracking-reference"
                  value={reference}
                  onChange={(event) => onReferenceChange(event.target.value)}
                  placeholder="SZ-XXXX-XXXX-XXXX"
                  className="h-12 rounded-xl border-2 border-foreground bg-background pl-10 font-mono text-sm shadow-brutal-sm focus-visible:ring-0"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
            <p className="text-xs text-muted-foreground font-medium">
              🔒 Privacy-first lookup with end-to-end verification.
            </p>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 rounded-full border-2 border-foreground bg-foreground px-7 text-background font-black shadow-brutal-sm transition-all hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none"
            >
              {loading ? "Searching…" : "Track Live Status"}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>

          {canUseLatestRequest && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onUseLatestRequest}
                className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-brand-yellow px-4 py-1.5 text-xs font-black shadow-brutal-sm transition-all hover:-translate-y-0.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Auto-fill last submitted request details
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border-2 border-destructive bg-destructive/10 px-4 py-3 text-xs sm:text-sm font-bold text-destructive">
              ⚠️ {error}
            </div>
          )}
        </form>

        {request && current && (
          <div className="mt-8 space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Status Summary Card */}
            <div className="rounded-3xl border-2 border-foreground bg-background p-5 shadow-brutal sm:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    CURRENT PROGRESS
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border-2 border-foreground px-3.5 py-1 text-xs sm:text-sm font-black shadow-brutal-sm ${current.bgClass}`}
                    >
                      <current.Icon className="h-4 w-4" />
                      {current.label}
                    </span>
                    <span className="rounded-full border-2 border-foreground bg-card px-3.5 py-1 font-mono text-xs font-black shadow-brutal-sm">
                      {request.reference_code}
                    </span>
                    {onCopyReference && (
                      <button
                        type="button"
                        onClick={() => onCopyReference(request.reference_code)}
                        className="inline-flex items-center gap-1.5 rounded-full border-2 border-foreground bg-card px-3 py-1 text-xs font-bold shadow-brutal-sm hover:bg-muted"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                    )}
                  </div>
                  <p className="mt-3.5 max-w-xl text-sm font-medium text-muted-foreground">
                    {current.summary}
                  </p>
                </div>

                <div className="rounded-2xl border-2 border-foreground bg-card px-4 py-3 shadow-brutal-sm shrink-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Submitted Date
                  </div>
                  <div className="mt-1 text-xs font-black text-foreground">
                    {new Date(request.created_at).toLocaleDateString()}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold text-muted-foreground">
                    {formatRelative(request.created_at)}
                  </div>
                </div>
              </div>

              {request.selected_services.length > 0 && (
                <div className="mt-5 pt-4 border-t-2 border-foreground/10">
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Included Subscriptions
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {request.selected_services.map((service) => (
                      <span
                        key={service}
                        className="rounded-full border-2 border-foreground bg-card px-3 py-1 text-xs font-bold shadow-brutal-sm"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Timeline Log */}
            <div className="rounded-3xl border-2 border-foreground bg-muted p-5 shadow-brutal-sm sm:p-6">
              <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-foreground">
                <Clock3 className="h-4 w-4" />
                Audit Status Timeline
              </div>

              <ol className="relative space-y-3.5 pl-5 border-l-2 border-foreground/20 ml-2">
                {request.history.map((entry, index) => {
                  const meta = STATUS_META[entry.status];
                  const isLatest = index === request.history.length - 1;

                  return (
                    <li key={`${entry.changed_at}-${index}`} className="relative pl-3">
                      <span
                        className={`absolute -left-[1.85rem] top-1.5 h-4 w-4 rounded-full border-2 border-foreground ${
                          meta.bgClass
                        } ${isLatest ? "ring-2 ring-foreground" : ""}`}
                      />
                      <div className="rounded-2xl border-2 border-foreground bg-card p-3.5 shadow-brutal-sm">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                            {meta.label}
                            {isLatest && (
                              <span className="rounded-full bg-brand-lime px-2 py-0.2 text-[9px] font-black uppercase border border-foreground">
                                Active Step
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {new Date(entry.changed_at).toLocaleString()} ({formatRelative(entry.changed_at)})
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground font-medium">{meta.summary}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

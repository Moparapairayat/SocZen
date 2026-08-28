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
    label: "Pending review",
    summary: "Your request is in the queue and waiting for review.",
    bgClass: "bg-brand-yellow",
    Icon: Clock3,
  },
  approved: {
    label: "Approved",
    summary: "Your request was approved and handoff is moving forward.",
    bgClass: "bg-brand-lime",
    Icon: CheckCircle2,
  },
  contacted: {
    label: "Contacted",
    summary: "SocZen already reached out. Check your inbox for the next step.",
    bgClass: "bg-brand-cyan",
    Icon: PhoneCall,
  },
  rejected: {
    label: "Closed",
    summary: "This request is no longer active.",
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
      <div className="rounded-3xl border-2 border-foreground bg-card p-5 shadow-brutal-lg sm:p-8 md:p-10">
        <div className="text-center">
          <span className="inline-block rounded-full border-2 border-foreground bg-brand-cyan px-3 py-1 text-[10px] font-bold shadow-brutal-sm sm:px-4 sm:text-xs">
            TRACK REQUEST
          </span>
          <h2 className="mt-3 text-3xl font-bold sm:mt-4 sm:text-4xl">
            Check your <span className="text-gradient-hero">status timeline</span>
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:mt-3 sm:text-base">
            Enter the same email used during submission plus your SocZen reference code to see the
            latest timeline.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="tracking-email" className="text-sm font-bold">
                Request email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tracking-email"
                  type="email"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  placeholder="ada@example.com"
                  className="h-12 rounded-full border-2 border-foreground bg-background pl-10 text-sm shadow-brutal-sm focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="tracking-reference" className="text-sm font-bold">
                Reference code
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tracking-reference"
                  value={reference}
                  onChange={(event) => onReferenceChange(event.target.value)}
                  placeholder="SZ-AB12-CD34-EF56"
                  className="h-12 rounded-full border-2 border-foreground bg-background pl-10 font-mono text-sm shadow-brutal-sm focus-visible:ring-0"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              For privacy, tracking only works with the same email that was used during submission.
            </p>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 rounded-full border-2 border-foreground bg-foreground px-6 text-background shadow-brutal-sm transition-all hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none"
            >
              {loading ? "Checking..." : "Track request"}
            </Button>
          </div>

          {canUseLatestRequest && (
            <button
              type="button"
              onClick={onUseLatestRequest}
              className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-background px-4 py-2 text-sm font-bold shadow-brutal-sm transition-all hover:-translate-y-0.5"
            >
              <Sparkles className="h-4 w-4" />
              Use latest request details
            </button>
          )}

          {error && (
            <div className="rounded-2xl border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </div>
          )}
        </form>

        {request && current && (
          <div className="mt-8 space-y-4">
            <div className="rounded-3xl border-2 border-foreground bg-background p-5 shadow-brutal sm:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                    Current status
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border-2 border-foreground px-3 py-1.5 text-sm font-bold shadow-brutal-sm ${current.bgClass}`}
                    >
                      <current.Icon className="h-4 w-4" />
                      {current.label}
                    </span>
                    <span className="rounded-full border-2 border-foreground bg-card px-3 py-1.5 font-mono text-xs font-bold shadow-brutal-sm sm:text-sm">
                      {request.reference_code}
                    </span>
                    {onCopyReference && (
                      <button
                        type="button"
                        onClick={() => onCopyReference(request.reference_code)}
                        className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-card px-3 py-1.5 text-xs font-bold shadow-brutal-sm transition-all hover:-translate-y-0.5 sm:text-sm"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                    )}
                  </div>
                  <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
                    {current.summary}
                  </p>
                </div>

                <div className="rounded-2xl border-2 border-foreground bg-card px-4 py-3 shadow-brutal-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Submitted
                  </div>
                  <div className="mt-2 text-sm font-bold text-foreground">
                    {new Date(request.created_at).toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatRelative(request.created_at)}
                  </div>
                </div>
              </div>

              {request.selected_services.length > 0 && (
                <div className="mt-6">
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                    Requested subscriptions
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {request.selected_services.map((service) => (
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
            </div>

            <div className="rounded-3xl border-2 border-foreground bg-muted p-5 shadow-brutal-sm sm:p-6">
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Status timeline
              </div>

              <ol className="relative space-y-4 pl-6">
                <span
                  aria-hidden
                  className="absolute left-[0.45rem] top-2 bottom-2 w-0.5 bg-foreground/20"
                />
                {request.history.map((entry, index) => {
                  const meta = STATUS_META[entry.status];

                  return (
                    <li key={`${entry.changed_at}-${index}`} className="relative">
                      <span
                        className={`absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-foreground ${meta.bgClass}`}
                      />
                      <div className="rounded-2xl border-2 border-foreground bg-card p-4 shadow-brutal-sm">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm font-bold">{meta.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(entry.changed_at).toLocaleString()} |{" "}
                            {formatRelative(entry.changed_at)}
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{meta.summary}</p>
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

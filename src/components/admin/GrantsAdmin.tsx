import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Calendar, AlertTriangle } from "lucide-react";
import {
  listGrants,
  createGrant,
  updateGrant,
  deleteGrant,
  listServices,
  type AdminGrant,
  type GrantStatus,
  type AdminService,
} from "@/utils/admin.functions";

type Props = { password: string };

const STATUS_LIST: GrantStatus[] = ["active", "expired", "revoked"];

const STATUS_BG: Record<GrantStatus, string> = {
  active: "bg-brand-lime",
  expired: "bg-brand-yellow",
  revoked: "bg-destructive text-destructive-foreground",
};

function emptyGrant(): Omit<AdminGrant, "id"> {
  return {
    email: "",
    name: "",
    service_name: "",
    request_id: null,
    granted_at: new Date().toISOString(),
    expires_at: null,
    status: "active",
    notes: "",
  };
}

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function fromLocalInputValue(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function daysUntil(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function GrantsAdmin({ password }: Props) {
  const [grants, setGrants] = useState<AdminGrant[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<GrantStatus | "all">("all");
  const [editing, setEditing] = useState<AdminGrant | null>(null);
  const [creating, setCreating] = useState<Omit<AdminGrant, "id"> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminGrant | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [{ grants }, { services }] = await Promise.all([
        listGrants({ data: { password } }),
        listServices({ data: { password } }),
      ]);
      setGrants(grants);
      setServices(services);
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background Live Sync for Grants (Every 5s)
  useEffect(() => {
    const timer = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const [{ grants: latestGrants }, { services: latestServices }] = await Promise.all([
          listGrants({ data: { password } }),
          listServices({ data: { password } }),
        ]);
        setGrants(latestGrants);
        setServices(latestServices);
      } catch {
        // silent catch
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [password]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return grants.filter((g) => {
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (!q) return true;
      return (
        g.email.toLowerCase().includes(q) ||
        (g.name ?? "").toLowerCase().includes(q) ||
        g.service_name.toLowerCase().includes(q)
      );
    });
  }, [grants, query, statusFilter]);

  const counts = useMemo(() => {
    const c = { all: grants.length, active: 0, expired: 0, revoked: 0, expiring: 0 };
    for (const g of grants) {
      c[g.status] += 1;
      if (g.status === "active" && g.expires_at) {
        const d = daysUntil(g.expires_at);
        if (d !== null && d <= 7) c.expiring += 1;
      }
    }
    return c;
  }, [grants]);

  async function save() {
    const payload = editing
      ? {
          email: editing.email,
          name: editing.name,
          service_name: editing.service_name,
          request_id: editing.request_id,
          granted_at: editing.granted_at,
          expires_at: editing.expires_at,
          status: editing.status,
          notes: editing.notes,
        }
      : creating!;
    try {
      if (editing) {
        await updateGrant({ data: { password, id: editing.id, grant: payload } });
        toast.success("Saved");
      } else {
        await createGrant({ data: { password, grant: payload } });
        toast.success("Granted");
      }
      setEditing(null);
      setCreating(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    try {
      await deleteGrant({ data: { password, id: confirmDelete.id } });
      toast.success("Removed");
      setConfirmDelete(null);
      void load();
    } catch {
      toast.error("Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Granted subscriptions</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Per-user access with expiry tracking.
          </p>
        </div>
        <Button
          onClick={() => setCreating(emptyGrant())}
          className="rounded-full border-2 border-foreground bg-gradient-cta text-white shadow-brutal-sm hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none transition-all"
        >
          <Plus className="mr-1 h-4 w-4" /> Grant access
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          [
            { key: "all", label: "Total", bg: "bg-card", count: counts.all },
            { key: "active", label: "Active", bg: "bg-brand-lime", count: counts.active },
            {
              key: "expiring",
              label: "Expiring ≤7d",
              bg: "bg-brand-orange",
              count: counts.expiring,
            },
            { key: "expired", label: "Expired", bg: "bg-brand-yellow", count: counts.expired },
            {
              key: "revoked",
              label: "Revoked",
              bg: "bg-destructive text-destructive-foreground",
              count: counts.revoked,
            },
          ] as const
        ).map((c) => (
          <button
            key={c.key}
            onClick={() =>
              setStatusFilter(c.key === "expiring" ? "active" : (c.key as GrantStatus | "all"))
            }
            className={`rounded-2xl border-2 border-foreground p-3 text-left shadow-brutal-sm transition-all hover:-translate-y-0.5 ${c.bg}`}
          >
            <p className="text-[10px] font-bold uppercase opacity-80">{c.label}</p>
            <p className="text-2xl font-bold">{c.count}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email, name or service…"
            className="rounded-full border-2 border-foreground bg-card pl-10 h-11 shadow-brutal-sm focus-visible:ring-0"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as GrantStatus | "all")}
        >
          <SelectTrigger className="w-full rounded-full border-2 border-foreground bg-card font-bold shadow-brutal-sm sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 border-foreground">
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_LIST.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && grants.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-foreground bg-card p-10 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-foreground bg-card p-10 text-center">
          <p className="font-bold">No grants {query ? "match" : "yet"}.</p>
          <p className="text-xs text-muted-foreground">
            {query
              ? "Try a different search."
              : "Approve a request and grant a subscription with an expiry date."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) => {
            const days = daysUntil(g.expires_at);
            const expiringSoon = g.status === "active" && days !== null && days <= 7;
            return (
              <div
                key={g.id}
                className="rounded-2xl border-2 border-foreground bg-card p-3 shadow-brutal-sm sm:p-4"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold">{g.service_name}</span>
                      <span
                        className={`rounded-full border-2 border-foreground px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_BG[g.status]}`}
                      >
                        {g.status}
                      </span>
                      {expiringSoon && (
                        <span className="inline-flex items-center gap-1 rounded-full border-2 border-foreground bg-brand-orange px-2 py-0.5 text-[10px] font-bold uppercase">
                          <AlertTriangle className="h-3 w-3" /> {days}d left
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm">
                      <span className="font-semibold">{g.name || "—"}</span>{" "}
                      <a
                        href={`mailto:${g.email}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ({g.email})
                      </a>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Granted{" "}
                        {new Date(g.granted_at).toLocaleDateString()}
                      </span>
                      {g.expires_at && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Expires{" "}
                          {new Date(g.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                    {g.notes && (
                      <p className="mt-1 text-xs italic text-muted-foreground">"{g.notes}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(g)}
                      className="h-8 rounded-md border-2 border-foreground bg-card px-2"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDelete(g)}
                      className="h-8 rounded-md border-2 border-foreground bg-destructive px-2 text-destructive-foreground"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!editing || !!creating}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setCreating(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit grant" : "Grant subscription access"}</DialogTitle>
            <DialogDescription>
              Link a subscription to a user (by email) with an optional expiry date.
            </DialogDescription>
          </DialogHeader>
          {(editing || creating) && (
            <GrantForm
              value={editing ?? (creating as Omit<AdminGrant, "id">)}
              services={services}
              onChange={(v) => {
                if (editing) setEditing({ ...editing, ...v });
                else setCreating({ ...(creating as Omit<AdminGrant, "id">), ...v });
              }}
            />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setCreating(null);
              }}
              className="rounded-full border-2 border-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              className="rounded-full border-2 border-foreground bg-gradient-cta text-white"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-2 border-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this grant?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.email} loses access to {confirmDelete?.service_name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full border-2 border-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="rounded-full border-2 border-foreground bg-destructive text-destructive-foreground"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GrantForm({
  value,
  services,
  onChange,
}: {
  value: Omit<AdminGrant, "id"> | AdminGrant;
  services: AdminService[];
  onChange: (v: Partial<AdminGrant>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Email</Label>
        <Input
          type="email"
          value={value.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="user@example.com"
          className="rounded-xl border-2 border-foreground"
        />
      </div>
      <div>
        <Label>Name (optional)</Label>
        <Input
          value={value.name ?? ""}
          onChange={(e) => onChange({ name: e.target.value })}
          className="rounded-xl border-2 border-foreground"
        />
      </div>
      <div>
        <Label>Subscription</Label>
        <Select value={value.service_name} onValueChange={(v) => onChange({ service_name: v })}>
          <SelectTrigger className="rounded-xl border-2 border-foreground">
            <SelectValue placeholder="Pick a subscription" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 border-foreground">
            {services.map((s) => (
              <SelectItem key={s.id} value={s.name}>
                {s.emoji} {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Granted at</Label>
          <Input
            type="datetime-local"
            value={toLocalInputValue(value.granted_at)}
            onChange={(e) =>
              onChange({
                granted_at: fromLocalInputValue(e.target.value) ?? new Date().toISOString(),
              })
            }
            className="rounded-xl border-2 border-foreground"
          />
        </div>
        <div>
          <Label>Expires at (optional)</Label>
          <Input
            type="datetime-local"
            value={toLocalInputValue(value.expires_at)}
            onChange={(e) => onChange({ expires_at: fromLocalInputValue(e.target.value) })}
            className="rounded-xl border-2 border-foreground"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { label: "+30d", days: 30 },
          { label: "+90d", days: 90 },
          { label: "+1y", days: 365 },
          { label: "Never", days: null as number | null },
        ].map((q) => (
          <Button
            key={q.label}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (q.days === null) onChange({ expires_at: null });
              else
                onChange({
                  expires_at: new Date(Date.now() + q.days * 86400000).toISOString(),
                });
            }}
            className="rounded-full border-2 border-foreground bg-card text-xs"
          >
            {q.label}
          </Button>
        ))}
      </div>
      <div>
        <Label>Status</Label>
        <Select value={value.status} onValueChange={(v) => onChange({ status: v as GrantStatus })}>
          <SelectTrigger className="rounded-xl border-2 border-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 border-foreground">
            {STATUS_LIST.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Notes (optional)</Label>
        <Textarea
          value={value.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={2}
          className="rounded-xl border-2 border-foreground"
        />
      </div>
    </div>
  );
}

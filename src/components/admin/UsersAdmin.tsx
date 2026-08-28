import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Search, Trash2, Mail, Building2 } from "lucide-react";
import {
  listRequesters,
  deleteRequesterByEmail,
  type AdminRequester,
} from "@/utils/admin.functions";

type Props = { password: string };

export function UsersAdmin({ password }: Props) {
  const [requesters, setRequesters] = useState<AdminRequester[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdminRequester | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { requesters } = await listRequesters({ data: { password } });
      setRequesters(requesters);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requesters;
    return requesters.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.company ?? "").toLowerCase().includes(q),
    );
  }, [requesters, query]);

  async function doDelete() {
    if (!confirmDelete) return;
    try {
      await deleteRequesterByEmail({ data: { password, email: confirmDelete.email } });
      toast.success(`Deleted ${confirmDelete.email}`);
      setConfirmDelete(null);
      void load();
    } catch {
      toast.error("Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold sm:text-2xl">Users (requesters)</h2>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Aggregated by email. {requesters.length} unique users.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users…"
          className="rounded-full border-2 border-foreground bg-card pl-10 h-11 shadow-brutal-sm focus-visible:ring-0"
        />
      </div>

      {loading && requesters.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-foreground bg-card p-10 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-foreground bg-card p-10 text-center">
          <p className="font-bold">No users {query ? "match" : "yet"}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <div
              key={u.email}
              className="rounded-2xl border-2 border-foreground bg-card p-3 shadow-brutal-sm sm:p-4"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold">{u.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground sm:text-sm">
                    <a
                      href={`mailto:${u.email}`}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <Mail className="h-3.5 w-3.5" /> {u.email}
                    </a>
                    {u.company && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" /> {u.company}
                      </span>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full border-2 border-foreground bg-brand-cyan px-2 py-0.5 text-[10px] font-bold">
                      {u.request_count} request{u.request_count === 1 ? "" : "s"}
                    </span>
                    {u.active_grants > 0 && (
                      <span className="rounded-full border-2 border-foreground bg-brand-lime px-2 py-0.5 text-[10px] font-bold">
                        {u.active_grants} active
                      </span>
                    )}
                    {u.expired_grants > 0 && (
                      <span className="rounded-full border-2 border-foreground bg-brand-yellow px-2 py-0.5 text-[10px] font-bold">
                        {u.expired_grants} expired
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(u)}
                  className="h-8 rounded-md border-2 border-foreground bg-destructive px-2 text-destructive-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-2 border-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes ALL their requests AND grants. Cannot be undone.
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
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

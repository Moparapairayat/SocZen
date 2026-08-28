import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import {
  listServices,
  createService,
  updateService,
  deleteService,
  type AdminService,
} from "@/utils/admin.functions";

const COLOR_PRESETS = [
  "bg-brand-lime",
  "bg-brand-cyan",
  "bg-brand-pink",
  "bg-brand-yellow",
  "bg-brand-orange",
  "bg-brand-violet text-white",
];

type Props = { password: string };

const empty = (next: number): Omit<AdminService, "id"> => ({
  slug: "",
  name: "",
  category: "General",
  emoji: "✨",
  bg_class: "bg-brand-lime",
  description: "",
  is_active: true,
  sort_order: next,
});

export function ServicesAdmin({ password }: Props) {
  const [services, setServices] = useState<AdminService[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<AdminService | null>(null);
  const [creating, setCreating] = useState<Omit<AdminService, "id"> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminService | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { services } = await listServices({ data: { password } });
      setServices(services);
    } catch {
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextSort = useMemo(
    () => (services.length === 0 ? 10 : Math.max(...services.map((s) => s.sort_order)) + 10),
    [services],
  );

  async function toggleActive(s: AdminService, value: boolean) {
    const prev = services;
    setServices((all) => all.map((x) => (x.id === s.id ? { ...x, is_active: value } : x)));
    try {
      await updateService({
        data: {
          password,
          id: s.id,
          service: {
            slug: s.slug,
            name: s.name,
            category: s.category,
            emoji: s.emoji,
            bg_class: s.bg_class,
            description: s.description,
            is_active: value,
            sort_order: s.sort_order,
          },
        },
      });
      toast.success(value ? "Visible on site" : "Hidden");
    } catch {
      setServices(prev);
      toast.error("Update failed");
    }
  }

  async function move(s: AdminService, dir: -1 | 1) {
    const sorted = [...services].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === s.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    const a = { ...s, sort_order: swap.sort_order };
    const b = { ...swap, sort_order: s.sort_order };
    setServices((all) => all.map((x) => (x.id === a.id ? a : x.id === b.id ? b : x)));
    try {
      await Promise.all([
        updateService({
          data: {
            password,
            id: a.id,
            service: {
              slug: a.slug,
              name: a.name,
              category: a.category,
              emoji: a.emoji,
              bg_class: a.bg_class,
              description: a.description,
              is_active: a.is_active,
              sort_order: a.sort_order,
            },
          },
        }),
        updateService({
          data: {
            password,
            id: b.id,
            service: {
              slug: b.slug,
              name: b.name,
              category: b.category,
              emoji: b.emoji,
              bg_class: b.bg_class,
              description: b.description,
              is_active: b.is_active,
              sort_order: b.sort_order,
            },
          },
        }),
      ]);
    } catch {
      toast.error("Reorder failed");
      void load();
    }
  }

  async function save() {
    const payload = editing
      ? {
          slug: editing.slug,
          name: editing.name,
          category: editing.category,
          emoji: editing.emoji,
          bg_class: editing.bg_class,
          description: editing.description,
          is_active: editing.is_active,
          sort_order: editing.sort_order,
        }
      : creating!;
    try {
      if (editing) {
        await updateService({ data: { password, id: editing.id, service: payload } });
        toast.success("Saved");
      } else {
        await createService({ data: { password, service: payload } });
        toast.success("Created");
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
      await deleteService({ data: { password, id: confirmDelete.id } });
      toast.success("Deleted");
      setConfirmDelete(null);
      void load();
    } catch {
      toast.error("Delete failed");
    }
  }

  const sorted = [...services].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Subscription products</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {services.length} total · Active items show on the landing page.
          </p>
        </div>
        <Button
          onClick={() => setCreating(empty(nextSort))}
          className="rounded-full border-2 border-foreground bg-gradient-cta text-white shadow-brutal-sm hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none transition-all"
        >
          <Plus className="mr-1 h-4 w-4" /> New product
        </Button>
      </div>

      {loading && services.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-foreground bg-card p-10 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((s, i) => (
            <div
              key={s.id}
              className={`rounded-2xl border-2 border-foreground p-4 shadow-brutal-sm ${s.bg_class} ${
                !s.is_active ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-3xl">{s.emoji}</div>
                <div className="flex flex-col items-end gap-1">
                  <Switch checked={s.is_active} onCheckedChange={(v) => toggleActive(s, v)} />
                  <span className="text-[10px] font-bold uppercase opacity-80">
                    {s.is_active ? "Live" : "Hidden"}
                  </span>
                </div>
              </div>
              <h3 className="mt-2 text-base font-bold leading-tight">{s.name}</h3>
              <p className="text-[10px] font-semibold uppercase opacity-70">{s.category}</p>
              <div className="mt-3 flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => move(s, -1)}
                  disabled={i === 0}
                  className="h-7 rounded-md border-2 border-foreground bg-card px-2 text-xs disabled:opacity-30"
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => move(s, 1)}
                  disabled={i === sorted.length - 1}
                  className="h-7 rounded-md border-2 border-foreground bg-card px-2 text-xs disabled:opacity-30"
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(s)}
                  className="ml-auto h-7 rounded-md border-2 border-foreground bg-card px-2 text-xs"
                >
                  <Pencil className="mr-1 h-3 w-3" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(s)}
                  className="h-7 rounded-md border-2 border-foreground bg-destructive px-2 text-xs text-destructive-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
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
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
            <DialogDescription>
              Configure how this subscription appears on the landing page.
            </DialogDescription>
          </DialogHeader>
          {(editing || creating) && (
            <ServiceForm
              value={editing ?? (creating as Omit<AdminService, "id">)}
              onChange={(v) => {
                if (editing) setEditing({ ...editing, ...v });
                else setCreating({ ...(creating as Omit<AdminService, "id">), ...v });
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
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The product will disappear from the landing page immediately. Existing requests that
              selected it are not affected.
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ServiceForm({
  value,
  onChange,
}: {
  value: Omit<AdminService, "id"> | AdminService;
  onChange: (v: Partial<AdminService>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Slug</Label>
          <Input
            value={value.slug}
            onChange={(e) => onChange({ slug: e.target.value.toLowerCase() })}
            placeholder="chatgpt-plus"
            className="rounded-xl border-2 border-foreground"
          />
        </div>
        <div>
          <Label>Emoji</Label>
          <Input
            value={value.emoji}
            onChange={(e) => onChange({ emoji: e.target.value })}
            maxLength={4}
            className="rounded-xl border-2 border-foreground"
          />
        </div>
      </div>
      <div>
        <Label>Name</Label>
        <Input
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="ChatGPT Plus"
          className="rounded-xl border-2 border-foreground"
        />
      </div>
      <div>
        <Label>Category</Label>
        <Input
          value={value.category}
          onChange={(e) => onChange({ category: e.target.value })}
          placeholder="AI / Streaming / Design…"
          className="rounded-xl border-2 border-foreground"
        />
      </div>
      <div>
        <Label>Color</Label>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ bg_class: c })}
              className={`h-10 rounded-xl border-2 border-foreground ${c} ${
                value.bg_class === c ? "ring-2 ring-foreground ring-offset-2" : ""
              }`}
            />
          ))}
        </div>
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Textarea
          value={value.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="rounded-xl border-2 border-foreground"
        />
      </div>
      <div className="flex items-center justify-between rounded-xl border-2 border-foreground bg-card p-3">
        <div>
          <p className="font-bold">Active</p>
          <p className="text-xs text-muted-foreground">Show on landing page</p>
        </div>
        <Switch checked={value.is_active} onCheckedChange={(v) => onChange({ is_active: v })} />
      </div>
    </div>
  );
}

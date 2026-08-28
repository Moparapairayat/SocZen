import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, Lock } from "lucide-react";
import {
  listFormFields,
  createFormField,
  updateFormField,
  deleteFormField,
  type AdminFormField,
  type FormFieldType,
} from "@/utils/admin.functions";

type Props = { password: string };

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox (yes/no)" },
];

const empty = (next: number): Omit<AdminFormField, "id" | "is_builtin"> => ({
  field_key: "",
  label: "",
  field_type: "text",
  placeholder: "",
  help_text: "",
  options: [],
  is_required: false,
  is_active: true,
  max_length: 500,
  sort_order: next,
});

export function FieldsAdmin({ password }: Props) {
  const [fields, setFields] = useState<AdminFormField[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<AdminFormField | null>(null);
  const [creating, setCreating] = useState<Omit<AdminFormField, "id" | "is_builtin"> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminFormField | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { fields } = await listFormFields({ data: { password } });
      setFields(fields);
    } catch {
      toast.error("Failed to load fields");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextSort = fields.length === 0 ? 10 : Math.max(...fields.map((f) => f.sort_order)) + 10;

  async function toggleActive(f: AdminFormField, value: boolean) {
    setFields((all) => all.map((x) => (x.id === f.id ? { ...x, is_active: value } : x)));
    try {
      await updateFormField({
        data: {
          password,
          id: f.id,
          field: {
            field_key: f.field_key,
            label: f.label,
            field_type: f.field_type,
            placeholder: f.placeholder,
            help_text: f.help_text,
            options: f.options,
            is_required: f.is_required,
            is_active: value,
            max_length: f.max_length,
            sort_order: f.sort_order,
          },
        },
      });
    } catch {
      toast.error("Update failed");
      void load();
    }
  }

  async function move(f: AdminFormField, dir: -1 | 1) {
    const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === f.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    const aOrder = swap.sort_order;
    const bOrder = f.sort_order;
    setFields((all) =>
      all.map((x) =>
        x.id === f.id
          ? { ...x, sort_order: aOrder }
          : x.id === swap.id
            ? { ...x, sort_order: bOrder }
            : x,
      ),
    );
    try {
      await Promise.all([
        updateFormField({
          data: {
            password,
            id: f.id,
            field: { ...stripField(f), sort_order: aOrder },
          },
        }),
        updateFormField({
          data: {
            password,
            id: swap.id,
            field: { ...stripField(swap), sort_order: bOrder },
          },
        }),
      ]);
    } catch {
      toast.error("Reorder failed");
      void load();
    }
  }

  async function save() {
    const payload = editing ? stripField(editing) : creating!;
    try {
      if (editing) {
        await updateFormField({ data: { password, id: editing.id, field: payload } });
        toast.success("Saved");
      } else {
        await createFormField({ data: { password, field: payload } });
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
      await deleteFormField({ data: { password, id: confirmDelete.id } });
      toast.success("Deleted");
      setConfirmDelete(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Form fields</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Built-in fields can be re-labeled and toggled. Custom fields are saved per request.
          </p>
        </div>
        <Button
          onClick={() => setCreating(empty(nextSort))}
          className="rounded-full border-2 border-foreground bg-gradient-cta text-white shadow-brutal-sm hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none transition-all"
        >
          <Plus className="mr-1 h-4 w-4" /> New field
        </Button>
      </div>

      {loading && fields.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-foreground bg-card p-10 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((f, i) => (
            <div
              key={f.id}
              className={`rounded-2xl border-2 border-foreground bg-card p-3 shadow-brutal-sm sm:p-4 ${
                !f.is_active ? "opacity-50" : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold">{f.label}</span>
                    {f.is_builtin && (
                      <span className="inline-flex items-center gap-1 rounded-full border-2 border-foreground bg-brand-yellow px-2 py-0.5 text-[10px] font-bold uppercase">
                        <Lock className="h-3 w-3" /> built-in
                      </span>
                    )}
                    <span className="rounded-full border-2 border-foreground bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">
                      {f.field_type}
                    </span>
                    {f.is_required && (
                      <span className="rounded-full border-2 border-foreground bg-brand-pink px-2 py-0.5 text-[10px] font-bold uppercase">
                        required
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    key: <code className="font-mono">{f.field_key}</code>
                    {f.options.length > 0 && ` · options: ${f.options.join(", ")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => move(f, -1)}
                    disabled={i === 0}
                    className="h-8 rounded-md border-2 border-foreground bg-card px-2 disabled:opacity-30"
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => move(f, 1)}
                    disabled={i === sorted.length - 1}
                    className="h-8 rounded-md border-2 border-foreground bg-card px-2 disabled:opacity-30"
                  >
                    ↓
                  </Button>
                  <Switch checked={f.is_active} onCheckedChange={(v) => toggleActive(f, v)} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(f)}
                    className="h-8 rounded-md border-2 border-foreground bg-card px-2"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDelete(f)}
                    disabled={f.is_builtin}
                    className="h-8 rounded-md border-2 border-foreground bg-destructive px-2 text-destructive-foreground disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
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
            <DialogTitle>{editing ? "Edit field" : "New field"}</DialogTitle>
            <DialogDescription>
              {editing?.is_builtin
                ? "Built-in: only label, required, placeholder & visibility can change."
                : "Add a custom question for the public form."}
            </DialogDescription>
          </DialogHeader>
          {(editing || creating) && (
            <FieldForm
              value={editing ?? (creating as Omit<AdminFormField, "id" | "is_builtin">)}
              builtin={editing?.is_builtin ?? false}
              onChange={(v) => {
                if (editing) setEditing({ ...editing, ...v });
                else
                  setCreating({ ...(creating as Omit<AdminFormField, "id" | "is_builtin">), ...v });
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
            <AlertDialogTitle>Delete field "{confirmDelete?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The field disappears from the public form. Past responses are kept.
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

function stripField(f: AdminFormField) {
  return {
    field_key: f.field_key,
    label: f.label,
    field_type: f.field_type,
    placeholder: f.placeholder,
    help_text: f.help_text,
    options: f.options,
    is_required: f.is_required,
    is_active: f.is_active,
    max_length: f.max_length,
    sort_order: f.sort_order,
  };
}

function FieldForm({
  value,
  builtin,
  onChange,
}: {
  value: Omit<AdminFormField, "id" | "is_builtin"> | AdminFormField;
  builtin: boolean;
  onChange: (v: Partial<AdminFormField>) => void;
}) {
  const [optionsText, setOptionsText] = useState((value.options ?? []).join(", "));

  return (
    <div className="space-y-3">
      <div>
        <Label>Label (shown to users)</Label>
        <Input
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="rounded-xl border-2 border-foreground"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Field key</Label>
          <Input
            value={value.field_key}
            onChange={(e) =>
              onChange({ field_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })
            }
            disabled={builtin}
            placeholder="favorite_color"
            className="rounded-xl border-2 border-foreground disabled:opacity-60"
          />
        </div>
        <div>
          <Label>Type</Label>
          <Select
            value={value.field_type}
            onValueChange={(v) => onChange({ field_type: v as FormFieldType })}
            disabled={builtin}
          >
            <SelectTrigger className="rounded-xl border-2 border-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-2 border-foreground">
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Placeholder</Label>
        <Input
          value={value.placeholder ?? ""}
          onChange={(e) => onChange({ placeholder: e.target.value })}
          className="rounded-xl border-2 border-foreground"
        />
      </div>
      <div>
        <Label>Help text (optional)</Label>
        <Input
          value={value.help_text ?? ""}
          onChange={(e) => onChange({ help_text: e.target.value })}
          className="rounded-xl border-2 border-foreground"
        />
      </div>
      {value.field_type === "select" && (
        <div>
          <Label>Options (comma-separated)</Label>
          <Input
            value={optionsText}
            onChange={(e) => {
              setOptionsText(e.target.value);
              onChange({
                options: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              });
            }}
            disabled={builtin}
            placeholder="Option A, Option B, Option C"
            className="rounded-xl border-2 border-foreground"
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-xl border-2 border-foreground bg-card p-3">
          <span className="font-bold">Required</span>
          <Switch
            checked={value.is_required}
            onCheckedChange={(v) => onChange({ is_required: v })}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border-2 border-foreground bg-card p-3">
          <span className="font-bold">Active</span>
          <Switch checked={value.is_active} onCheckedChange={(v) => onChange({ is_active: v })} />
        </div>
      </div>
      <div>
        <Label>Max length</Label>
        <Input
          type="number"
          value={value.max_length}
          onChange={(e) => onChange({ max_length: Number(e.target.value) || 500 })}
          disabled={builtin}
          className="rounded-xl border-2 border-foreground"
        />
      </div>
    </div>
  );
}

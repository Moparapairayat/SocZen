import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Building2,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Inbox,
  Mail,
  MessageSquare,
  PencilLine,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Square as SquareIcon,
  Trash2,
  XCircle,
  Sparkles,
} from "lucide-react";
import {
  bulkDeleteRequests,
  bulkUpdateRequestStatus,
  createRequestTimelineEntry,
  deleteRequest,
  deleteRequestTimelineEntry,
  listSubscriptionRequests,
  sendRequestUpdateEmail,
  triggerAiTriageForRequest,
  updateRequestStatus,
  updateRequestTimelineEntry,
  type AdminRequest,
} from "@/utils/admin.functions";

type Status = AdminRequest["status"];
type FilterStatus = "all" | Status;
type SortKey = "newest" | "oldest" | "name";

type TimelineDraft = {
  mode: "create" | "edit";
  requestId: string;
  entryId?: string;
  status: Status;
  changedAt: string;
  note: string;
};

type ConfirmState =
  | { kind: "delete-one"; id: string; name: string }
  | { kind: "delete-bulk"; count: number }
  | { kind: "delete-timeline"; requestId: string; entryId: string; status: Status }
  | null;

const STATUS_LIST: Status[] = ["pending", "approved", "contacted", "rejected"];

const STATUS_STYLES: Record<Status, string> = {
  pending: "bg-brand-yellow",
  approved: "bg-brand-lime",
  contacted: "bg-brand-cyan",
  rejected: "bg-destructive text-destructive-foreground",
};

const STATUS_DOT: Record<Status, string> = {
  pending: "bg-brand-yellow",
  approved: "bg-brand-lime",
  contacted: "bg-brand-cyan",
  rejected: "bg-destructive",
};

const STAT_CARDS = [
  { key: "all" as FilterStatus, label: "Total", bg: "bg-card", Icon: Inbox },
  { key: "pending" as FilterStatus, label: "Pending", bg: "bg-brand-yellow", Icon: Clock },
  { key: "approved" as FilterStatus, label: "Approved", bg: "bg-brand-lime", Icon: CheckCircle2 },
  { key: "contacted" as FilterStatus, label: "Contacted", bg: "bg-brand-cyan", Icon: PhoneCall },
  {
    key: "rejected" as FilterStatus,
    label: "Rejected",
    bg: "bg-destructive text-destructive-foreground",
    Icon: XCircle,
  },
] as const;

const SERVICE_BG_PALETTE = [
  "bg-brand-lime",
  "bg-brand-cyan",
  "bg-brand-pink",
  "bg-brand-yellow",
  "bg-brand-violet text-white",
  "bg-brand-orange",
];

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

function serviceBg(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return SERVICE_BG_PALETTE[h % SERVICE_BG_PALETTE.length];
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadCsv(rows: AdminRequest[]) {
  const headers = [
    "id",
    "reference_code",
    "name",
    "email",
    "company",
    "selected_services",
    "use_case",
    "message",
    "status",
    "created_at",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.reference_code,
        row.name,
        row.email,
        row.company ?? "",
        row.selected_services.join("; "),
        row.use_case ?? "",
        row.message ?? "",
        row.status,
        row.created_at,
      ]
        .map((value) => csvEscape(String(value)))
        .join(","),
    );
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `subscription-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function grantLabel(count: number) {
  return `${count} grant${count === 1 ? "" : "s"}`;
}

function toDateTimeLocalValue(iso: string) {
  const date = new Date(iso);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

type Props = { password: string };

export function RequestsAdmin({ password }: Props) {
  const [loading, setLoading] = useState(false);
  const [realtime, setRealtime] = useState(true);
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [timelineDraft, setTimelineDraft] = useState<TimelineDraft | null>(null);
  const [timelineSaving, setTimelineSaving] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  async function handleRunAiTriage(requestId: string) {
    setAnalyzingIds((prev) => new Set(prev).add(requestId));
    try {
      const res = await triggerAiTriageForRequest({ data: { password, id: requestId } });
      toast.success(
        `AI Triage complete: Score ${res.triage.score}/100 (${res.triage.recommendation.toUpperCase()})`,
      );
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI Triage failed");
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  }

  async function load() {
    setLoading(true);
    try {
      const { requests } = await listSubscriptionRequests({ data: { password } });
      setRequests(requests);
      setSelectedIds(new Set());
      setTimelineDraft(null);
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-Time Background Live Sync (Every 4s)
  useEffect(() => {
    if (!realtime) return;

    const timer = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const { requests: latest } = await listSubscriptionRequests({ data: { password } });
        setRequests((prev) => {
          if (latest.length > prev.length) {
            const count = latest.length - prev.length;
            toast.info(`⚡ Live Signal: ${count} new subscription request received!`, {
              icon: "🔔",
            });
          }
          return latest;
        });
      } catch {
        // silent catch for background sync
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [password, realtime]);

  async function changeStatus(id: string, status: Status) {
    const prev = requests;
    setRequests((rows) => rows.map((row) => (row.id === id ? { ...row, status } : row)));

    try {
      const result = await updateRequestStatus({ data: { password, id, status } });
      if (status === "approved" && result.createdGrants > 0) {
        toast.success(`Marked as approved and created ${grantLabel(result.createdGrants)}`);
      } else {
        toast.success(`Marked as ${status}`);
      }
      void load();
    } catch {
      setRequests(prev);
      toast.error("Failed to update");
    }
  }

  async function bulkStatus(status: Status) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const prev = requests;
    setRequests((rows) => rows.map((row) => (selectedIds.has(row.id) ? { ...row, status } : row)));

    try {
      const result = await bulkUpdateRequestStatus({ data: { password, ids, status } });
      if (status === "approved" && result.createdGrants > 0) {
        toast.success(`Updated ${result.updated} and created ${grantLabel(result.createdGrants)}`);
      } else {
        toast.success(`Updated ${result.updated}`);
      }
      setSelectedIds(new Set());
      void load();
    } catch {
      setRequests(prev);
      toast.error("Bulk update failed");
    }
  }

  async function sendManualUpdateEmail(request: AdminRequest) {
    if (request.status === "pending") {
      toast.error("Pending requests do not have an update email yet");
      return;
    }

    setSendingEmailId(request.id);
    try {
      await sendRequestUpdateEmail({ data: { password, id: request.id } });
      toast.success("Update email sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send update email");
    } finally {
      setSendingEmailId((current) => (current === request.id ? null : current));
    }
  }

  function startCreateTimeline(request: AdminRequest) {
    setExpanded((prev) => new Set(prev).add(request.id));
    setTimelineDraft({
      mode: "create",
      requestId: request.id,
      status: request.status,
      changedAt: toDateTimeLocalValue(new Date().toISOString()),
      note: "",
    });
  }

  function startEditTimeline(requestId: string, entry: AdminRequest["history"][number]) {
    setTimelineDraft({
      mode: "edit",
      requestId,
      entryId: entry.id,
      status: entry.status,
      changedAt: toDateTimeLocalValue(entry.changed_at),
      note: entry.note ?? "",
    });
  }

  async function saveTimelineDraft() {
    if (!timelineDraft) return;

    const changedAt = timelineDraft.changedAt.trim();
    if (!changedAt) {
      toast.error("Pick a timeline date and time");
      return;
    }

    const parsed = new Date(changedAt);
    if (Number.isNaN(parsed.getTime())) {
      toast.error("Invalid timeline date");
      return;
    }

    setTimelineSaving(true);
    try {
      if (timelineDraft.mode === "create") {
        await createRequestTimelineEntry({
          data: {
            password,
            requestId: timelineDraft.requestId,
            status: timelineDraft.status,
            changedAt: parsed.toISOString(),
            note: timelineDraft.note.trim() || null,
          },
        });
        toast.success("Timeline entry added");
      } else {
        await updateRequestTimelineEntry({
          data: {
            password,
            requestId: timelineDraft.requestId,
            entryId: timelineDraft.entryId!,
            status: timelineDraft.status,
            changedAt: parsed.toISOString(),
            note: timelineDraft.note.trim() || null,
          },
        });
        toast.success("Timeline entry updated");
      }

      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save timeline entry");
    } finally {
      setTimelineSaving(false);
    }
  }

  async function doDeleteOne(id: string) {
    const prev = requests;
    setRequests((rows) => rows.filter((row) => row.id !== id));

    try {
      await deleteRequest({ data: { password, id } });
      toast.success("Deleted");
    } catch {
      setRequests(prev);
      toast.error("Delete failed");
    }
  }

  async function doDeleteBulk() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const prev = requests;
    setRequests((rows) => rows.filter((row) => !selectedIds.has(row.id)));

    try {
      await bulkDeleteRequests({ data: { password, ids } });
      toast.success(`Deleted ${ids.length}`);
      setSelectedIds(new Set());
    } catch {
      setRequests(prev);
      toast.error("Bulk delete failed");
    }
  }

  async function doDeleteTimelineEntry(requestId: string, entryId: string) {
    try {
      await deleteRequestTimelineEntry({ data: { password, requestId, entryId } });
      toast.success("Timeline entry deleted");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete timeline entry");
    }
  }

  const counts = useMemo(() => {
    const next: Record<string, number> = { all: requests.length };
    for (const request of requests) next[request.status] = (next[request.status] ?? 0) + 1;
    return next;
  }, [requests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = requests.filter((request) => {
      if (filter !== "all" && request.status !== filter) return false;
      if (!q) return true;

      return (
        request.name.toLowerCase().includes(q) ||
        request.email.toLowerCase().includes(q) ||
        request.reference_code.toLowerCase().includes(q) ||
        (request.company ?? "").toLowerCase().includes(q) ||
        request.selected_services.some((service) => service.toLowerCase().includes(q)) ||
        (request.use_case ?? "").toLowerCase().includes(q) ||
        (request.message ?? "").toLowerCase().includes(q) ||
        request.history.some(
          (entry) =>
            entry.status.toLowerCase().includes(q) || (entry.note ?? "").toLowerCase().includes(q),
        )
      );
    });

    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);

      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();

      return sort === "newest" ? timeB - timeA : timeA - timeB;
    });

    return list;
  }, [requests, filter, query, sort]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((request) => selectedIds.has(request.id));

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const request of filtered) next.delete(request.id);
      } else {
        for (const request of filtered) next.add(request.id);
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Requests</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {requests.length} total · {counts.pending ?? 0} pending
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setRealtime((prev) => !prev)}
            className={`rounded-full border-2 border-foreground shadow-brutal-sm text-xs font-black transition-all ${
              realtime
                ? "bg-brand-lime text-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className={`flex h-2 w-2 rounded-full mr-1.5 ${
                realtime ? "bg-foreground animate-ping" : "bg-muted-foreground"
              }`}
            />
            {realtime ? "Live Sync (4s)" : "Paused"}
          </Button>
          <Button
            variant="outline"
            onClick={() => load()}
            disabled={loading}
            className="rounded-full border-2 border-foreground bg-card shadow-brutal-sm"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadCsv(filtered)}
            disabled={filtered.length === 0}
            className="rounded-full border-2 border-foreground bg-card shadow-brutal-sm"
          >
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {STAT_CARDS.map(({ key, label, bg, Icon }) => {
          const active = filter === key;
          const count = counts[key] ?? 0;

          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`group rounded-2xl border-2 border-foreground p-3 text-left shadow-brutal-sm transition-all sm:p-4 ${bg} ${
                active ? "-translate-y-1 shadow-brutal" : "hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase opacity-80 sm:text-xs">
                  {label}
                </span>
                <Icon className="h-4 w-4 opacity-80" />
              </div>
              <div className="mt-1 text-2xl font-bold sm:text-3xl">{count}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            className="h-11 rounded-full border-2 border-foreground bg-card pl-10 shadow-brutal-sm focus-visible:ring-0"
          />
        </div>

        <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
          <SelectTrigger className="w-full rounded-full border-2 border-foreground bg-card font-bold shadow-brutal-sm sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 border-foreground">
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-foreground bg-card p-2 shadow-brutal-sm">
          <button
            type="button"
            onClick={toggleSelectAllVisible}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold hover:bg-muted"
          >
            {allVisibleSelected ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <SquareIcon className="h-4 w-4" />
            )}
            {allVisibleSelected ? "Unselect all" : "Select all"}
          </button>
          <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              onValueChange={(value) => bulkStatus(value as Status)}
              value=""
              disabled={selectedIds.size === 0}
            >
              <SelectTrigger className="w-44 rounded-full border-2 border-foreground bg-card font-bold shadow-brutal-sm disabled:opacity-50">
                <SelectValue placeholder="Set status..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-2 border-foreground">
                {STATUS_LIST.map((status) => (
                  <SelectItem key={status} value={status}>
                    Mark as {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              disabled={selectedIds.size === 0}
              onClick={() => setConfirm({ kind: "delete-bulk", count: selectedIds.size })}
              className="rounded-full border-2 border-foreground bg-destructive text-destructive-foreground font-bold shadow-brutal-sm disabled:opacity-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-foreground bg-card p-10 text-center sm:p-16">
          <p className="text-base font-bold sm:text-lg">
            No requests {filter !== "all" ? `with status "${filter}"` : query ? "match" : "yet"}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((request) => {
            const isSelected = selectedIds.has(request.id);
            const isExpanded = expanded.has(request.id);
            const activeTimelineDraft =
              timelineDraft?.requestId === request.id ? timelineDraft : null;
            const customEntries = Object.entries(request.custom_fields ?? {}).filter(
              ([, value]) => value !== null && value !== "" && value !== undefined,
            );
            const hasDetails =
              !!request.use_case ||
              !!request.message ||
              request.history.length > 0 ||
              customEntries.length > 0;

            return (
              <article
                key={request.id}
                className={`rounded-2xl border-2 border-foreground bg-card p-4 shadow-brutal sm:p-6 ${
                  isSelected ? "ring-4 ring-foreground/10" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleSelect(request.id)}
                    className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-foreground shadow-brutal-sm ${
                      isSelected ? "bg-foreground text-background" : "bg-background"
                    }`}
                  >
                    {isSelected && <CheckSquare className="h-4 w-4" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold sm:text-xl">{request.name}</h3>
                      <span
                        className={`rounded-full border-2 border-foreground px-2.5 py-0.5 text-[10px] font-bold uppercase sm:text-xs ${STATUS_STYLES[request.status]}`}
                      >
                        {request.status}
                      </span>
                      {request.ai_score !== null && request.ai_score !== undefined && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border-2 border-foreground px-2.5 py-0.5 text-[10px] font-bold uppercase sm:text-xs ${
                            request.ai_score >= 80
                              ? "bg-brand-lime text-foreground"
                              : request.ai_score >= 50
                                ? "bg-brand-yellow text-foreground"
                                : "bg-destructive text-destructive-foreground"
                          }`}
                        >
                          <Sparkles className="h-3 w-3" />
                          AI {request.ai_score}/100 ({request.ai_recommendation || "scored"})
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
                      <span className="rounded-full border border-foreground/25 bg-background px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
                        {request.reference_code}
                      </span>
                      <a
                        href={`mailto:${request.email}`}
                        className="inline-flex items-center gap-1 break-all hover:text-foreground"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" /> {request.email}
                      </a>
                      {request.company && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" /> {request.company}
                        </span>
                      )}
                      <span title={new Date(request.created_at).toLocaleString()}>
                        {formatRelative(request.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Select
                    value={request.status}
                    onValueChange={(value) => changeStatus(request.id, value as Status)}
                  >
                    <SelectTrigger className="h-10 w-full rounded-full border-2 border-foreground bg-card font-bold shadow-brutal-sm sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-2 border-foreground">
                      {STATUS_LIST.map((status) => (
                        <SelectItem key={status} value={status} className="capitalize">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void sendManualUpdateEmail(request)}
                    disabled={sendingEmailId === request.id || request.status === "pending"}
                    title={
                      request.status === "pending"
                        ? "Pending requests do not have an update email yet"
                        : "Resend the latest status email with the newest timeline note"
                    }
                    className="rounded-full border-2 border-foreground bg-card font-bold shadow-brutal-sm disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">
                      {sendingEmailId === request.id ? "Sending..." : "Send update email"}
                    </span>
                  </Button>

                  {hasDetails && (
                    <Button
                      variant="outline"
                      onClick={() => toggleExpand(request.id)}
                      className="rounded-full border-2 border-foreground bg-card font-bold shadow-brutal-sm"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="mr-1 h-4 w-4" /> Hide
                        </>
                      ) : (
                        <>
                          <ChevronDown className="mr-1 h-4 w-4" /> Details
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={() =>
                      setConfirm({ kind: "delete-one", id: request.id, name: request.name })
                    }
                    className="ml-auto rounded-full border-2 border-foreground bg-destructive text-destructive-foreground font-bold shadow-brutal-sm"
                  >
                    <Trash2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>

                {request.selected_services.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {request.selected_services.map((service) => (
                      <span
                        key={service}
                        className={`rounded-full border-2 border-foreground px-2.5 py-0.5 text-[10px] font-bold sm:text-xs ${serviceBg(service)}`}
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                )}

                {hasDetails && isExpanded && (
                  <>
                    {/* AI Intelligence Card */}
                    <div className="mt-4 rounded-2xl border-2 border-foreground bg-brand-violet/10 p-3.5 sm:p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                          <Sparkles className="h-4 w-4 text-brand-violet" />
                          AI Triage & Intelligence
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={analyzingIds.has(request.id)}
                          onClick={() => handleRunAiTriage(request.id)}
                          className="h-8 rounded-full border-2 border-foreground bg-card text-xs font-bold shadow-brutal-sm hover:bg-muted"
                        >
                          <RefreshCw
                            className={`mr-1.5 h-3 w-3 ${
                              analyzingIds.has(request.id) ? "animate-spin" : ""
                            }`}
                          />
                          {request.ai_analysis ? "Re-evaluate AI" : "Run AI Triage"}
                        </Button>
                      </div>

                      {request.ai_analysis ? (
                        <div className="mt-3 space-y-2.5 text-sm">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground">
                              RECOMMENDATION:
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
                                request.ai_analysis.recommendation === "approve"
                                  ? "bg-brand-lime text-foreground"
                                  : request.ai_analysis.recommendation === "review"
                                    ? "bg-brand-yellow text-foreground"
                                    : "bg-destructive text-destructive-foreground"
                              }`}
                            >
                              {request.ai_analysis.recommendation}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Risk:{" "}
                              <strong className="text-foreground uppercase">
                                {request.ai_analysis.riskLevel}
                              </strong>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Confidence:{" "}
                              <strong className="text-foreground">
                                {request.ai_analysis.confidence}%
                              </strong>
                            </span>
                          </div>
                          <div className="rounded-xl border border-foreground/20 bg-card p-3 text-xs font-medium text-foreground shadow-brutal-sm">
                            <span className="font-bold">AI Rationale:</span>{" "}
                            {request.ai_analysis.reason}
                          </div>
                          {request.ai_analysis.summary && (
                            <p className="text-xs text-muted-foreground">
                              <strong className="text-foreground">Summary:</strong>{" "}
                              {request.ai_analysis.summary}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No AI score generated yet. Click "Run AI Triage" to analyze this request
                          with Gemini.
                        </p>
                      )}
                    </div>

                    {(request.use_case || request.message) && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {request.use_case && (
                          <div className="rounded-2xl border-2 border-foreground bg-muted p-3 sm:p-4">
                            <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground sm:text-xs">
                              <FileText className="h-3.5 w-3.5" /> Use case
                            </div>
                            <p className="whitespace-pre-wrap break-words text-sm">
                              {request.use_case}
                            </p>
                          </div>
                        )}

                        {request.message && (
                          <div className="rounded-2xl border-2 border-foreground bg-muted p-3 sm:p-4">
                            <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground sm:text-xs">
                              <MessageSquare className="h-3.5 w-3.5" /> Message
                            </div>
                            <p className="whitespace-pre-wrap break-words text-sm">
                              {request.message}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {customEntries.length > 0 && (
                      <div className="mt-4 rounded-2xl border-2 border-foreground bg-muted p-3 sm:p-4">
                        <div className="mb-2 text-[10px] font-bold uppercase text-muted-foreground sm:text-xs">
                          Custom fields
                        </div>
                        <dl className="grid gap-1.5 text-sm sm:grid-cols-2">
                          {customEntries.map(([key, value]) => (
                            <div key={key}>
                              <dt className="text-xs font-bold text-muted-foreground">{key}</dt>
                              <dd className="break-words">{String(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}

                    {request.history.length > 0 && (
                      <div className="mt-4 rounded-2xl border-2 border-foreground bg-muted p-3 sm:p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground sm:text-xs">
                            <Clock className="h-3.5 w-3.5" /> Status timeline
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => startCreateTimeline(request)}
                            className="rounded-full border-2 border-foreground bg-card text-xs font-bold shadow-brutal-sm"
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add custom entry
                          </Button>
                        </div>

                        {activeTimelineDraft && (
                          <div className="mb-4 rounded-2xl border-2 border-foreground bg-card p-3 shadow-brutal-sm sm:p-4">
                            <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                              {activeTimelineDraft.mode === "create"
                                ? "Add timeline entry"
                                : "Edit timeline entry"}
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-muted-foreground">
                                  Status
                                </label>
                                <Select
                                  value={activeTimelineDraft.status}
                                  onValueChange={(value) =>
                                    setTimelineDraft((prev) =>
                                      prev && prev.requestId === request.id
                                        ? { ...prev, status: value as Status }
                                        : prev,
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-10 rounded-xl border-2 border-foreground bg-background font-bold shadow-brutal-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-2 border-foreground">
                                    {STATUS_LIST.map((status) => (
                                      <SelectItem
                                        key={status}
                                        value={status}
                                        className="capitalize"
                                      >
                                        {status}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-muted-foreground">
                                  Changed at
                                </label>
                                <Input
                                  type="datetime-local"
                                  value={activeTimelineDraft.changedAt}
                                  onChange={(event) =>
                                    setTimelineDraft((prev) =>
                                      prev && prev.requestId === request.id
                                        ? { ...prev, changedAt: event.target.value }
                                        : prev,
                                    )
                                  }
                                  className="h-10 rounded-xl border-2 border-foreground bg-background shadow-brutal-sm focus-visible:ring-0"
                                />
                              </div>
                            </div>

                            <div className="mt-3 space-y-2">
                              <label className="text-xs font-bold uppercase text-muted-foreground">
                                Note
                              </label>
                              <Textarea
                                rows={3}
                                maxLength={2000}
                                value={activeTimelineDraft.note}
                                onChange={(event) =>
                                  setTimelineDraft((prev) =>
                                    prev && prev.requestId === request.id
                                      ? { ...prev, note: event.target.value }
                                      : prev,
                                  )
                                }
                                placeholder="Add a manual note for this status update..."
                                className="resize-none rounded-xl border-2 border-foreground bg-background shadow-brutal-sm focus-visible:ring-0"
                              />
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                onClick={() => void saveTimelineDraft()}
                                disabled={timelineSaving}
                                className="rounded-full border-2 border-foreground bg-foreground text-background shadow-brutal-sm"
                              >
                                {timelineSaving ? "Saving..." : "Save entry"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setTimelineDraft(null)}
                                className="rounded-full border-2 border-foreground bg-card shadow-brutal-sm"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        <ol className="relative space-y-3 pl-5">
                          <span
                            aria-hidden
                            className="absolute left-1.5 top-1.5 bottom-1.5 w-0.5 bg-foreground/20"
                          />
                          {request.history.map((entry) => (
                            <li key={entry.id} className="relative">
                              <span
                                className={`absolute -left-5 top-1.5 h-3 w-3 rounded-full border-2 border-foreground ${STATUS_DOT[entry.status]}`}
                              />
                              <div className="rounded-2xl border-2 border-foreground bg-card p-3 shadow-brutal-sm">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                      <span className="text-sm font-bold capitalize">
                                        {entry.status}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(entry.changed_at).toLocaleString()} ·{" "}
                                        {formatRelative(entry.changed_at)}
                                      </span>
                                    </div>
                                    {entry.note && (
                                      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground/85">
                                        {entry.note}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => startEditTimeline(request.id, entry)}
                                      className="rounded-full border-2 border-foreground bg-card text-xs font-bold shadow-brutal-sm"
                                    >
                                      <PencilLine className="mr-1 h-3.5 w-3.5" />
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() =>
                                        setConfirm({
                                          kind: "delete-timeline",
                                          requestId: request.id,
                                          entryId: entry.id,
                                          status: entry.status,
                                        })
                                      }
                                      className="rounded-full border-2 border-foreground bg-destructive text-destructive-foreground text-xs font-bold shadow-brutal-sm"
                                    >
                                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                                      Delete
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent className="rounded-2xl border-2 border-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "delete-bulk"
                ? `Delete ${confirm.count} request${confirm.count > 1 ? "s" : ""}?`
                : confirm?.kind === "delete-one"
                  ? `Delete request from ${confirm.name}?`
                  : confirm?.kind === "delete-timeline"
                    ? `Delete ${confirm.status} timeline entry?`
                    : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete-timeline"
                ? "This removes the selected timeline entry. If it is the latest entry, the current request status will update to match the new latest timeline item."
                : "This permanently removes the request and its full status history."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full border-2 border-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;

                if (confirm.kind === "delete-one") void doDeleteOne(confirm.id);
                if (confirm.kind === "delete-bulk") void doDeleteBulk();
                if (confirm.kind === "delete-timeline") {
                  void doDeleteTimelineEntry(confirm.requestId, confirm.entryId);
                }

                setConfirm(null);
              }}
              className="rounded-full border-2 border-foreground bg-destructive text-destructive-foreground font-bold"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

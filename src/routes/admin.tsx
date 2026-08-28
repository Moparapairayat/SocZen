import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Inbox, Package, ListChecks, KeyRound, Users, ShieldCheck } from "lucide-react";
import { verifyAdminPassword } from "@/utils/admin.functions";
import { RequestsAdmin } from "@/components/admin/RequestsAdmin";
import { ServicesAdmin } from "@/components/admin/ServicesAdmin";
import { FieldsAdmin } from "@/components/admin/FieldsAdmin";
import { GrantsAdmin } from "@/components/admin/GrantsAdmin";
import { UsersAdmin } from "@/components/admin/UsersAdmin";
import { SecurityAdmin } from "@/components/admin/SecurityAdmin";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — SocZen" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPage,
});

const STORAGE_KEY = "soczen_admin_pw";

function AdminPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("requests");

  useEffect(() => {
    const cached = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (cached) void tryLogin(cached, true);
  }, []);

  async function tryLogin(pw: string, silent = false) {
    setLoading(true);
    try {
      await verifyAdminPassword({ data: { password: pw } });
      setPassword(pw);
      setAuthed(true);
      sessionStorage.setItem(STORAGE_KEY, pw);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      if (!silent) toast.error("Wrong password");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setPassword("");
    setAuthed(false);
  }

  function handlePasswordChanged(nextPassword: string) {
    setPassword(nextPassword);
    sessionStorage.setItem(STORAGE_KEY, nextPassword);
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <Toaster richColors position="top-center" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void tryLogin(password);
          }}
          className="w-full max-w-md rounded-3xl border-2 border-foreground bg-card p-6 shadow-brutal-lg sm:p-8"
        >
          <div className="mb-6 space-y-4">
            <BrandLogo size="md" showTagline />
            <div>
              <h1 className="text-2xl font-bold">Admin access</h1>
              <p className="text-sm text-muted-foreground">SocZen control panel</p>
            </div>
          </div>
          <Label htmlFor="pw" className="font-bold">
            Password
          </Label>
          <Input
            id="pw"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 rounded-xl border-2 border-foreground bg-background h-12 shadow-brutal-sm focus-visible:ring-0"
            placeholder="••••••••"
          />
          <Button
            type="submit"
            disabled={loading || !password}
            className="mt-6 w-full rounded-full border-2 border-foreground bg-gradient-cta text-white py-6 font-bold shadow-brutal hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all disabled:opacity-60"
          >
            {loading ? "Checking…" : "Sign in"}
          </Button>
          <button
            type="button"
            onClick={() => router.navigate({ to: "/" })}
            className="mt-4 block w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to site
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-3 py-6 sm:px-6 sm:py-10">
      <Toaster richColors position="top-center" />
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 overflow-hidden rounded-[2rem] border-2 border-foreground bg-card/85 px-4 py-4 shadow-brutal-sm backdrop-blur-xl sm:mb-8 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <BrandLogo size="sm" />
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-muted-foreground">
                  SocZen Ops
                </p>
                <h1 className="text-2xl font-bold sm:text-3xl">Admin panel</h1>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Full control of products, form, grants & users.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
              <div className="inline-flex items-center rounded-[1.35rem] border-2 border-foreground bg-background px-3 py-2 shadow-brutal-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                    Powered by
                  </p>
                  <p className="font-display text-base font-bold tracking-[-0.08em] sm:text-lg">
                    <span className="text-foreground/80">Mopara Pair</span>{" "}
                    <span className="text-gradient-hero">Ayat</span>
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={logout}
                className="rounded-full border-2 border-foreground bg-card shadow-brutal-sm hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none transition-all"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </div>
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border-2 border-foreground bg-card p-1 shadow-brutal-sm sm:grid-cols-6">
            <TabsTrigger
              value="requests"
              className="rounded-xl py-2.5 font-bold data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              <Inbox className="mr-1 h-4 w-4" /> Requests
            </TabsTrigger>
            <TabsTrigger
              value="services"
              className="rounded-xl py-2.5 font-bold data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              <Package className="mr-1 h-4 w-4" /> Products
            </TabsTrigger>
            <TabsTrigger
              value="fields"
              className="rounded-xl py-2.5 font-bold data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              <ListChecks className="mr-1 h-4 w-4" /> Form
            </TabsTrigger>
            <TabsTrigger
              value="grants"
              className="rounded-xl py-2.5 font-bold data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              <KeyRound className="mr-1 h-4 w-4" /> Grants
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="rounded-xl py-2.5 font-bold data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              <Users className="mr-1 h-4 w-4" /> Users
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="rounded-xl py-2.5 font-bold data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              <ShieldCheck className="mr-1 h-4 w-4" /> Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-0">
            <RequestsAdmin password={password} />
          </TabsContent>
          <TabsContent value="services" className="mt-0">
            <ServicesAdmin password={password} />
          </TabsContent>
          <TabsContent value="fields" className="mt-0">
            <FieldsAdmin password={password} />
          </TabsContent>
          <TabsContent value="grants" className="mt-0">
            <GrantsAdmin password={password} />
          </TabsContent>
          <TabsContent value="users" className="mt-0">
            <UsersAdmin password={password} />
          </TabsContent>
          <TabsContent value="security" className="mt-0">
            <SecurityAdmin password={password} onPasswordChanged={handlePasswordChanged} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

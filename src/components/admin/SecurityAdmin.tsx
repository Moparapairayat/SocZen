import { useState } from "react";
import { ShieldCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeAdminPassword } from "@/utils/admin.functions";

type Props = {
  password: string;
  onPasswordChanged: (nextPassword: string) => void;
};

export function SecurityAdmin({ password, onPasswordChanged }: Props) {
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (nextPassword.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }

    if (nextPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      await changeAdminPassword({
        data: {
          password,
          nextPassword,
        },
      });
      onPasswordChanged(nextPassword);
      setNextPassword("");
      setConfirmPassword("");
      toast.success("Admin password updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border-2 border-foreground bg-card p-5 shadow-brutal sm:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-foreground bg-brand-yellow shadow-brutal-sm">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold sm:text-2xl">Security</h2>
          <p className="text-sm text-muted-foreground">
            Change the admin password without editing the environment file again.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
        <div className="rounded-2xl border-2 border-foreground bg-background p-4 shadow-brutal-sm">
          <p className="text-sm font-semibold">How it works</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your new password is stored securely in PostgreSQL. After the first change, the panel
            uses the stored password instead of the bootstrap `.env` value.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="next-password" className="font-bold">
            New password
          </Label>
          <Input
            id="next-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
            className="h-12 rounded-xl border-2 border-foreground bg-background shadow-brutal-sm focus-visible:ring-0"
            placeholder="At least 8 characters"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="font-bold">
            Confirm new password
          </Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-12 rounded-xl border-2 border-foreground bg-background shadow-brutal-sm focus-visible:ring-0"
            placeholder="Re-enter the new password"
          />
        </div>

        <Button
          type="submit"
          disabled={saving || !nextPassword || !confirmPassword}
          className="rounded-full border-2 border-foreground bg-gradient-cta text-white shadow-brutal-sm hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none transition-all disabled:opacity-60"
        >
          <KeyRound className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Update password"}
        </Button>
      </form>
    </section>
  );
}

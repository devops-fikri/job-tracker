import { Briefcase } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-accent text-accent-ink">
            <Briefcase className="size-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold">Job Tracker</h1>
          <p className="mt-1 text-sm text-ink-2">Sign in to your private career CRM</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

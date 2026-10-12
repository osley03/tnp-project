import { createFileRoute, Link } from "@tanstack/react-router";
import authBg from "@/assets/auth-bg.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TNP — Verified rentals & mutual trust profiles in Zimbabwe" },
      {
        name: "description",
        content:
          "TNP is a mutual trust network for renting: tenants search verified properties and landlord histories, landlords vet applicants, admins verify everything. Sign up to get your role-based dashboard.",
      },
      { property: "og:title", content: "TNP — Tenant Network Profile" },
      {
        property: "og:description",
        content:
          "Verified listings, landlord and tenant trust profiles, tamper-evident property history and escrow-backed deposits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink text-[13px] text-fg">
      {/* Full-screen cinematic 3D housing background */}
      <img
        src={authBg}
        alt="Modern residential estate at dusk with warm glowing windows"
        width={1536}
        height={1024}
        className="pointer-events-none absolute inset-0 size-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-ink/45" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/60 via-transparent to-ink/75" />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Brand */}
        <div className="mb-6 flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-terra/20 ring-1 ring-terra/40 backdrop-blur">
            <span className="font-display text-sm font-bold text-terra">T</span>
          </div>
          <div>
            <h1 className="font-display text-[13px] leading-none font-semibold tracking-tight">
              TNP · Tenant Network Profile
            </h1>
            <p className="mt-1 font-mono text-[9px] tracking-wider text-fg/60">
              MUTUAL TRUST LEDGER · HARARE
            </p>
          </div>
        </div>

        {/* Hero glass card */}
        <section className="w-full max-w-[420px] rounded-3xl bg-ink/55 p-7 text-center shadow-2xl ring-1 ring-fg/10 backdrop-blur-xl">
          <p className="font-mono text-[9px] tracking-[0.2em] text-terra">RENT WITHOUT GUESSWORK</p>
          <p className="mt-3 font-display text-3xl leading-tight font-bold tracking-tight">
            One ledger.
            <br />
            Every side verified.
          </p>
          <p className="mx-auto mt-3 max-w-[34ch] text-[11px] leading-relaxed text-fg/60">
            Create your account, pick your role, and get a dashboard built only for what you need to
            decide.
          </p>
          <Link
            to="/auth"
            className="mt-5 inline-block rounded-xl bg-terra px-6 py-3 font-display text-[13px] font-semibold text-ink transition-opacity hover:opacity-90"
          >
            Get started — sign up
          </Link>
          <p className="mt-3 text-[11px] text-fg/50">
            Already have an account?{" "}
            <Link to="/auth" className="font-semibold text-terra hover:underline">
              Sign in
            </Link>
          </p>
        </section>

        {/* Roles — slim single-line rows */}
        <div className="mt-4 w-full max-w-[420px] space-y-2">
          <Role
            title="Tenants"
            body="Search verified properties, landlord trust scores & lease-confirmed reviews."
          />
          <Role
            title="Landlords"
            body="Publish listings and open each applicant's verified profile before approving."
          />
          <Role
            title="Admins"
            body="Verify listings and identities, adjust trust scores, oversee lease activity."
          />
        </div>

        {/* Secondary links */}
        <div className="mt-4 flex w-full max-w-[420px] gap-2">
          <Link
            to="/report"
            className="flex-1 rounded-xl bg-ink/55 px-3 py-2.5 text-center ring-1 ring-fg/10 backdrop-blur-xl transition-colors hover:ring-clay/40"
          >
            <p className="font-mono text-[9px] tracking-wide text-clay">REPORT A SCAM</p>
            <p className="mt-0.5 text-[10px] text-fg/50">Anyone · no account needed</p>
          </Link>
          <Link
            to="/architecture"
            className="flex-1 rounded-xl bg-ink/55 px-3 py-2.5 text-center ring-1 ring-fg/10 backdrop-blur-xl transition-colors hover:ring-terra/40"
          >
            <p className="font-mono text-[9px] tracking-wide text-terra">ARCHITECTURE</p>
            <p className="mt-0.5 text-[10px] text-fg/50">Modules · layers · integrations</p>
          </Link>
        </div>
      </div>
    </main>
  );
}

function Role({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex items-baseline gap-3 rounded-2xl bg-ink/55 px-4 py-3 ring-1 ring-fg/10 backdrop-blur-xl">
      <h2 className="shrink-0 font-display text-[12px] font-semibold text-terra">{title}</h2>
      <p className="text-[11px] leading-snug text-fg/60">{body}</p>
    </section>
  );
}

import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppBar, Page, Card, Stat, TrustMeter, Empty } from "@/components/tnp/AppShell";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/app/applicant/$id")({
  head: () => ({
    meta: [
      { title: "Applicant trust profile — Landlord vetting | TNP" },
      {
        name: "description",
        content:
          "Review an applicant's verified identity, trust score, rental references and lease request before approving or declining.",
      },
      { property: "og:title", content: "Applicant trust profile — TNP" },
      {
        property: "og:description",
        content: "Verified applicant history before you approve a lease.",
      },
    ],
  }),
  component: Applicant,
});

function Applicant() {
  const { id } = useParams({ from: "/_authenticated/app/applicant/$id" });
  const { role, fullName } = useSession();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["applicant", id],
    queryFn: async () => {
      const { data: rq, error } = await supabase
        .from("lease_requests")
        .select("*, properties(title, suburb, rent_usd, deposit_usd)")
        .eq("id", id)
        .single();
      if (error) throw error;
      const [profile, refs] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", rq.tenant_id).maybeSingle(),
        supabase
          .from("reviews")
          .select("*")
          .eq("subject_id", rq.tenant_id)
          .order("created_at", { ascending: false }),
      ]);
      return { rq, profile: profile.data, refs: refs.data ?? [] };
    },
  });

  async function decide(status: string) {
    await supabase.from("lease_requests").update({ status }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["applicant", id] });
    void qc.invalidateQueries({ queryKey: ["incoming-requests"] });
  }

  if (!data) {
    return (
      <Page>
        <AppBar role={role ?? "landlord"} who={fullName} />
        <Empty text="Loading applicant…" />
      </Page>
    );
  }

  const { rq, profile, refs } = data;
  const prop = rq.properties as {
    title: string;
    suburb: string;
    rent_usd: number;
    deposit_usd: number;
  } | null;

  return (
    <Page>
      <AppBar
        role={role ?? "landlord"}
        who={fullName}
        back={{ to: "/app/landlord", label: "Back to requests" }}
      />

      <div className="space-y-3">
        <Card
          title={profile?.full_name ?? "Applicant"}
          meta={profile?.verification ?? "unverified"}
        >
          <TrustMeter score={profile?.trust_score ?? 50} label="tenant trust" />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat k="REFERENCES" v={String(refs.length)} />
            <Stat k="STATUS" v={rq.status} tone="text-ochre" />
            <Stat k="MOVE-IN" v={rq.move_in ? new Date(rq.move_in).toLocaleDateString() : "—"} />
          </div>
          {profile?.bio && <p className="mt-2 text-[11px] text-mut">{profile.bio}</p>}
          {profile?.phone && <p className="mt-1 font-mono text-[9px] text-mut">{profile.phone}</p>}
        </Card>

        <Card title="Lease request" meta={prop?.suburb ?? ""}>
          <div className="grid grid-cols-2 gap-2">
            <Stat k="PROPERTY" v={prop?.title ?? "—"} />
            <Stat k="RENT" v={prop ? `$${prop.rent_usd}/mo` : "—"} />
          </div>
          {rq.message && <p className="mt-2 text-[11px] text-mut">“{rq.message}”</p>}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => decide("Approved · escrow funded")}
              className="rounded-xl bg-terra px-3 py-2 font-display text-[12px] font-semibold text-ink"
            >
              Approve & e-sign
            </button>
            <button
              type="button"
              onClick={() => decide("Declined")}
              className="rounded-xl bg-panel-2 px-3 py-2 font-display text-[12px] font-semibold text-clay ring-1 ring-line"
            >
              Decline
            </button>
          </div>
          <p className="mt-2 font-mono text-[9px] text-mut">
            Deposit of ${prop?.deposit_usd ?? 0} is held in escrow until move-in is confirmed.
          </p>
        </Card>

        <Card title="Verified references" meta="lease-confirmed">
          {refs.length === 0 ? (
            <Empty text="No references recorded for this applicant yet." />
          ) : (
            <ul className="space-y-2">
              {refs.map((r) => (
                <li key={r.id} className="rounded-lg bg-panel-2 px-2.5 py-2 ring-1 ring-line">
                  <span className="font-mono text-[9px] text-terra">
                    {"★".repeat(r.rating)}
                    {"☆".repeat(Math.max(0, 5 - r.rating))}
                  </span>
                  <p className="mt-1 text-[11px]">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}

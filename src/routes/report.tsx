import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, TopBar, Card } from "@/components/tnp/Shell";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report a scam or request assistance | TNP" },
      {
        name: "description",
        content:
          "Report a rental scam or request property assistance on TNP. Submit evidence, receive a case reference number and track the investigation to resolution.",
      },
      { property: "og:title", content: "Report a scam — TNP" },
      {
        property: "og:description",
        content: "Submit a scam report with evidence and track your case reference to resolution.",
      },
    ],
  }),
  component: ReportPage,
});

const kinds = ["Fake listing", "Deposit theft", "Land/property assistance", "Impersonation"];

function ReportPage() {
  const [kind, setKind] = useState(kinds[0]!);
  const [details, setDetails] = useState("");
  const [ref, setRef] = useState<string | null>(null);

  return (
    <Page>
      <TopBar role="TENANT" who="Report a scam" back={{ to: "/tenant", label: "Tenant home" }} />

      <div className="space-y-3">
        {ref ? (
          <Card index="a" title="Report submitted" meta="keep this reference">
            <p className="font-display text-xl font-bold tracking-tight text-terra">{ref}</p>
            <p className="mt-1 text-[11px] text-mut">
              Status: SUBMITTED. The investigation team reviews new reports within 48 hours. You can
              check status here or by dialling *310# and entering this reference.
            </p>
          </Card>
        ) : (
          <Card index="a" title="Report a scam / request assistance" meta="anyone can report">
            <div className="flex flex-wrap gap-1.5">
              {kinds.map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded px-2 py-1 font-mono text-[9px] ring-1 ${
                    k === kind
                      ? "bg-clay/15 text-clay ring-clay/30"
                      : "bg-panel-2 text-mut ring-line"
                  }`}
                >
                  {k.toUpperCase()}
                </button>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={5}
              placeholder="What happened? Include amounts, dates, phone numbers and listing links."
              className="mt-2.5 w-full rounded-lg bg-panel-2 p-2.5 text-[11px] text-fg ring-1 ring-line outline-none placeholder:text-mut focus:ring-clay/40"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[9px] text-mut">
                EVIDENCE · receipts, screenshots
              </span>
              <button
                onClick={() =>
                  setRef(
                    `TNP-SC-2026-${String(Math.floor(Math.random() * 9000) + 1000).slice(0, 4)}`,
                  )
                }
                disabled={details.trim().length < 10}
                className="rounded-lg bg-clay px-3 py-2 font-display text-[11px] font-semibold text-ink ring-1 ring-clay disabled:opacity-40"
              >
                Submit report
              </button>
            </div>
          </Card>
        )}

        <Card index="b" title="How your case moves" meta="module 7">
          <div className="space-y-1.5">
            {[
              "Submitted — reference issued",
              "Under Investigation — evidence verified",
              "Action Required — accused party engaged",
              "In Progress — recovery / settlement",
              "Resolved → Closed — outcome recorded",
            ].map((s) => (
              <p key={s} className="font-mono text-[9px] text-mut">
                → {s}
              </p>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-mut">
            Sensitive case detail is visible to TNP administrators and the investigation team only.
          </p>
        </Card>
      </div>
    </Page>
  );
}

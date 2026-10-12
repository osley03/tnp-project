import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  FileText,
  Info,
  LockKeyhole,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
  AlertTriangle,
  Building2,
  UserRound,
  Receipt,
  Landmark,
  CircleDollarSign,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/tenant/payments")({
  component: TenantPayments,
});

type Lease = {
  id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  status: string;
  rent_usd: number | string;
  deposit_usd: number | string;
  start_date: string | null;
  end_date: string | null;
  signed_at: string | null;
  payment_frequency: string;
  payment_due_day: number;
  escrow_status: string;
  renewal_status: string;
  created_at: string;
};

type LeasePayment = {
  id: string;
  lease_id: string;
  payer_id: string;
  payee_id: string | null;
  payment_type: string;
  amount_usd: number | string;
  status: string;
  reference: string | null;
  paid_at: string | null;
  released_at: string | null;
  created_at: string;
  idempotency_key?: string | null;
};

type EscrowTransaction = {
  id: string;
  payment_id: string | null;
  lease_id: string;
  transaction_type: string;
  amount_usd: number | string;
  status: string;
  reference: string | null;
  actor_id: string | null;
  actor_type: string;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
};

type PaymentAudit = {
  id: string;
  payment_id: string;
  lease_id: string;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  amount_usd: number | string | null;
  actor_id: string | null;
  actor_type: string;
  reference: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type PropertyRecord = Record<string, unknown> & {
  id: string;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
  phone?: string | null;
  trust_score?: number | null;
  verification?: string | null;
};

type PaymentDetails = {
  payment: LeasePayment;
  lease: Lease | undefined;
  property: PropertyRecord | undefined;
  landlord: ProfileRecord | undefined;
  escrow: EscrowTransaction[];
  audit: PaymentAudit[];
};

type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function shortDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function titleCase(value: string | null | undefined) {
  if (!value) return "—";

  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClasses(status: string) {
  const value = status.toLowerCase();

  if (value === "paid" || value === "released" || value === "held" || value === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "pending" || value === "processing") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (value === "failed" || value === "cancelled" || value === "refunded") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function paymentIcon(type: string) {
  switch (type) {
    case "deposit":
      return Landmark;
    case "utility":
      return CreditCard;
    case "late_fee":
      return AlertTriangle;
    default:
      return CircleDollarSign;
  }
}

function propertyName(property?: PropertyRecord) {
  if (!property) return "Property";

  const candidates = [
    property["title"],
    property["name"],
    property["property_name"],
    property["address"],
  ];

  const value = candidates.find((item) => typeof item === "string" && item.trim().length > 0);

  return typeof value === "string" ? value : "TNP Property";
}

function propertyLocation(property?: PropertyRecord) {
  if (!property) return "Property location unavailable";

  const parts = [
    property["city"],
    property["area"],
    property["location"],
    property["address"],
  ].filter((item) => typeof item === "string" && item.trim().length > 0);

  return parts.length ? parts.slice(0, 2).join(" · ") : "Location unavailable";
}

function propertyImage(property?: PropertyRecord) {
  if (!property) return null;

  const candidates = [
    property["cover_image"],
    property["image_url"],
    property["thumbnail_url"],
    property["main_image"],
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  const images = property["images"];

  if (Array.isArray(images)) {
    const first = images.find((item) => typeof item === "string");

    if (typeof first === "string") return first;
  }

  return null;
}

function nextPaymentDate(lease: Lease | undefined) {
  if (!lease) return null;

  const day = Math.min(Math.max(Number(lease.payment_due_day) || 1, 1), 28);

  const now = new Date();

  let year = now.getFullYear();
  let month = now.getMonth();

  let candidate = new Date(year, month, day, 12, 0, 0, 0);

  if (candidate.getTime() < now.getTime()) {
    month += 1;

    if (month > 11) {
      month = 0;
      year += 1;
    }

    candidate = new Date(year, month, day, 12, 0, 0, 0);
  }

  if (lease.end_date && candidate.getTime() > new Date(`${lease.end_date}T23:59:59`).getTime()) {
    return null;
  }

  return candidate;
}

function isActiveLease(lease: Lease) {
  const status = lease.status.toLowerCase();

  return ["active", "signed", "approved", "ongoing", "current"].includes(status);
}

function TenantPayments() {
  const [userId, setUserId] = useState<string | null>(null);

  const [leases, setLeases] = useState<Lease[]>([]);
  const [payments, setPayments] = useState<LeasePayment[]>([]);
  const [escrowTransactions, setEscrowTransactions] = useState<EscrowTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<PaymentAudit[]>([]);

  const [properties, setProperties] = useState<PropertyRecord[]>([]);

  const [landlords, setLandlords] = useState<ProfileRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedLeaseId, setSelectedLeaseId] = useState<string>("all");

  const [activeTab, setActiveTab] = useState<"overview" | "history" | "escrow">("overview");

  const [selectedPayment, setSelectedPayment] = useState<PaymentDetails | null>(null);

  const [showPaymentPanel, setShowPaymentPanel] = useState(false);

  const [paymentType, setPaymentType] = useState("rent");

  const [paymentAmount, setPaymentAmount] = useState("");

  const [creatingPayment, setCreatingPayment] = useState(false);

  const [notice, setNotice] = useState<Notice | null>(null);

  const [copiedReference, setCopiedReference] = useState(false);

  const showNotice = useCallback((nextNotice: Notice) => {
    setNotice(nextNotice);

    window.setTimeout(() => {
      setNotice((current) => (current?.message === nextNotice.message ? null : current));
    }, 5000);
  }, []);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError) throw userError;

        const user = userData.user;

        if (!user) {
          throw new Error("Your session has expired. Please sign in again.");
        }

        setUserId(user.id);

        const { data: leaseData, error: leaseError } = await supabase
          .from("leases" as never)
          .select("*")
          .eq("tenant_id", user.id)
          .order("created_at", {
            ascending: false,
          });

        if (leaseError) throw leaseError;

        const tenantLeases = (leaseData ?? []) as unknown as Lease[];

        setLeases(tenantLeases);

        const leaseIds = tenantLeases.map((lease) => lease.id);

        if (!leaseIds.length) {
          setPayments([]);
          setEscrowTransactions([]);
          setAuditLogs([]);
          setProperties([]);
          setLandlords([]);
          return;
        }

        const [paymentsResult, escrowResult, auditResult] = await Promise.all([
          supabase
            .from("lease_payments" as never)
            .select("*")
            .in("lease_id", leaseIds)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("escrow_transactions" as never)
            .select("*")
            .in("lease_id", leaseIds)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("payment_audit_logs" as never)
            .select("*")
            .in("lease_id", leaseIds)
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (paymentsResult.error) {
          throw paymentsResult.error;
        }

        if (escrowResult.error) {
          throw escrowResult.error;
        }

        if (auditResult.error) {
          throw auditResult.error;
        }

        const paymentData = (paymentsResult.data ?? []) as unknown as LeasePayment[];

        const escrowData = (escrowResult.data ?? []) as unknown as EscrowTransaction[];

        const auditData = (auditResult.data ?? []) as unknown as PaymentAudit[];

        setPayments(paymentData);
        setEscrowTransactions(escrowData);
        setAuditLogs(auditData);

        const propertyIds = [
          ...new Set(tenantLeases.map((lease) => lease.property_id).filter(Boolean)),
        ];

        const landlordIds = [
          ...new Set(tenantLeases.map((lease) => lease.landlord_id).filter(Boolean)),
        ];

        if (propertyIds.length) {
          const { data: propertyData, error: propertyError } = await supabase
            .from("properties" as never)
            .select("*")
            .in("id", propertyIds);

          if (!propertyError) {
            setProperties((propertyData ?? []) as unknown as PropertyRecord[]);
          }
        }

        if (landlordIds.length) {
          const { data: landlordData, error: landlordError } = await supabase
            .from("profiles" as never)
            .select("id, full_name, phone, trust_score, verification")
            .in("id", landlordIds);

          if (!landlordError) {
            setLandlords((landlordData ?? []) as unknown as ProfileRecord[]);
          }
        }
      } catch (error) {
        console.error("TNP Payments load error:", error);

        showNotice({
          type: "error",
          message:
            error instanceof Error ? error.message : "Unable to load your payment information.",
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showNotice],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const propertyMap = useMemo(() => {
    return new Map(properties.map((property) => [property.id, property]));
  }, [properties]);

  const landlordMap = useMemo(() => {
    return new Map(landlords.map((landlord) => [landlord.id, landlord]));
  }, [landlords]);

  const filteredLeases = useMemo(() => {
    if (selectedLeaseId === "all") return leases;

    return leases.filter((lease) => lease.id === selectedLeaseId);
  }, [leases, selectedLeaseId]);

  const filteredLeaseIds = useMemo(
    () => new Set(filteredLeases.map((lease) => lease.id)),
    [filteredLeases],
  );

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => filteredLeaseIds.has(payment.lease_id));
  }, [payments, filteredLeaseIds]);

  const filteredEscrow = useMemo(() => {
    return escrowTransactions.filter((transaction) => filteredLeaseIds.has(transaction.lease_id));
  }, [escrowTransactions, filteredLeaseIds]);

  const filteredAudit = useMemo(() => {
    return auditLogs.filter((audit) => filteredLeaseIds.has(audit.lease_id));
  }, [auditLogs, filteredLeaseIds]);

  const activeLeases = useMemo(() => leases.filter(isActiveLease), [leases]);

  const totalPaid = useMemo(
    () =>
      filteredPayments
        .filter((payment) => payment.status.toLowerCase() === "paid")
        .reduce((sum, payment) => sum + Number(payment.amount_usd || 0), 0),
    [filteredPayments],
  );

  const totalHeld = useMemo(
    () =>
      filteredEscrow
        .filter(
          (transaction) => transaction.transaction_type === "hold" && transaction.status === "held",
        )
        .reduce((sum, transaction) => sum + Number(transaction.amount_usd || 0), 0),
    [filteredEscrow],
  );

  const totalReleased = useMemo(
    () =>
      filteredEscrow
        .filter(
          (transaction) =>
            transaction.transaction_type === "release" && transaction.status === "released",
        )
        .reduce((sum, transaction) => sum + Number(transaction.amount_usd || 0), 0),
    [filteredEscrow],
  );

  const pendingPayments = useMemo(
    () =>
      filteredPayments.filter((payment) =>
        ["pending", "processing"].includes(payment.status.toLowerCase()),
      ),
    [filteredPayments],
  );

  const currentLease = useMemo(() => {
    if (selectedLeaseId !== "all") {
      return leases.find((lease) => lease.id === selectedLeaseId);
    }

    return activeLeases[0] ?? leases.find(isActiveLease) ?? leases[0];
  }, [activeLeases, leases, selectedLeaseId]);

  const nextPayment = useMemo(() => nextPaymentDate(currentLease), [currentLease]);

  const nextPaymentAmount = currentLease ? Number(currentLease.rent_usd || 0) : 0;

  const outstanding = useMemo(() => {
    const pendingRent = filteredPayments
      .filter(
        (payment) =>
          payment.payment_type === "rent" &&
          ["pending", "processing"].includes(payment.status.toLowerCase()),
      )
      .reduce((sum, payment) => sum + Number(payment.amount_usd || 0), 0);

    return pendingRent;
  }, [filteredPayments]);

  const openPaymentPanel = () => {
    const lease = currentLease ?? activeLeases[0];

    if (!lease) {
      showNotice({
        type: "info",
        message: "You need an active lease before creating a payment request.",
      });
      return;
    }

    setSelectedLeaseId(lease.id);
    setPaymentType("rent");
    setPaymentAmount(Number(lease.rent_usd || 0) > 0 ? String(Number(lease.rent_usd)) : "");
    setShowPaymentPanel(true);
  };

  const createPaymentRequest = async () => {
    const lease = leases.find((item) => item.id === selectedLeaseId) ?? currentLease;

    const amount = Number(paymentAmount);

    if (!lease) {
      showNotice({
        type: "error",
        message: "Select an active lease before creating a payment request.",
      });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showNotice({
        type: "error",
        message: "Enter a valid payment amount greater than zero.",
      });
      return;
    }

    if (!userId) {
      showNotice({
        type: "error",
        message: "Your session could not be verified.",
      });
      return;
    }

    setCreatingPayment(true);

    try {
      const idempotencyKey = [
        "TNP",
        userId.slice(0, 8),
        Date.now(),
        crypto.randomUUID().slice(0, 8),
      ].join("-");

      const { data, error } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{
          data: LeasePayment | null;
          error: unknown;
        }>
      )("create_lease_payment", {
        p_lease_id: lease.id,
        p_payment_type: paymentType,
        p_amount_usd: amount,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("The payment request was not returned by the server.");
      }

      setShowPaymentPanel(false);

      showNotice({
        type: "success",
        message: "Payment request created successfully. It is currently pending processing.",
      });

      await loadData(true);
    } catch (error) {
      console.error("TNP payment creation error:", error);

      showNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to create the payment request.",
      });
    } finally {
      setCreatingPayment(false);
    }
  };

  const openPaymentDetails = (payment: LeasePayment) => {
    const lease = leases.find((item) => item.id === payment.lease_id);

    setSelectedPayment({
      payment,
      lease,
      property: lease ? propertyMap.get(lease.property_id) : undefined,
      landlord: lease ? landlordMap.get(lease.landlord_id) : undefined,
      escrow: escrowTransactions.filter((transaction) => transaction.payment_id === payment.id),
      audit: auditLogs.filter((audit) => audit.payment_id === payment.id),
    });
  };

  const copyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopiedReference(true);

      window.setTimeout(() => setCopiedReference(false), 1800);
    } catch {
      showNotice({
        type: "error",
        message: "Unable to copy the payment reference.",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Loader2 className="size-6 animate-spin text-slate-700" />
            </div>

            <h2 className="text-lg font-bold">Loading Payments & Escrow</h2>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Securely loading your lease-linked financial records from the TNP ledger.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="relative min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                to="/app/tenant"
                className="group flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
                <span className="hidden sm:inline">Tenant Dashboard</span>
                <span className="sm:hidden">Dashboard</span>
              </Link>

              <ChevronRight className="hidden size-4 text-slate-300 sm:block" />

              <div className="min-w-0">
                <p className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:block">
                  Tenant Workspace
                </p>
                <h1 className="truncate text-base font-bold sm:text-lg">Payments & Escrow</h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Refresh financial records"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(15,23,42,0.07),transparent_35%),linear-gradient(135deg,rgba(248,250,252,1),rgba(255,255,255,1))]" />

            <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:p-10">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  <ShieldCheck className="size-3.5" />
                  TNP MUTUAL TRUST LEDGER
                </div>

                <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Your money, linked to your lease.
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
                  Track rent, deposits, payment requests and escrow protection from one secure
                  tenant workspace.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={openPaymentPanel}
                    disabled={!currentLease}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CreditCard className="size-4" />
                    Create Payment Request
                  </button>

                  <Link
                    to="/app/tenant/leases"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    View My Leases
                    <ArrowUpRight className="size-4" />
                  </Link>
                </div>
              </div>

              <div className="flex items-center lg:justify-end">
                <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                      <LockKeyhole className="size-5" />
                    </div>

                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                      Protected
                    </span>
                  </div>

                  <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Escrow protected
                  </p>

                  <p className="mt-1 text-2xl font-black text-slate-950">{money(totalHeld)}</p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Funds currently recorded as held within your lease-linked TNP escrow ledger.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Notice */}
          {notice && (
            <div
              className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 ${
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : notice.type === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-sky-200 bg-sky-50 text-sky-800"
              }`}
            >
              {notice.type === "success" ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              ) : notice.type === "error" ? (
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              ) : (
                <Info className="mt-0.5 size-5 shrink-0" />
              )}

              <p className="text-sm font-semibold">{notice.message}</p>
            </div>
          )}

          {/* Lease selector */}
          {leases.length > 0 && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Financial view
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    Select the lease you want to inspect.
                  </p>
                </div>

                <select
                  value={selectedLeaseId}
                  onChange={(event) => setSelectedLeaseId(event.target.value)}
                  className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 sm:min-w-80"
                >
                  <option value="all">All leases</option>

                  {leases.map((lease) => {
                    const property = propertyMap.get(lease.property_id);

                    return (
                      <option key={lease.id} value={lease.id}>
                        {propertyName(property)} · {titleCase(lease.status)}
                      </option>
                    );
                  })}
                </select>
              </div>
            </section>
          )}

          {/* Metrics */}
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={CircleDollarSign}
              label="Total paid"
              value={money(totalPaid)}
              helper={`${filteredPayments.filter((payment) => payment.status === "paid").length} completed payments`}
            />

            <MetricCard
              icon={Clock3}
              label="Outstanding"
              value={money(outstanding)}
              helper={
                pendingPayments.length
                  ? `${pendingPayments.length} payment${pendingPayments.length === 1 ? "" : "s"} pending`
                  : "No pending payment requests"
              }
            />

            <MetricCard
              icon={CalendarDays}
              label="Next payment"
              value={nextPayment ? money(nextPaymentAmount) : "—"}
              helper={
                nextPayment
                  ? `Due ${shortDate(nextPayment.toISOString())}`
                  : "No active payment schedule"
              }
            />

            <MetricCard
              icon={ShieldCheck}
              label="Escrow released"
              value={money(totalReleased)}
              helper={
                totalHeld > 0 ? `${money(totalHeld)} currently held` : "No funds currently held"
              }
            />
          </section>

          {/* Current lease */}
          {currentLease && (
            <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                    {propertyImage(propertyMap.get(currentLease.property_id)) ? (
                      <img
                        src={propertyImage(propertyMap.get(currentLease.property_id)) ?? undefined}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <Building2 className="size-6 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Current lease
                    </p>

                    <h3 className="mt-1 truncate text-lg font-black text-slate-950">
                      {propertyName(propertyMap.get(currentLease.property_id))}
                    </h3>

                    <p className="mt-1 truncate text-sm text-slate-500">
                      {propertyLocation(propertyMap.get(currentLease.property_id))}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[480px]">
                  <MiniInfo label="Rent" value={money(currentLease.rent_usd)} />

                  <MiniInfo label="Deposit" value={money(currentLease.deposit_usd)} />

                  <MiniInfo label="Frequency" value={titleCase(currentLease.payment_frequency)} />

                  <MiniInfo label="Escrow" value={titleCase(currentLease.escrow_status)} />
                </div>
              </div>
            </section>
          )}

          {/* Tabs */}
          <section className="mt-8">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
              {[
                {
                  key: "overview" as const,
                  label: "Overview",
                  icon: Wallet,
                },
                {
                  key: "history" as const,
                  label: "Payment History",
                  icon: Receipt,
                },
                {
                  key: "escrow" as const,
                  label: "Escrow Ledger",
                  icon: ShieldCheck,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                      active
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                  >
                    <Icon className="size-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Overview */}
          {activeTab === "overview" && (
            <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Upcoming obligation
                      </p>

                      <h3 className="mt-1 text-lg font-black">Next rent payment</h3>
                    </div>

                    <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100">
                      <CalendarDays className="size-5 text-slate-700" />
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  {currentLease && nextPayment ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-500">
                            {propertyName(propertyMap.get(currentLease.property_id))}
                          </p>

                          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                            {money(nextPaymentAmount)}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Due{" "}
                            <span className="font-bold text-slate-700">
                              {shortDate(nextPayment.toISOString())}
                            </span>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={openPaymentPanel}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                        >
                          <CreditCard className="size-4" />
                          Create Payment Request
                        </button>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      icon={CalendarDays}
                      title="No upcoming payment"
                      description="An active lease with a payment schedule will appear here."
                    />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <ShieldCheck className="size-5" />
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Protection
                      </p>
                      <h3 className="mt-1 text-lg font-black">Escrow status</h3>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 p-5 sm:p-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-500">Currently held</span>

                      <span className="text-sm font-black text-slate-950">{money(totalHeld)}</span>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{
                          width:
                            totalHeld + totalReleased > 0
                              ? `${Math.min(100, (totalHeld / (totalHeld + totalReleased)) * 100)}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-400">Held</p>
                      <p className="mt-1 text-lg font-black">{money(totalHeld)}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-400">Released</p>
                      <p className="mt-1 text-lg font-black">{money(totalReleased)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                    <LockKeyhole className="mt-0.5 size-4 shrink-0 text-slate-500" />

                    <p className="text-xs leading-5 text-slate-500">
                      TNP records escrow movements against your lease and maintains an auditable
                      financial history.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Payment history */}
          {activeTab === "history" && (
            <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Financial activity
                  </p>

                  <h3 className="mt-1 text-lg font-black">Payment History</h3>
                </div>

                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
                  {filteredPayments.length} record
                  {filteredPayments.length === 1 ? "" : "s"}
                </span>
              </div>

              {filteredPayments.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={Receipt}
                    title="No payments recorded"
                    description="Payments linked to your leases will appear here once they are created."
                  />
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 md:hidden">
                    {filteredPayments.map((payment) => {
                      const lease = leases.find((item) => item.id === payment.lease_id);

                      const property = lease ? propertyMap.get(lease.property_id) : undefined;

                      const Icon = paymentIcon(payment.payment_type);

                      return (
                        <button
                          key={payment.id}
                          type="button"
                          onClick={() => openPaymentDetails(payment)}
                          className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-50"
                        >
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                            <Icon className="size-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {propertyName(property)}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {titleCase(payment.payment_type)} · {shortDate(payment.created_at)}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-black">{money(payment.amount_usd)}</p>

                            <span
                              className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClasses(
                                payment.status,
                              )}`}
                            >
                              {titleCase(payment.status)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[760px]">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                          <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Payment
                          </th>

                          <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Lease
                          </th>

                          <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Amount
                          </th>

                          <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Date
                          </th>

                          <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Status
                          </th>

                          <th className="px-6 py-4" />
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {filteredPayments.map((payment) => {
                          const lease = leases.find((item) => item.id === payment.lease_id);

                          const property = lease ? propertyMap.get(lease.property_id) : undefined;

                          const Icon = paymentIcon(payment.payment_type);

                          return (
                            <tr key={payment.id} className="transition hover:bg-slate-50/70">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                    <Icon className="size-4" />
                                  </div>

                                  <div>
                                    <p className="text-sm font-bold text-slate-900">
                                      {titleCase(payment.payment_type)}
                                    </p>

                                    <p className="mt-0.5 text-xs text-slate-400">
                                      {payment.reference ?? "No reference yet"}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <p className="max-w-48 truncate text-sm font-semibold text-slate-700">
                                  {propertyName(property)}
                                </p>

                                <p className="mt-0.5 text-xs text-slate-400">Lease-linked</p>
                              </td>

                              <td className="px-6 py-4">
                                <span className="text-sm font-black text-slate-900">
                                  {money(payment.amount_usd)}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <p className="text-sm font-semibold text-slate-700">
                                  {shortDate(payment.paid_at ?? payment.created_at)}
                                </p>
                              </td>

                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClasses(
                                    payment.status,
                                  )}`}
                                >
                                  {titleCase(payment.status)}
                                </span>
                              </td>

                              <td className="px-6 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => openPaymentDetails(payment)}
                                  className="inline-flex size-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="View payment details"
                                >
                                  <MoreHorizontal className="size-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Escrow */}
          {activeTab === "escrow" && (
            <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Mutual Trust Ledger
                </p>

                <h3 className="mt-1 text-lg font-black">Escrow Transaction Ledger</h3>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Every escrow movement is linked to a lease and recorded independently from the
                  payment display.
                </p>
              </div>

              {filteredEscrow.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={ShieldCheck}
                    title="No escrow transactions"
                    description="Escrow activity will appear here when a qualifying payment is placed into or released from protection."
                  />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredEscrow.map((transaction) => {
                    const lease = leases.find((item) => item.id === transaction.lease_id);

                    const property = lease ? propertyMap.get(lease.property_id) : undefined;

                    return (
                      <div
                        key={transaction.id}
                        className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                      >
                        <div className="flex min-w-0 items-start gap-4">
                          <div
                            className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                              transaction.status === "released"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {transaction.status === "released" ? (
                              <ArrowUpRight className="size-5" />
                            ) : (
                              <LockKeyhole className="size-5" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-slate-900">
                                {titleCase(transaction.transaction_type)}
                              </p>

                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClasses(
                                  transaction.status,
                                )}`}
                              >
                                {titleCase(transaction.status)}
                              </span>
                            </div>

                            <p className="mt-1 truncate text-xs text-slate-500">
                              {propertyName(property)}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {dateTime(transaction.processed_at ?? transaction.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-lg font-black text-slate-950">
                            {money(transaction.amount_usd)}
                          </p>

                          {transaction.reference && (
                            <p className="mt-1 text-xs text-slate-400">{transaction.reference}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Recent audit */}
          {filteredAudit.length > 0 && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <FileText className="size-5" />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Audit trail
                    </p>

                    <h3 className="mt-1 text-lg font-black">Recent financial events</h3>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredAudit.slice(0, 6).map((audit) => (
                  <div key={audit.id} className="flex items-start gap-4 p-5">
                    <div className="mt-1 flex size-2 shrink-0 rounded-full bg-slate-400" />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">
                        {titleCase(audit.event_type)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {audit.previous_status && audit.new_status
                          ? `${titleCase(audit.previous_status)} → ${titleCase(audit.new_status)}`
                          : audit.new_status
                            ? titleCase(audit.new_status)
                            : "Financial event recorded"}
                      </p>
                    </div>

                    <p className="shrink-0 text-xs font-semibold text-slate-400">
                      {dateTime(audit.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Empty workspace */}
          {leases.length === 0 && (
            <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm sm:p-12">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Wallet className="size-7" />
              </div>

              <h3 className="mt-5 text-xl font-black text-slate-950">
                No lease-linked payments yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Your financial workspace becomes active once you have a lease. Your rent, deposit,
                payment records and escrow activity will appear here.
              </p>

              <Link
                to="/app/tenant/leases"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                View My Leases
                <ArrowUpRight className="size-4" />
              </Link>
            </section>
          )}

          {/* Security footer */}
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="size-5" />
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-900">TNP financial protection</h3>

                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                  Payment records are linked to your authenticated lease relationship. Financial
                  state changes are controlled by server-side TNP operations rather than editable
                  directly from this page.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <SecurityBadge label="Lease-linked" />
                  <SecurityBadge label="Tenant-scoped" />
                  <SecurityBadge label="Auditable" />
                  <SecurityBadge label="Escrow-aware" />
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Payment creation panel */}
        {showPaymentPanel && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
            <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 p-5 backdrop-blur-xl sm:p-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Secure payment request
                  </p>

                  <h2 className="mt-1 text-xl font-black">Create a Payment</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPaymentPanel(false)}
                  className="flex size-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Lease</p>

                  <p className="mt-1 text-sm font-black text-slate-900">
                    {propertyName(propertyMap.get(currentLease?.property_id ?? ""))}
                  </p>

                  {currentLease && (
                    <p className="mt-1 text-xs text-slate-500">
                      Scheduled rent:{" "}
                      <span className="font-bold">{money(currentLease.rent_usd)}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="payment-lease"
                    className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    Lease
                  </label>

                  <select
                    id="payment-lease"
                    value={selectedLeaseId}
                    onChange={(event) => {
                      const id = event.target.value;
                      setSelectedLeaseId(id);

                      const lease = leases.find((item) => item.id === id);

                      if (lease && paymentType === "rent") {
                        setPaymentAmount(String(Number(lease.rent_usd || 0)));
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  >
                    {leases.filter(isActiveLease).map((lease) => (
                      <option key={lease.id} value={lease.id}>
                        {propertyName(propertyMap.get(lease.property_id))}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="payment-type"
                    className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    Payment type
                  </label>

                  <select
                    id="payment-type"
                    value={paymentType}
                    onChange={(event) => {
                      const type = event.target.value;
                      setPaymentType(type);

                      const lease = leases.find((item) => item.id === selectedLeaseId);

                      if (type === "rent" && lease) {
                        setPaymentAmount(String(Number(lease.rent_usd || 0)));
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="rent">Rent</option>
                    <option value="deposit">Deposit</option>
                    <option value="utility">Utility</option>
                    <option value="late_fee">Late fee</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="payment-amount"
                    className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    Amount (USD)
                  </label>

                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      $
                    </span>

                    <input
                      id="payment-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-8 pr-4 text-sm font-bold outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="mt-0.5 size-4 shrink-0 text-sky-700" />

                    <p className="text-xs leading-5 text-sky-800">
                      Creating this record starts a TNP payment request in <strong>pending</strong>{" "}
                      status. It does not falsely mark money as paid. Confirmation and escrow
                      transitions are handled through controlled server-side operations.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowPaymentPanel(false)}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void createPaymentRequest()}
                    disabled={creatingPayment}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingPayment ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CreditCard className="size-4" />
                        Create Payment Request
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment details drawer */}
        {selectedPayment && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-sm">
            <aside className="flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Financial record
                  </p>

                  <h2 className="mt-1 text-xl font-black">Payment Details</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="flex size-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Amount
                      </p>

                      <p className="mt-1 text-3xl font-black text-slate-950">
                        {money(selectedPayment.payment.amount_usd)}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {titleCase(selectedPayment.payment.payment_type)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${statusClasses(
                        selectedPayment.payment.status,
                      )}`}
                    >
                      {titleCase(selectedPayment.payment.status)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <DetailItem
                    label="Created"
                    value={dateTime(selectedPayment.payment.created_at)}
                  />

                  <DetailItem label="Paid" value={dateTime(selectedPayment.payment.paid_at)} />

                  <DetailItem
                    label="Released"
                    value={dateTime(selectedPayment.payment.released_at)}
                  />

                  <DetailItem
                    label="Lease"
                    value={selectedPayment.lease ? propertyName(selectedPayment.property) : "—"}
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 p-5">
                    <h3 className="text-sm font-black">Payment reference</h3>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-5">
                    <code className="min-w-0 break-all rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                      {selectedPayment.payment.reference ?? selectedPayment.payment.id}
                    </code>

                    <button
                      type="button"
                      onClick={() =>
                        void copyReference(
                          selectedPayment.payment.reference ?? selectedPayment.payment.id,
                        )
                      }
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                      title="Copy reference"
                    >
                      {copiedReference ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 p-5">
                    <h3 className="text-sm font-black">Lease & property</h3>
                  </div>

                  <div className="space-y-4 p-5">
                    <InfoRow
                      icon={Building2}
                      label="Property"
                      value={propertyName(selectedPayment.property)}
                    />

                    <InfoRow
                      icon={UserRound}
                      label="Landlord"
                      value={selectedPayment.landlord?.full_name ?? "Landlord profile"}
                    />

                    <InfoRow
                      icon={CalendarDays}
                      label="Lease period"
                      value={
                        selectedPayment.lease
                          ? `${shortDate(selectedPayment.lease.start_date)} → ${shortDate(selectedPayment.lease.end_date)}`
                          : "—"
                      }
                    />

                    <InfoRow
                      icon={Wallet}
                      label="Escrow status"
                      value={
                        selectedPayment.lease ? titleCase(selectedPayment.lease.escrow_status) : "—"
                      }
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 p-5">
                    <h3 className="text-sm font-black">Escrow activity</h3>
                  </div>

                  {selectedPayment.escrow.length === 0 ? (
                    <div className="p-5">
                      <p className="text-sm text-slate-500">
                        No escrow movement has been recorded for this payment yet.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {selectedPayment.escrow.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between gap-4 p-5"
                        >
                          <div>
                            <p className="text-sm font-bold">
                              {titleCase(transaction.transaction_type)}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {dateTime(transaction.processed_at ?? transaction.created_at)}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-black">{money(transaction.amount_usd)}</p>

                            <p className="mt-1 text-xs font-semibold text-slate-400">
                              {titleCase(transaction.status)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 p-5">
                    <h3 className="text-sm font-black">Audit trail</h3>
                  </div>

                  {selectedPayment.audit.length === 0 ? (
                    <div className="p-5">
                      <p className="text-sm text-slate-500">
                        No audit events are available for this payment.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {selectedPayment.audit.map((audit) => (
                        <div key={audit.id} className="p-5">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 size-2 shrink-0 rounded-full bg-slate-400" />

                            <div>
                              <p className="text-sm font-bold">{titleCase(audit.event_type)}</p>

                              <p className="mt-1 text-xs text-slate-500">
                                {audit.previous_status && audit.new_status
                                  ? `${titleCase(audit.previous_status)} → ${titleCase(audit.new_status)}`
                                  : audit.new_status
                                    ? titleCase(audit.new_status)
                                    : "Recorded financial event"}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {dateTime(audit.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" />

                  <div>
                    <p className="text-sm font-black text-emerald-900">
                      Protected financial record
                    </p>

                    <p className="mt-1 text-xs leading-5 text-emerald-800">
                      This record is linked to your authenticated tenant lease and its financial
                      transitions are maintained in the TNP audit ledger.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 bg-white p-5 sm:p-6">
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="w-full rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Close Details
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="size-5" />
        </div>

        <MoreHorizontal className="size-4 text-slate-300" />
      </div>

      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>

      <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{value}</p>

      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>

      <p className="mt-1 truncate text-xs font-black text-slate-800">{value}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>

      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="size-4" />
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>

        <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function SecurityBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600">
      <CheckCircle2 className="size-3 text-emerald-600" />
      {label}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Wallet;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
        <Icon className="size-5" />
      </div>

      <h3 className="mt-4 text-sm font-black text-slate-800">{title}</h3>

      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

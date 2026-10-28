"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldCheck,
  LayoutDashboard,
  ArrowLeftRight,
  Bell,
  FolderSearch,
  SlidersHorizontal,
  FlaskConical,
  History,
  Users,
  ArrowUpRight,
  ChevronRight,
  RefreshCw,
  Download,
  Search,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  LockKeyhole,
  X,
  Plus,
} from "lucide-react";
import type {
  Analysis,
  Case,
  Rule,
  State,
  TransactionInput,
} from "@/lib/domain";
import type { summary, profiles } from "@/lib/service";
type Profile = ReturnType<typeof profiles>[number];
type WorkspaceData = State & {
  summary: ReturnType<typeof summary>;
  storage_mode: string;
  profiles: Record<"users" | "devices" | "recipients" | "agents", Profile[]>;
};
const money = (n: number) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(n);
const date = (s: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  }).format(new Date(s));
const label = (s: string) =>
  s
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (s) => s.toUpperCase());
const links = [
  ["", "Overview", LayoutDashboard],
  ["transactions", "Transactions", ArrowLeftRight],
  ["alerts", "Alerts", Bell],
  ["cases", "Cases", FolderSearch],
  ["rules", "Rules", SlidersHorizontal],
  ["simulator", "Simulator", FlaskConical],
  ["profiles", "Entity history", Users],
  ["audit", "Audit log", History],
] as const;
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) throw new Error("SIGN_IN");
    const detail = result.issues
      ?.map(
        (x: { path: string[]; message: string }) =>
          `${x.path.join(".")}: ${x.message}`,
      )
      .join("; ");
    throw new Error(detail ?? result.error ?? "Request failed");
  }
  return result;
}
export function Badge({ value }: { value: string }) {
  const tone = ["CRITICAL", "REJECT_AND_FREEZE", "CONFIRMED_FRAUD"].includes(
    value,
  )
    ? "red"
    : ["HIGH", "MEDIUM", "STEP_UP_AUTH", "UNDER_REVIEW"].includes(value)
      ? "amber"
      : ["LOW", "APPROVE", "FALSE_POSITIVE", "CLOSED"].includes(value)
        ? "green"
        : "blue";
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {label(value)}
    </span>
  );
}
function Empty({
  text = "No records match these filters.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <Search size={24} />
      <h3>{text}</h3>
      <p>Change the filters or analyze a transaction in the simulator.</p>
    </div>
  );
}
function Panel({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function ExportButton({ transactions }: { transactions: Analysis[] }) {
  function download() {
    const quote = (v: unknown) => `"${String(v).replaceAll('"', '""')}"`;
    const rows = [
      [
        "Transaction",
        "User",
        "Amount BDT",
        "Risk score",
        "Decision",
        "Timestamp",
      ],
      ...transactions.map((t) => [
        t.payload.transaction_id,
        t.payload.user_id,
        t.payload.amount,
        t.risk_score,
        t.decision,
        t.payload.timestamp,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(quote).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "mfs-transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button className="secondary" onClick={download}>
      <Download size={15} />
      Export CSV
    </button>
  );
}
export function Workspace() {
  const path = usePathname().split("/").filter(Boolean);
  const section = path[0] ?? "";
  const [data, setData] = useState<WorkspaceData>();
  const [error, setError] = useState("");
  const [signin, setSignin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await api<WorkspaceData>("v1/workspace"));
      setError("");
      setSignin(false);
    } catch (e) {
      const message = (e as Error).message;
      if (message === "SIGN_IN") {
        setSignin(true);
        setData(undefined);
      } else setError(message);
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [load]);
  async function login(e: FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    try {
      await api("auth", "POST", { password });
      setPassword("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }
  if (signin)
    return (
      <main className="login">
        <div className="login-brand">
          <ShieldCheck size={38} />
          <h1>MFS Guard</h1>
          <p>Fraud operations workspace</p>
        </div>
        <form onSubmit={login}>
          <h2>Analyst sign in</h2>
          <p>Enter your workspace password to review transactions.</p>
          <label>
            Analyst password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button disabled={authBusy}>
            {authBusy ? "Signing in…" : "Sign in"}
            <ArrowUpRight size={16} />
          </button>
        </form>
      </main>
    );
  const title = links.find((x) => x[0] === section)?.[1] ?? "Record detail";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <ShieldCheck size={23} />
          </span>
          <span>
            MFS Guard<small>Fraud operations</small>
          </span>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {links.map(([url, name, Icon]) => (
            <Link
              key={url}
              href={"/" + url}
              className={section === url ? "active" : ""}
              aria-current={section === url ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{name}</span>
              {url === "alerts" && !!data?.summary.open_cases && (
                <span className="nav-count">{data.summary.open_cases}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="engine-state">
            <span className="status-dot" />
            Rule engine <strong>Phase 1</strong>
          </div>
          <p>
            Transparent decisions.
            <br />
            Traceable evidence.
          </p>
          <div className="analyst">
            <span className="avatar">FA</span>
            <div>
              Fraud analyst<small>Operations workspace</small>
            </div>
            <button
              aria-label="Sign out"
              className="icon-button"
              onClick={async () => {
                await api("auth", "DELETE");
                await load();
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace <ChevronRight size={14} /> <strong>{title}</strong>
          </span>
          <span className="topbar-right">
            <span className="status-dot" />
            {data?.storage_mode === "postgres"
              ? "Persistent workspace"
              : "Synthetic demo"}
            <span className="timezone">Dhaka · BDT</span>
          </span>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <h1>
                {path[1]
                  ? "Investigation detail"
                  : title === "Overview"
                    ? "Operations overview"
                    : title}
              </h1>
              <p>
                {section === ""
                  ? "Monitor transaction risk and focus on the cases that need attention."
                  : section === "simulator"
                    ? "Evaluate a transaction and inspect the evidence behind its decision."
                    : section === "rules"
                      ? "Tune deterministic controls. Every change is versioned and audited."
                      : section === "audit"
                        ? "A traceable record of analysis, configuration, and analyst actions."
                        : "Review transaction activity and supporting risk evidence."}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="secondary"
                disabled={refreshing}
                onClick={() => void load()}
              >
                <RefreshCw size={15} className={refreshing ? "spin" : ""} />
                Refresh
              </button>
              {section !== "simulator" && (
                <Link className="button" href="/simulator">
                  <Plus size={16} />
                  Analyze transaction
                </Link>
              )}
            </div>
          </div>
          {data?.storage_mode !== "postgres" && (
            <div className="demo-notice">
              <FlaskConical size={16} />
              <span>
                <strong>Synthetic demonstration</strong> ·{" "}
                {data?.storage_mode === "ephemeral-demo"
                  ? "Changes can reset when the serverless instance restarts. Connect PostgreSQL for durable storage."
                  : "Sample data is saved locally. Connect PostgreSQL for persistent Vercel deployment."}
              </span>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button className="secondary" onClick={() => void load()}>
                Retry
              </button>
            </div>
          )}
          {!data ? (
            <div className="loading" role="status">
              {error
                ? "Workspace unavailable. Check server configuration."
                : "Loading fraud operations…"}
            </div>
          ) : path[1] && (section === "transactions" || section === "cases") ? (
            <Detail
              data={data}
              id={decodeURIComponent(path[1])}
              isCase={section === "cases"}
              reload={load}
            />
          ) : section === "" ? (
            <Dashboard data={data} />
          ) : section === "transactions" ? (
            <TransactionList data={data} />
          ) : section === "alerts" || section === "cases" ? (
            <CaseList data={data} alerts={section === "alerts"} />
          ) : section === "simulator" ? (
            <Simulator reload={load} />
          ) : section === "rules" ? (
            <Rules rules={data.rules} reload={load} />
          ) : section === "audit" ? (
            <AuditList data={data} />
          ) : section === "profiles" ? (
            <Profiles data={data} />
          ) : (
            <Empty text="This page does not exist." />
          )}
          <footer>
            Rule-based screening · Phase 1 prototype{" "}
            <span>
              Decisions are recommendations; no funds are moved or frozen.
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Dashboard({ data }: { data: WorkspaceData }) {
  const s = data.summary;
  const recent = data.cases.slice().reverse().slice(0, 5);
  const peak = Math.max(1, ...s.trend.map((x) => x.total));
  return (
    <>
      <div className="metrics">
        {[
          ["Transactions screened", s.total, "All stored transactions"],
          ["Approved", s.approved, "Low-risk decisions"],
          ["Verification required", s.step_up, "Step-up authentication"],
          ["Rejected / freeze", s.rejected, "Critical-risk recommendations"],
          ["Open cases", s.open_cases, "Awaiting analyst disposition"],
        ].map(([name, count, caption], i) => (
          <div className="metric" key={name}>
            <span>{name}</span>
            <strong className={i === 3 ? "danger-text" : ""}>
              {Number(count).toLocaleString()}
            </strong>
            <small>{caption}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-charts">
        <Panel
          title="Transaction activity"
          action={
            <span className="muted">Last 24 hours · 2-hour intervals</span>
          }
        >
          <div className="chart-legend">
            <span>
              <i className="legend-blue" />
              Screened
            </span>
            <span>
              <i className="legend-amber" />
              Flagged
            </span>
            <strong>
              {money(s.screened_amount)}
              <small>Total screened value</small>
            </strong>
          </div>
          <div
            className="volume-chart"
            role="img"
            aria-label={`Transaction volume over 24 hours; ${s.total} total stored transactions`}
          >
            <div className="chart-grid">
              <span>{peak}</span>
              <span>{Math.round(peak / 2)}</span>
              <span>0</span>
            </div>
            <div className="chart-columns">
              {s.trend.map((p, i) => (
                <div className="chart-column" key={p.timestamp}>
                  <div className="bar-space">
                    <div
                      className="volume-bar"
                      style={{ height: `${(p.total / peak) * 100}%` }}
                      title={`${p.total} screened, ${p.flagged} flagged`}
                    >
                      <div
                        className="flagged-bar"
                        style={{
                          height: `${p.total ? (p.flagged / p.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span>
                    {i % 2 === 0
                      ? new Intl.DateTimeFormat("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Dhaka",
                        }).format(new Date(p.timestamp))
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel
          title="Risk distribution"
          action={<span className="muted">All transactions</span>}
        >
          <div className="risk-stack">
            {s.risk_distribution.map((r) => (
              <div
                key={r.level}
                className={`risk-segment ${r.level.toLowerCase()}`}
                style={{ flex: r.count || 0.05 }}
                title={`${label(r.level)}: ${r.count}`}
              />
            ))}
          </div>
          <div className="distribution">
            {s.risk_distribution.map((r) => (
              <div key={r.level}>
                <Badge value={r.level} />
                <span>
                  {r.count}
                  <small>
                    {s.total ? Math.round((r.count / s.total) * 100) : 0}%
                  </small>
                </span>
              </div>
            ))}
          </div>
          <p className="panel-note">
            Scores combine triggered rule weights, capped at 100.
          </p>
        </Panel>
      </div>
      <Panel
        title="Recent fraud alerts"
        action={
          <Link className="text-link" href="/alerts">
            View all alerts
            <ArrowUpRight size={14} />
          </Link>
        }
      >
        {recent.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Transaction / account</th>
                  <th>Amount</th>
                  <th>Risk score</th>
                  <th>Decision</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => {
                  const t = data.transactions.find(
                    (t) => t.id === c.transaction_id,
                  )!;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link className="record-link" href={"/cases/" + c.id}>
                          {t.payload.transaction_id}
                        </Link>
                        <small>{t.payload.user_id}</small>
                      </td>
                      <td>{money(t.payload.amount)}</td>
                      <td>
                        <RiskScore t={t} />
                      </td>
                      <td>
                        <Badge value={t.decision} />
                      </td>
                      <td>
                        <Badge value={c.status} />
                      </td>
                      <td className="muted">{date(t.payload.timestamp)}</td>
                      <td>
                        <Link
                          aria-label={`Open ${t.payload.transaction_id}`}
                          href={"/cases/" + c.id}
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No fraud alerts yet." />
        )}
      </Panel>
      <div className="dashboard-bottom">
        <Panel title="Most triggered rules">
          <div className="rank-list">
            {s.top_rules.map((r) => (
              <div key={r.code}>
                <span>
                  <small>{r.code}</small>
                  {r.name}
                </span>
                <strong>
                  {r.count}
                  <small>triggers</small>
                </strong>
              </div>
            ))}
          </div>
          <Link href="/rules" className="panel-link">
            Manage detection rules
            <ArrowUpRight size={14} />
          </Link>
        </Panel>
        <Panel title="Recipient risk signals">
          <EntityMini items={data.profiles.recipients.slice(0, 4)} />
        </Panel>
        <Panel title="Devices to investigate">
          <EntityMini
            items={data.profiles.devices
              .filter((x) => x.flagged > 0)
              .slice(0, 4)}
          />
        </Panel>
      </div>
    </>
  );
}
function EntityMini({ items }: { items: Profile[] }) {
  return items.length ? (
    <div className="rank-list">
      {items.map((p) => (
        <div key={p.id}>
          <Link href={"/profiles?entity=" + encodeURIComponent(p.id)}>
            <strong>{p.id}</strong>
            <small>
              {p.flagged} flagged · {p.count} transactions
            </small>
          </Link>
          <span
            className={`score ${p.max_risk >= 85 ? "red" : p.max_risk >= 45 ? "amber" : "green"}`}
          >
            {p.max_risk}
          </span>
        </div>
      ))}
    </div>
  ) : (
    <Empty text="No entity risk signals." />
  );
}
function RiskScore({ t }: { t: Analysis }) {
  return (
    <span className="risk-score">
      <strong
        className={
          t.risk_score >= 85
            ? "danger-text"
            : t.risk_score >= 45
              ? "warning-text"
              : ""
        }
      >
        {t.risk_score}
      </strong>
      <span>/100</span>
      <div className="score-track">
        <i
          style={{
            width: `${t.risk_score}%`,
            background:
              t.risk_score >= 85
                ? "var(--red)"
                : t.risk_score >= 45
                  ? "var(--amber)"
                  : "var(--green)",
          }}
        />
      </div>
    </span>
  );
}
function TransactionList({ data }: { data: WorkspaceData }) {
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("");
  const [decision, setDecision] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const items = data.transactions
    .slice()
    .reverse()
    .filter(
      (t) =>
        (
          t.payload.transaction_id +
          " " +
          t.payload.user_id +
          " " +
          t.payload.receiver_id
        )
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!risk || t.risk_level === risk) &&
        (!decision || t.decision === decision) &&
        (!type || t.payload.transaction_type === type) &&
        (!from || t.payload.timestamp >= from) &&
        (!to || t.payload.timestamp < to + "T23:59:59.999Z"),
    );
  return (
    <Panel
      title={`Transaction history (${items.length})`}
      action={<ExportButton transactions={items} />}
    >
      <div className="filters">
        <SearchBox value={search} set={setSearch} />
        <Select
          label="Risk level"
          value={risk}
          set={setRisk}
          options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]}
        />
        <Select
          label="Decision"
          value={decision}
          set={setDecision}
          options={["APPROVE", "STEP_UP_AUTH", "REJECT_AND_FREEZE"]}
        />
        <Select
          label="Type"
          value={type}
          set={setType}
          options={["SEND_MONEY", "CASH_OUT", "PAYMENT", "CASH_IN"]}
        />
        <label className="date-filter">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="date-filter">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <TransactionTable items={items} />
    </Panel>
  );
}
function SearchBox({
  value,
  set,
}: {
  value: string;
  set: (v: string) => void;
}) {
  return (
    <label className="search-box">
      <Search size={16} />
      <input
        aria-label="Search records"
        placeholder="Search transaction or account…"
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}
function Select({
  label: caption,
  value,
  set,
  options,
}: {
  label: string;
  value: string;
  set: (s: string) => void;
  options: readonly string[];
}) {
  return (
    <select
      aria-label={caption}
      value={value}
      onChange={(e) => set(e.target.value)}
    >
      <option value="">All {caption.toLowerCase()}s</option>
      {options.map((x) => (
        <option key={x} value={x}>
          {label(x)}
        </option>
      ))}
    </select>
  );
}
function TransactionTable({ items }: { items: Analysis[] }) {
  if (!items.length) return <Empty />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Account / recipient</th>
            <th>Type / channel</th>
            <th>Amount</th>
            <th>Risk</th>
            <th>Decision</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>
                <Link className="record-link" href={"/transactions/" + t.id}>
                  {t.payload.transaction_id}
                </Link>
                <small>{t.triggered_rules.length} rules triggered</small>
              </td>
              <td>
                {t.payload.user_id}
                <small>{t.payload.receiver_id}</small>
              </td>
              <td>
                {label(t.payload.transaction_type)}
                <small>{t.payload.channel}</small>
              </td>
              <td>{money(t.payload.amount)}</td>
              <td>
                <RiskScore t={t} />
              </td>
              <td>
                <Badge value={t.decision} />
              </td>
              <td className="muted">{date(t.payload.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function CaseList({ data, alerts }: { data: WorkspaceData; alerts: boolean }) {
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("");
  const [status, setStatus] = useState("");
  const [decision, setDecision] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const cases = data.cases
    .slice()
    .reverse()
    .filter((c) => {
      const t = data.transactions.find((t) => t.id === c.transaction_id)!;
      return (
        (c.id + " " + t.payload.transaction_id + " " + t.payload.user_id)
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!risk || t.risk_level === risk) &&
        (!status || c.status === status) &&
        (!decision || t.decision === decision) &&
        (!type || t.payload.transaction_type === type) &&
        (!from || t.payload.timestamp >= from) &&
        (!to || t.payload.timestamp < to + "T23:59:59.999Z")
      );
    });
  return (
    <Panel
      title={`${alerts ? "Alert queue" : "Fraud cases"} (${cases.length})`}
    >
      <div className="filters">
        <SearchBox value={search} set={setSearch} />
        <Select
          label="Risk level"
          value={risk}
          set={setRisk}
          options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]}
        />
        <Select
          label="Status"
          value={status}
          set={setStatus}
          options={[
            "NEW",
            "UNDER_REVIEW",
            "CONFIRMED_FRAUD",
            "FALSE_POSITIVE",
            "CLOSED",
          ]}
        />
        <Select
          label="Decision"
          value={decision}
          set={setDecision}
          options={["STEP_UP_AUTH", "REJECT_AND_FREEZE"]}
        />
        <Select
          label="Type"
          value={type}
          set={setType}
          options={["SEND_MONEY", "CASH_OUT", "PAYMENT"]}
        />
        <label className="date-filter">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="date-filter">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      {cases.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Case / transaction</th>
                <th>User</th>
                <th>Amount</th>
                <th>Risk</th>
                <th>Rules</th>
                <th>Decision</th>
                <th>Status</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const t = data.transactions.find(
                  (t) => t.id === c.transaction_id,
                )!;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link className="record-link" href={"/cases/" + c.id}>
                        {t.payload.transaction_id}
                      </Link>
                      <small>Case {c.id.slice(5, 13)}</small>
                    </td>
                    <td>{t.payload.user_id}</td>
                    <td>{money(t.payload.amount)}</td>
                    <td>
                      <RiskScore t={t} />
                    </td>
                    <td>
                      <span
                        title={t.triggered_rules.map((r) => r.name).join(", ")}
                      >
                        {t.triggered_rules.length} triggered
                      </span>
                    </td>
                    <td>
                      <Badge value={t.decision} />
                    </td>
                    <td>
                      <Badge value={c.status} />
                    </td>
                    <td>{date(t.payload.timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}
    </Panel>
  );
}
function Evidence({ t }: { t: Analysis }) {
  const p = t.payload;
  return (
    <>
      <div className={`result-banner ${t.risk_level.toLowerCase()}`}>
        <div className="result-icon">
          {t.decision === "APPROVE" ? (
            <CheckCircle2 size={28} />
          ) : t.decision === "REJECT_AND_FREEZE" ? (
            <LockKeyhole size={28} />
          ) : (
            <AlertTriangle size={28} />
          )}
        </div>
        <div>
          <h2>{label(t.decision)}</h2>
          <p>
            {t.decision === "APPROVE"
              ? "Transaction meets the current approval policy."
              : t.decision === "STEP_UP_AUTH"
                ? "Require additional identity verification before proceeding."
                : "Reject this transaction and recommend an account freeze."}
          </p>
        </div>
        <div className="result-score">
          <strong>
            {t.risk_score}
            <small>/100</small>
          </strong>
          <Badge value={t.risk_level} />
        </div>
      </div>
      <div className="detail-grid">
        <Panel
          title="Triggered rule evidence"
          action={
            <span className="muted">{t.triggered_rules.length} signals</span>
          }
        >
          {t.triggered_rules.length ? (
            <div className="evidence-list">
              {t.triggered_rules.map((r) => (
                <div key={r.code}>
                  <div>
                    <span className="rule-code">
                      {r.code} · v{r.version}
                    </span>
                    <h3>{r.name}</h3>
                    <p>{r.reason}</p>
                  </div>
                  <strong>+{r.weight}</strong>
                </div>
              ))}
              <div className="score-total">
                <span>
                  Final risk score{" "}
                  <small>Sum capped at 100; blocklists override.</small>
                </span>
                <strong>{t.risk_score}/100</strong>
              </div>
            </div>
          ) : (
            <p className="panel-note">
              No enabled rules triggered. Risk score is 0.
            </p>
          )}
        </Panel>
        <Panel title="Transaction context">
          <dl className="facts">
            {[
              ["Transaction", p.transaction_id],
              ["Account", p.user_id],
              ["MSISDN", p.msisdn],
              ["Amount", money(p.amount)],
              ["Fee", money(p.fee)],
              ["Balance before", money(p.balance_before)],
              ["Projected balance", money(t.balance_after)],
              ["Type / channel", `${label(p.transaction_type)} / ${p.channel}`],
              ["Recipient", p.receiver_id],
              ["Agent", p.agent_id || "Not supplied"],
              ["Timestamp", date(p.timestamp)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
      <div className="detail-grid">
        <Panel title="Calculated features">
          <dl className="facts">
            {Object.entries(t.features).map(([k, v]) => (
              <div key={k}>
                <dt>{label(k)}</dt>
                <dd>
                  {v === null
                    ? "Unavailable"
                    : typeof v === "boolean"
                      ? v
                        ? "Yes"
                        : "No"
                      : typeof v === "number"
                        ? Number(v.toFixed(3)).toLocaleString()
                        : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Device & security context">
          <dl className="facts">
            {[
              ["Device", p.device_id],
              ["IMEI", p.imei || "Not supplied"],
              ["SIM", p.sim_id || "Not supplied"],
              ["IP address", p.ip_address || "Not supplied"],
              [
                "Location",
                p.latitude === null
                  ? "Not supplied"
                  : `${p.latitude}, ${p.longitude}`,
              ],
              ["Failed PIN attempts", String(p.failed_pin_attempts)],
              ["OTP resends", String(p.otp_resend_count)],
              ["Recent PIN reset", p.pin_reset_recently ? "Yes" : "No"],
              [
                "Root / emulator",
                `${p.rooted_device ? "Rooted" : "No root flag"} / ${p.emulator_detected ? "Emulator" : "No emulator flag"}`,
              ],
              [
                "VPN / screen share",
                `${p.vpn_active ? "VPN active" : "No VPN flag"} / ${p.screen_share_detected ? "Screen share active" : "No screen share flag"}`,
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="panel-note">
            Security flags are supplied context. Screen sharing contributes to
            the device feature; the initial 18 rules do not independently score
            it.
          </p>
        </Panel>
      </div>
      <Panel title="Account transaction timeline">
        <p className="panel-note">
          Only recorded transactions appear here. Credential flags do not invent
          historical events.
        </p>
      </Panel>
    </>
  );
}
function Detail({
  data,
  id,
  isCase,
  reload,
}: {
  data: WorkspaceData;
  id: string;
  isCase: boolean;
  reload: () => Promise<void>;
}) {
  const c = isCase
    ? data.cases.find((c) => c.id === id)
    : data.cases.find((c) => c.transaction_id === id);
  const t = data.transactions.find(
    (t) =>
      t.id === (isCase ? c?.transaction_id : id) ||
      t.payload.transaction_id === id,
  );
  const [action, setAction] = useState("REQUEST_VERIFICATION");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  if (!t) return <Empty text="Record not found." />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("v1/cases/" + c!.id + "/review", "POST", { action, note });
      setNote("");
      setMessage("Review recorded. The screening decision is preserved.");
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="detail-top">
        <Link href={isCase ? "/cases" : "/transactions"} className="text-link">
          Back to {isCase ? "cases" : "transactions"}
        </Link>
        <span className="muted">{t.payload.transaction_id}</span>
      </div>
      <Evidence t={t} />
      {c && (
        <Panel title="Analyst disposition" action={<Badge value={c.status} />}>
          <form className="review-form" onSubmit={submit}>
            <label>
              Review action
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                {[
                  "CONFIRM_FRAUD",
                  "MARK_FALSE_POSITIVE",
                  "REQUEST_VERIFICATION",
                  "RELEASE_HOLD",
                  "KEEP_FROZEN",
                ].map((a) => (
                  <option key={a} value={a}>
                    {label(a)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Analyst notes
              <textarea
                required
                minLength={5}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Record the evidence supporting your action…"
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="success">
                {message}
              </p>
            )}
            <button disabled={busy}>
              {busy ? "Saving review…" : "Save review"}
            </button>
          </form>
          <div className="timeline">
            {c.actions
              .slice()
              .reverse()
              .map((a, i) => (
                <div key={i}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{label(a.action)}</strong>
                    <small>
                      {a.actor} · {date(a.timestamp)}
                    </small>
                    <p>{a.note}</p>
                  </div>
                </div>
              ))}
          </div>
        </Panel>
      )}
      <Panel title="Recorded account activity">
        <TransactionTable
          items={data.transactions
            .filter(
              (x) =>
                x.payload.user_id === t.payload.user_id &&
                Date.parse(x.payload.timestamp) <=
                  Date.parse(t.payload.timestamp),
            )
            .slice()
            .reverse()
            .slice(0, 10)}
        />
      </Panel>
      <details className="snapshot">
        <summary>Original payload and rule configuration snapshot</summary>
        <pre>
          {JSON.stringify(
            { payload: t.payload, rule_snapshot: t.rule_snapshot },
            null,
            2,
          )}
        </pre>
      </details>
    </>
  );
}
function makePreset(kind: "normal" | "suspicious" | "fraud"): TransactionInput {
  const now = new Date();
  return {
    transaction_id: "TX-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
    user_id: "demo-" + kind,
    msisdn: "01712345678",
    transaction_type: kind === "fraud" ? "CASH_OUT" : "SEND_MONEY",
    amount: kind === "normal" ? 1000 : kind === "suspicious" ? 20000 : 49000,
    fee: 0,
    balance_before:
      kind === "normal" ? 15000 : kind === "suspicious" ? 25000 : 50000,
    receiver_id: "recipient-demo-" + kind,
    agent_id: "",
    channel: "APP",
    device_id: "device-demo-" + kind,
    imei: "",
    sim_id: "",
    ip_address: "",
    latitude: 23.8103,
    longitude: 90.4125,
    timestamp: now.toISOString(),
    failed_pin_attempts: kind === "fraud" ? 4 : kind === "suspicious" ? 2 : 0,
    otp_resend_count: kind === "fraud" ? 5 : kind === "suspicious" ? 2 : 0,
    balance_inquiry_count_5m: 0,
    pin_reset_recently: kind === "fraud",
    device_is_new: kind !== "normal",
    rooted_device: false,
    emulator_detected: false,
    vpn_active: kind === "fraud",
    screen_share_detected: false,
    channel_changed_recently: kind === "suspicious",
    previous_latitude: kind === "fraud" ? 22.3569 : null,
    previous_longitude: kind === "fraud" ? 91.7832 : null,
    previous_timestamp:
      kind === "fraud" ? new Date(now.getTime() - 300000).toISOString() : null,
    last_received_at: null,
  };
}
function Simulator({ reload }: { reload: () => Promise<void> }) {
  const [form, setForm] = useState<TransactionInput>();
  const [result, setResult] = useState<Analysis>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState("normal");
  const router = useRouter();
  useEffect(() => setForm(makePreset("normal")), []);
  if (!form) return <div className="loading">Preparing simulator…</div>;
  const update = (key: keyof TransactionInput, value: unknown) =>
    setForm((f) => ({ ...f!, [key]: value }));
  const field = (
    key: keyof TransactionInput,
    caption: string,
    type = "text",
    nullable = false,
  ) => (
    <label key={key}>
      {caption}
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        required={!nullable}
        value={form[key] === null ? "" : String(form[key])}
        onChange={(e) =>
          update(
            key,
            type === "number"
              ? e.target.value === "" && nullable
                ? null
                : Number(e.target.value)
              : e.target.value,
          )
        }
      />
    </label>
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const a = await api<Analysis>("v1/transactions/analyze", "POST", form);
      setResult(a);
      await reload();
      document
        .getElementById("analysis-result")
        ?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function loadPreset(kind: "normal" | "suspicious" | "fraud") {
    setPreset(kind);
    setForm(makePreset(kind));
    setResult(undefined);
    setError("");
  }
  return (
    <>
      <Panel
        title="Demo scenarios"
        action={<span className="muted">Synthetic inputs</span>}
      >
        <div className="presets">
          {(["normal", "suspicious", "fraud"] as const).map((kind, i) => (
            <button
              key={kind}
              className={`preset ${preset === kind ? "selected" : ""}`}
              onClick={() => loadPreset(kind)}
            >
              <span className={`preset-dot ${kind}`} />
              <span>
                <strong>
                  {
                    [
                      "Normal transaction",
                      "Suspicious activity",
                      "Fraud-like cash-out",
                    ][i]
                  }
                </strong>
                <small>
                  {
                    [
                      "Expected: approve",
                      "Expected: verification",
                      "Expected: reject & freeze",
                    ][i]
                  }
                </small>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
        <p className="panel-note">
          Expected decisions use the default rules and isolated scenario
          accounts. Rule edits or accumulated history can change the outcome.
        </p>
      </Panel>
      <form onSubmit={submit}>
        <div className="detail-grid">
          <Panel title="Transaction details">
            <div className="form-grid">
              {field("transaction_id", "Transaction ID")}
              {field("user_id", "User ID")}
              {field("msisdn", "Mobile number")}
              <label>
                Transaction type
                <select
                  value={form.transaction_type}
                  onChange={(e) => update("transaction_type", e.target.value)}
                >
                  {["SEND_MONEY", "CASH_OUT", "PAYMENT", "CASH_IN"].map((x) => (
                    <option key={x} value={x}>
                      {label(x)}
                    </option>
                  ))}
                </select>
              </label>
              {field("amount", "Amount (BDT)", "number")}
              {field("fee", "Fee (BDT)", "number")}
              {field("balance_before", "Available balance (BDT)", "number")}
              {field("receiver_id", "Recipient ID")}
              {field("agent_id", "Agent ID", "text", true)}
              <label>
                Channel
                <select
                  value={form.channel}
                  onChange={(e) => update("channel", e.target.value)}
                >
                  {["APP", "USSD", "AGENT"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              {field("timestamp", "Transaction timestamp (ISO)")}
            </div>
          </Panel>
          <Panel title="Device & security">
            <div className="form-grid">
              {field("device_id", "Device ID")}
              {field("imei", "IMEI", "text", true)}
              {field("sim_id", "SIM ID", "text", true)}
              {field("ip_address", "IP address", "text", true)}
              {field("failed_pin_attempts", "Failed PIN attempts", "number")}
              {field("otp_resend_count", "OTP resend count", "number")}
              {field(
                "balance_inquiry_count_5m",
                "Balance inquiries in 5 minutes",
                "number",
              )}
            </div>
            <div className="checkbox-grid">
              {[
                ["pin_reset_recently", "Recent PIN reset"],
                ["device_is_new", "New device"],
                ["rooted_device", "Rooted device"],
                ["emulator_detected", "Emulator detected"],
                ["vpn_active", "VPN active"],
                ["screen_share_detected", "Screen sharing"],
                ["channel_changed_recently", "Recent channel change"],
              ].map(([key, caption]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={form[key as keyof TransactionInput] === true}
                    onChange={(e) =>
                      update(key as keyof TransactionInput, e.target.checked)
                    }
                  />
                  {caption}
                </label>
              ))}
            </div>
          </Panel>
        </div>
        <Panel title="Location & fund movement">
          <div className="form-grid location-grid">
            {field("latitude", "Current latitude", "number", true)}
            {field("longitude", "Current longitude", "number", true)}
            {field("previous_latitude", "Previous latitude", "number", true)}
            {field("previous_longitude", "Previous longitude", "number", true)}
            <label>
              Previous timestamp (ISO)
              <input
                value={form.previous_timestamp ?? ""}
                onChange={(e) =>
                  update("previous_timestamp", e.target.value || null)
                }
                placeholder="Optional; uses history if absent"
              />
            </label>
            <label>
              Last funds received (ISO)
              <input
                value={form.last_received_at ?? ""}
                onChange={(e) =>
                  update("last_received_at", e.target.value || null)
                }
                placeholder="Optional; uses cash-in history"
              />
            </label>
          </div>
        </Panel>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <p>Analysis saves the transaction and creates a case when flagged.</p>
          <button
            type="button"
            className="secondary"
            onClick={() => loadPreset("normal")}
          >
            Reset
          </button>
          <button disabled={busy}>
            <FlaskConical size={16} />
            {busy ? "Analyzing…" : "Analyze transaction"}
          </button>
        </div>
      </form>
      {result && (
        <div id="analysis-result">
          <div className="section-heading">
            <h2>Transaction risk analysis</h2>
            <button
              className="secondary"
              onClick={() => router.push("/transactions/" + result.id)}
            >
              Open saved record
              <ArrowUpRight size={15} />
            </button>
          </div>
          <Evidence t={result} />
        </div>
      )}
    </>
  );
}
function Rules({
  rules,
  reload,
}: {
  rules: Rule[];
  reload: () => Promise<void>;
}) {
  const [edit, setEdit] = useState<Rule>();
  const [creating, setCreating] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    try {
      await api(
        creating ? "v1/rules" : "v1/rules/" + edit.code,
        creating ? "POST" : "PATCH",
        creating
          ? {
              code: edit.code,
              name: edit.name,
              description: edit.description,
              category: edit.category,
              weight: edit.weight,
              threshold: edit.threshold,
              enabled: edit.enabled,
              severity: edit.severity,
              condition: edit.condition,
            }
          : {
              weight: edit.weight,
              threshold: edit.threshold,
              enabled: edit.enabled,
              severity: edit.severity,
            },
      );
      await reload();
      setEdit(undefined);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!edit) return;
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEdit(undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [!!edit]);
  return (
    <>
      <div className="policy-note">
        <ShieldCheck size={20} />
        <div>
          <strong>
            {rules.filter((r) => r.enabled).length} of {rules.length} rules
            enabled
          </strong>
          <p>
            Approve: 0–44 · Verify: 45–84 · Reject & freeze: 85–100. Enabled
            blocklists always reject.
          </p>
        </div>
      </div>
      <Panel
        title="Detection policy"
        action={
          <button
            className="secondary small"
            onClick={() => {
              setCreating(true);
              setError("");
              setEdit({
                code: "CUSTOM_NEW_RULE",
                name: "New detection rule",
                description: "Custom feature threshold control.",
                category: "BEHAVIOR",
                enabled: true,
                weight: 20,
                threshold: 5,
                severity: "HIGH",
                version: 1,
                updated_at: new Date().toISOString(),
                condition: { feature: "tx_count_5m", operator: "gt" },
              });
            }}
          >
            <Plus size={14} />
            Add rule
          </button>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rule</th>
                <th>Category</th>
                <th>Threshold</th>
                <th>Weight</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.code}>
                  <td>
                    <strong>{r.name}</strong>
                    <small>
                      {r.code} · Version {r.version}
                    </small>
                  </td>
                  <td>{label(r.category)}</td>
                  <td>
                    {["R001", "R002"].includes(r.code)
                      ? `${r.threshold * 100}%`
                      : r.threshold}
                  </td>
                  <td>{r.weight}</td>
                  <td>
                    <Badge value={r.severity} />
                  </td>
                  <td>
                    <span className={r.enabled ? "enabled" : "muted"}>
                      {r.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="muted">{date(r.updated_at)}</td>
                  <td>
                    <button
                      className="secondary small"
                      onClick={() => {
                        setCreating(false);
                        setEdit({ ...r });
                        setError("");
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {edit && (
        <div className="modal-backdrop" onClick={() => setEdit(undefined)}>
          <dialog
            ref={dialogRef}
            onCancel={() => setEdit(undefined)}
            aria-labelledby="edit-title"
            className="rule-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-heading">
              <h2 id="edit-title">
                {creating ? "Create detection rule" : "Edit " + edit.code}
              </h2>
              <button
                aria-label="Close editor"
                className="icon-button"
                onClick={() => setEdit(undefined)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={save}>
              <h3>{edit.name}</h3>
              <p>{edit.description}</p>
              {creating && (
                <>
                  <label>
                    Rule code
                    <input
                      required
                      pattern="CUSTOM_[A-Z0-9_]{1,40}"
                      value={edit.code}
                      onChange={(e) =>
                        setEdit({ ...edit, code: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Rule name
                    <input
                      required
                      minLength={3}
                      maxLength={100}
                      value={edit.name}
                      onChange={(e) =>
                        setEdit({ ...edit, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Description
                    <input
                      required
                      minLength={5}
                      maxLength={500}
                      value={edit.description}
                      onChange={(e) =>
                        setEdit({ ...edit, description: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Feature
                    <select
                      value={edit.condition!.feature}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          condition: {
                            ...edit.condition!,
                            feature: e.target.value as NonNullable<
                              Rule["condition"]
                            >["feature"],
                          },
                        })
                      }
                    >
                      {[
                        "depletion_ratio",
                        "tx_count_5m",
                        "amount_sum_1h",
                        "recipient_risk_score",
                        "device_risk_score",
                        "user_behavior_score",
                      ].map((x) => (
                        <option key={x} value={x}>
                          {label(x)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Comparison
                    <select
                      value={edit.condition!.operator}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          condition: {
                            ...edit.condition!,
                            operator: e.target.value as "gte" | "gt" | "lt",
                          },
                        })
                      }
                    >
                      <option value="gte">Greater than or equal</option>
                      <option value="gt">Greater than</option>
                      <option value="lt">Less than</option>
                    </select>
                  </label>
                </>
              )}
              <label>
                Weight
                <input
                  autoFocus
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  required
                  value={edit.weight}
                  onChange={(e) =>
                    setEdit({ ...edit, weight: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Threshold
                <input
                  type="number"
                  min="0"
                  max={["R001", "R002"].includes(edit.code) ? 1 : 10000000}
                  step="any"
                  required
                  value={edit.threshold}
                  onChange={(e) =>
                    setEdit({ ...edit, threshold: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Severity
                <select
                  value={edit.severity}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      severity: e.target.value as Rule["severity"],
                    })
                  }
                >
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={edit.enabled}
                  onChange={(e) =>
                    setEdit({ ...edit, enabled: e.target.checked })
                  }
                />
                Rule enabled
              </label>
              <p className="muted">
                Boolean and blocklist rules use their signal directly. Their
                threshold field is informational. Blacklist weights do not
                weaken the hard reject.
              </p>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEdit(undefined)}
                >
                  Cancel
                </button>
                <button disabled={busy}>
                  {busy ? "Saving…" : "Save rule"}
                </button>
              </div>
            </form>
          </dialog>
        </div>
      )}
    </>
  );
}
function AuditList({ data }: { data: WorkspaceData }) {
  const [search, setSearch] = useState("");
  const items = data.audit
    .slice()
    .reverse()
    .filter((x) =>
      (x.action + " " + x.actor + " " + x.entity_id)
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <Panel title={`Audit events (${items.length})`}>
      <div className="filters">
        <SearchBox value={search} set={setSearch} />
      </div>
      {items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Time</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{label(a.action)}</strong>
                  </td>
                  <td>{a.actor}</td>
                  <td className="mono">{a.entity_id.slice(0, 28)}</td>
                  <td>{date(a.timestamp)}</td>
                  <td>
                    <details>
                      <summary>View data</summary>
                      <pre className="audit-json">
                        {JSON.stringify(a.details, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}
    </Panel>
  );
}
function Profiles({ data }: { data: WorkspaceData }) {
  const [kind, setKind] = useState<
    "users" | "devices" | "recipients" | "agents"
  >("users");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>();
  useEffect(() => {
    const entity = new URLSearchParams(window.location.search).get("entity");
    if (entity) {
      setSearch(entity);
      setKind(entity.startsWith("device") ? "devices" : "recipients");
      setSelected(entity);
    }
  }, []);
  const items = data.profiles[kind].filter((p) =>
    p.id.toLowerCase().includes(search.toLowerCase()),
  );
  const field =
    kind === "users"
      ? "user_id"
      : kind === "devices"
        ? "device_id"
        : kind === "agents"
          ? "agent_id"
          : "receiver_id";
  return (
    <>
      <div className="tabs" role="tablist" aria-label="Entity type">
        {(["users", "devices", "recipients", "agents"] as const).map((k) => (
          <button
            role="tab"
            aria-selected={kind === k}
            className={kind === k ? "selected" : ""}
            key={k}
            onClick={() => {
              setKind(k);
              setSearch("");
              setSelected(undefined);
            }}
          >
            {label(k)}
          </button>
        ))}
      </div>
      <Panel title={`${label(kind)} history`}>
        <div className="filters">
          <SearchBox value={search} set={setSearch} />
        </div>
        {items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Transactions</th>
                  <th>Total value</th>
                  <th>Flagged</th>
                  <th>Peak risk</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => setSelected(p.id)}
                      >
                        {p.id}
                        <ArrowUpRight size={13} />
                      </button>
                    </td>
                    <td>{p.count}</td>
                    <td>{money(p.amount)}</td>
                    <td>{p.flagged}</td>
                    <td>{p.max_risk}/100</td>
                    <td>{p.last_seen ? date(p.last_seen) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
      {selected && (
        <Panel
          title={`Recorded activity · ${selected}`}
          action={
            <button
              className="secondary small"
              onClick={() => setSelected(undefined)}
            >
              Close
            </button>
          }
        >
          <TransactionTable
            items={data.transactions
              .filter((t) => t.payload[field] === selected)
              .slice()
              .reverse()}
          />
        </Panel>
      )}
    </>
  );
}

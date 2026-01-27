import Link from "next/link";
import NewMonitorForm from "./new-monitor-form";

export default function NewMonitorPage() {
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>New Monitor</h1>
        <Link className="button secondary" href="/monitors">
          Back to monitors
        </Link>
      </div>
      <div className="card">
        <NewMonitorForm />
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  monitorId: string;
  status: string;
};

export default function MonitorActions({ monitorId, status }: Props) {
  const router = useRouter();
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);

  const toggle = async () => {
    setToggling(true);
    const endpoint =
      status === "ACTIVE"
        ? `/api/monitors/${monitorId}/pause`
        : `/api/monitors/${monitorId}/resume`;

    await fetch(endpoint, { method: "POST" });
    router.refresh();
    setToggling(false);
  };

  return (
    <div className="row">
      <button className="button" onClick={toggle} disabled={toggling || running}>
        {status === "ACTIVE" ? "Pause" : "Resume"}
      </button>
      <button
        className="button secondary"
        onClick={async () => {
          setRunning(true);
          await fetch(`/api/monitors/${monitorId}/run`, { method: "POST" });
          router.refresh();
          setRunning(false);
        }}
        disabled={running || status !== "ACTIVE"}
        title={status !== "ACTIVE" ? "Monitor must be active to run." : undefined}
      >
        Run now
      </button>
    </div>
  );
}

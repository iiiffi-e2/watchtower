"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  monitorId: string;
  status: string;
};

export default function MonitorActions({ monitorId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    const endpoint =
      status === "ACTIVE"
        ? `/api/monitors/${monitorId}/pause`
        : `/api/monitors/${monitorId}/resume`;

    await fetch(endpoint, { method: "POST" });
    router.refresh();
    setLoading(false);
  };

  return (
    <button className="button" onClick={toggle} disabled={loading}>
      {status === "ACTIVE" ? "Pause" : "Resume"}
    </button>
  );
}

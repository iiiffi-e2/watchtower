"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MODES = ["TEXT_ONLY", "FULL_HTML", "SELECTOR"] as const;
const FREQUENCIES = ["DAILY", "WEEKLY"] as const;
const SENSITIVITIES = ["MEANINGFUL_ONLY", "ANY_CHANGE"] as const;

export default function NewMonitorForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number]>("TEXT_ONLY");
  const [selector, setSelector] = useState("");
  const [frequency, setFrequency] =
    useState<(typeof FREQUENCIES)[number]>("DAILY");
  const [sensitivity, setSensitivity] =
    useState<(typeof SENSITIVITIES)[number]>("MEANINGFUL_ONLY");
  const [ignoreSelectors, setIgnoreSelectors] = useState("");
  const [keywords, setKeywords] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || undefined,
        url,
        mode,
        selector: mode === "SELECTOR" ? selector : undefined,
        frequency,
        sensitivity,
        ignoreSelectors: ignoreSelectors
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        keywords: keywords
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Failed to create monitor.");
      setLoading(false);
      return;
    }

    router.push("/monitors");
  };

  return (
    <form onSubmit={handleSubmit} className="stack">
      <label className="field">
        Name (optional)
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="field">
        URL
        <input
          className="input"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
        />
      </label>
      <label className="field">
        Mode
        <select
          className="select"
          value={mode}
          onChange={(event) =>
            setMode(event.target.value as (typeof MODES)[number])
          }
        >
          {MODES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      {mode === "SELECTOR" && (
        <label className="field">
          CSS Selector
          <input
            className="input"
            value={selector}
            onChange={(event) => setSelector(event.target.value)}
            placeholder=".pricing-card"
            required
          />
          <span className="muted">
            Tip: Use a specific selector to avoid global changes.
          </span>
        </label>
      )}
      <label className="field">
        Frequency
        <select
          className="select"
          value={frequency}
          onChange={(event) =>
            setFrequency(event.target.value as (typeof FREQUENCIES)[number])
          }
        >
          {FREQUENCIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Sensitivity
        <select
          className="select"
          value={sensitivity}
          onChange={(event) =>
            setSensitivity(event.target.value as (typeof SENSITIVITIES)[number])
          }
        >
          {SENSITIVITIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Ignore selectors (optional)
        <textarea
          className="textarea"
          rows={3}
          value={ignoreSelectors}
          onChange={(event) => setIgnoreSelectors(event.target.value)}
          placeholder=".cookie-banner\n#promo-modal"
        />
      </label>
      <label className="field">
        Keywords filter (optional, comma-separated)
        <input
          className="input"
          value={keywords}
          onChange={(event) => setKeywords(event.target.value)}
          placeholder="pricing, trial, policy"
        />
      </label>
      {error && <div className="muted">{error}</div>}
      <button className="button" type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save monitor"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateButton({ occasionId }: { occasionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function handleClick() {
    setLoading(true);
    const res = await fetch(`/api/occasions/${occasionId}/generate`, { method: "POST" });
    const data = await res.json();
    setWarnings(data.warnings ?? []);
    setLoading(false);
    // Re-run the Server Component so the freshly generated options render
    // below (they're persisted, not just returned in this response).
    router.refresh();
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading ? "Generating..." : "Generate 3 Options"}
      </button>
      {warnings.length > 0 && (
        <ul className="warnings">
          {warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteEventButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${eventName}"? This removes every day, service, and generated menu on it — it can't be undone.`)) {
      return;
    }
    setDeleting(true);
    await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    router.push("/events");
  }

  return (
    <button type="button" className="btn-outline btn-danger" onClick={handleDelete} disabled={deleting}>
      {deleting ? "Deleting..." : "Delete Event"}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CuisineProfileForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/events/${eventId}/cuisine-profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        cuisineTags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });
    setName("");
    setTags("");
    // Re-run the Server Component's data fetch so the new profile shows up
    // without a full page reload.
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="field-grid">
      <label>
        Profile Name
        <input placeholder="e.g. Kerala Classics" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Cuisine Tags
        <input placeholder="e.g. kerala, south_indian" value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
      <button type="submit">Add Cuisine Profile</button>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { MenuItem } from "@prisma/client";

// "use client" opts this component into running in the browser too (not
// just on the server), which is what a plain useEffect + fetch needs.
// This deliberately makes a real HTTP request to our own API route instead
// of reading Prisma directly, so you can see it happen in the Network tab —
// that round-trip is the whole point of this page right now.
export default function MenuItemsPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/menu-items")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then(setMenuItems)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p>Failed to load menu items: {error}</p>;
  if (!menuItems) return <p>Loading...</p>;

  return (
    <div className="page">
      <h1>Menu Items</h1>
      <ul className="list-plain">
        {menuItems.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}

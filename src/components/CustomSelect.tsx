"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type CustomSelectOption = { value: string; label: string };

// Replaces the native <select> everywhere in the app — on Windows, Chrome
// renders a native select's *closed* box using page CSS, but the
// *expanded* option list is drawn by the OS's own widget and ignores the
// page's font/colors/background entirely (confirmed directly — CSS
// targeting `select option` had no effect on Windows Chrome specifically).
//
// The open option list is rendered through a portal straight into
// document.body, positioned by the trigger button's actual screen
// coordinates — not as a plain absolutely-positioned child of the
// trigger. Nested inside AddOccasionModal's scrollable `.modal-box`, a
// plain absolute-positioned child gets clipped by that ancestor's own
// overflow/scroll boundary the moment the trigger is near the bottom of
// the modal (confirmed directly — that's exactly what cut the list off).
// A portal escapes that clipping entirely, the same fix in spirit as
// using position:fixed for the modal overlay itself.
export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  // Portals need a real document to render into — this is only true once
  // mounted client-side, guarding against a server-render mismatch.
  useEffect(() => setMounted(true), []);

  function updateMenuRect() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setMenuRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }

  function toggleOpen() {
    if (!open) updateMenuRect();
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;

    // The trigger and the portaled menu are siblings in the DOM once
    // portaled (the menu is no longer a descendant of the trigger's
    // wrapper), so "outside click" has to check both explicitly.
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // The modal (or page) can scroll while the menu is open — keep the
    // portaled menu glued to the trigger rather than left floating behind.
    function handleReposition() {
      updateMenuRect();
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="custom-select">
      <button
        ref={triggerRef}
        type="button"
        className="custom-select-trigger"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label ?? placeholder ?? "Select..."}</span>
        <span className="custom-select-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && mounted && menuRect &&
        createPortal(
          <ul
            ref={menuRef}
            className="custom-select-menu"
            role="listbox"
            style={{ position: "fixed", top: menuRect.top, left: menuRect.left, width: menuRect.width }}
          >
            {options.map((opt) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={`custom-select-option${opt.value === value ? " selected" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}

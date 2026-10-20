"use client";

import { useState } from "react";
import { CommandPalette } from "@/components/site/CommandPalette";

export default function PalettePreviewPage() {
  const [open, setOpen] = useState(true);
  return (
    <main style={{ minHeight: "100vh", background: "#050810", color: "#eef2fb", padding: 40 }}>
      <p>Предпросмотр палитры</p>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </main>
  );
}
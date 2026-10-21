"use client";

import { useEffect } from "react";

import { startCloudSync } from "@/lib/cloud";

/** Включает фоновую синхронизацию с сервером (ничего не рисует) */
export default function CloudSync() {
  useEffect(() => {
    startCloudSync();
  }, []);
  return null;
}

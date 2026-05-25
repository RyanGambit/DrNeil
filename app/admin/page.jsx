"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The original /admin page queried lib/store.js — an in-memory Map that
// never persists on Vercel. All real session data lives in /admin/testers
// (KV-backed). Forward there so the broken view doesn't mislead anyone.
export default function AdminRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/testers");
  }, [router]);
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5FBF9", fontFamily: "-apple-system, 'Segoe UI', sans-serif", color: "#506D65" }}>
      Loading admin…
    </div>
  );
}

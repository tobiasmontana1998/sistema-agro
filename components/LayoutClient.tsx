"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !pathname.startsWith("/login");

  return (
    <>
      {showSidebar && <Sidebar />}
      <main className={`flex-1 overflow-y-auto min-h-screen ${showSidebar ? "p-6 sm:p-8" : ""}`}>
        {children}
      </main>
    </>
  );
}
import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { PlanProvider } from "@/context/PlanContext";

export const metadata: Metadata = {
  title: "UrjaSetu — Urban Infrastructure Siting & Impact Analysis",
  description:
    "Evidence-backed, map-based urban infrastructure siting and impact analysis decision-support tool.",
};

import { TourProvider } from "@/walkthrough/engine/TourProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <PlanProvider>
          <TourProvider>
            <ToastProvider>{children}</ToastProvider>
          </TourProvider>
        </PlanProvider>
      </body>
    </html>
  );
}

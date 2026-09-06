import AppSidebar from "@/components/layout/AppSidebar";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { Navbar } from "@/components/layout/Navbar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-background">
      {/* Sidebar Desktop (Full Height dari atas sampai bawah di sisi kiri) */}
      <AppSidebar />

      {/* Kolom Kanan: Header (sejajar di samping sidebar) & Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Navbar />
        <main className="flex-1 overflow-y-auto pb-24 md:pb-6 w-full max-w-full">
          {children}
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    // Full viewport height minus bottom nav, no scroll
    <div className="h-[calc(100vh-4rem)] w-screen overflow-hidden relative -mb-16">
      {children}
    </div>
  );
}

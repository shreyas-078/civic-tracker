export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    // Full viewport, compensate for bottom nav
    <div className="h-[calc(100vh-4rem)] w-screen overflow-hidden relative -mb-16">
      {children}
    </div>
  );
}

import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import { Navbar, Sidebar } from "../components/layout";

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleMenuClick = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleToggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  return (
    <div className="min-h-screen bg-apple-gray overflow-x-clip">
      <Navbar onMenuClick={handleMenuClick} isSidebarOpen={isSidebarOpen} />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* Main content com padding responsivo */}
      <main
        className={`pt-16 min-h-dvh transition-[padding-left] duration-300 ${
          isSidebarCollapsed ? "lg:pl-15" : "lg:pl-60"
        }`}
      >
        <div className="mx-auto max-w-7xl p-3 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

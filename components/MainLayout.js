'use client';

import Sidebar from "./Sidebar";
import { useAuth } from "./AuthProvider";
import { usePathname } from "next/navigation";

export default function MainLayout({ children }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  
  const isLoginPage = pathname === '/login';

  // If on login page, just show children
  if (isLoginPage) {
    return <>{children}</>;
  }

  // If loading or not logged in (and not on login page, though AuthProvider handles redirect),
  // showing the children directly might cause a flash, but AuthProvider has its own loading indicator
  // If we have a user, show the full layout with Sidebar
  if (user) {
    return (
      <div className="appLayout">
        <Sidebar />
        <main className="mainContent">{children}</main>
      </div>
    );
  }

  return <>{children}</>;
}

import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";

export const metadata = {
  title: "Sarpras Digital Attanwir",
  description:
    "Sistem Manajemen Sarana dan Prasarana Digital Pondok Pesantren Attanwir",
  manifest: "/manifest.json",
  themeColor: "#2563eb",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sarpras",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Sarpras" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body>
        <ToastProvider>
          <div className="appLayout">
            <Sidebar />
            <main className="mainContent">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}

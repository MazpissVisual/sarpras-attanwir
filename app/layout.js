import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/components/AuthProvider";
import MainLayout from "@/components/MainLayout";

export const metadata = {
  title: "Sarpras Digital Attanwir",
  description:
    "Sistem Manajemen Sarana dan Prasarana Digital Pondok Pesantren Attanwir",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sarpras",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Sarpras" />
      </head>
      <body suppressHydrationWarning>
        <ToastProvider>
          <AuthProvider>
            <MainLayout>
              {children}
            </MainLayout>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

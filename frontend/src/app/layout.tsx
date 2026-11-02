import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'sbes.erp – Shahbabu Educational Society Attendance ERP',
  description: 'Enterprise Biometric & RFID Attendance ERP Portal. Developed by Abdul Wahab.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-[#F5F2ED] text-[#0D0D0D] antialiased min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

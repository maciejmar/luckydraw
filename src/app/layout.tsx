import type { Metadata } from 'next';
// Removed Geist font imports
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Header from '@/components/Header';

// Removed geistSans and geistMono font instantiations

export const metadata: Metadata = {
  title: 'LuckyDraw - Fair Winner Selection',
  description: 'Create and participate in draws with AI-powered fair winner selection.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Removed font variables from body className */}
      <body className={`antialiased flex flex-col min-h-screen`}>
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}

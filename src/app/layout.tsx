import type { Metadata } from "next";

import "~/app/globals.css";
import { Providers } from "~/app/providers";
import { IBM_Plex_Mono } from 'next/font/google';

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
});

export const metadata: Metadata = {
  title: 'reward.wtf',
  description: 'trade with friends',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexMono.variable} text-zinc-400 bg-black`}>
      <body className="font-mono lowercase">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

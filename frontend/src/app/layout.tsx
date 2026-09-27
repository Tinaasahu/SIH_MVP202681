import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'नभदृष्टि — Forecast Intelligence | PS 202681',
  description:
    'नभदृष्टि: AI–NWP Multi-Model Forecast Blending System. Dynamically blended weather forecasts for India. Built for Smart India Hackathon 2026, Ministry of Earth Sciences.',
  keywords: 'नभदृष्टि, NabhDrishti, weather forecast, NWP, AI, blending, NCMRWF, MoES, India',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

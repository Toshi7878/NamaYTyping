import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/theme/globals.css";
import { TooltipProvider } from "@repo/ui/tooltip";
import { headers } from "next/headers";
import { THEME_LIST } from "@/theme/const";
import { AppAtomsHydrator } from "./_layout/hydrate";
import { PreviewYouTubePlayer } from "./_layout/preview-youtube";
import { ThemeProvider } from "./_layout/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "namaYTyping - リザルト",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userAgent = (await headers()).get("user-agent") ?? "";

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="default"
        enableColorScheme
        disableTransitionOnChange
        themes={[
          ...THEME_LIST.dark.map((theme) => theme.class),
          ...THEME_LIST.light.map((theme) => theme.class),
        ]}
      >
        <AppAtomsHydrator userAgent={userAgent}>
          <TooltipProvider>
            <body className="min-h-full flex flex-col">
              <main
                className="min-h-screen pt-12 pb-6 md:pt-16"
                id="main_content"
              >
                {children}
              </main>
              <PreviewYouTubePlayer />
            </body>
          </TooltipProvider>
        </AppAtomsHydrator>
      </ThemeProvider>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AWS NEXUS // Interactive Cloud Visualizer",
  description:
    "Fully graphical interactive web experience for AWS: Global Infrastructure, IAM, S3, VPC, EC2, ELB, Lambda, API Gateway, SNS, SQS and CloudFront — visualized in real-time 3D and animated flow diagrams.",
  keywords: [
    "AWS",
    "visualizer",
    "cloud",
    "Three.js",
    "interactive",
    "IAM",
    "S3",
    "VPC",
    "EC2",
    "Lambda",
    "CloudFront",
  ],
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#050508",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${jetbrains.variable} antialiased bg-background text-foreground font-mono min-h-screen flex flex-col`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

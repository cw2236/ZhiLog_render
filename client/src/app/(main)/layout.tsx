import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider, ThemeProvider } from "@/lib/providers";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "ZhiLog - AI Paper Reading Assistant",
	description: "Your AI Paper Reading Assistant for Efficient Academic Research",
	icons: {
		icon: "/icon.svg"
	},
	openGraph: {
		title: "ZhiLog - AI Paper Reading Assistant",
		description: "Your AI Paper Reading Assistant for Efficient Academic Research",
		images: [
			{
				url: "https://assets.khoj.dev/openpaper/hero_open_paper2.png",
				width: 1280,
				height: 640,
				alt: "ZhiLog",
			}
		],
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "ZhiLog - AI Paper Reading Assistant",
		description: "Your AI Paper Reading Assistant for Efficient Academic Research",
		images: ["https://assets.khoj.dev/openpaper/hero_open_paper2.png"],
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<PostHogProvider>
						<AuthProvider>
							<div className="flex h-screen">
								<AppSidebar />
								<main className="flex-1 overflow-hidden">
									{children}
								</main>
							</div>
							<Toaster />
						</AuthProvider>
					</PostHogProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}

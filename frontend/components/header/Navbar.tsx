"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const Navbar = () => {
	const [open, setOpen] = useState(false);
	const { theme, resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const logoSrc = mounted && (theme === "dark" || resolvedTheme === "dark")
		? "/logo2.png"
		: "/images/paz/logo.png";

	return (
		<nav className="fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
			<div className="container mx-auto flex h-16 items-center justify-between px-4">
				<Link href="/" className="flex items-center gap-2">
					<div className="h-10 flex items-center">
						<Image
							src={logoSrc}
							alt="Pazimo"
							width={160}
							height={80}
							className="max-h-full w-auto object-contain"
							priority
						/>
					</div>
				</Link>

				<div className="hidden items-center gap-8 md:flex">
					<a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
						Features
					</a>
					<a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
						Pricing
					</a>
					<a href="#about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
						About
					</a>
					<Button asChild size="sm" className="font-semibold">
						<Link href="/organizer-registration">Get Started</Link>
					</Button>
				</div>

				<button type="button" onClick={() => setOpen(!open)} className="text-foreground md:hidden" aria-label="Toggle menu">
					{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
				</button>
			</div>

			{open && (
				<div className="flex flex-col gap-4 border-b border-border bg-background p-6 md:hidden">
					<a href="#features" onClick={() => setOpen(false)} className="text-muted-foreground">
						Features
					</a>
					<a href="#pricing" onClick={() => setOpen(false)} className="text-muted-foreground">
						Pricing
					</a>
					<a href="#about" onClick={() => setOpen(false)} className="text-muted-foreground">
						About
					</a>
					<Button asChild className="w-full font-semibold">
						<Link href="/create-event" onClick={() => setOpen(false)}>
							Get Started
						</Link>
					</Button>
				</div>
			)}
		</nav>
	);
};

export default Navbar;

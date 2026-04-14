"use client";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/Logo";
import { trackLoginAttempt } from "@/lib/posthog/events";
import { AmbientBackground } from "./AmbientBackground";

function NextcloudIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="currentColor"
			className={className}
		>
			<title>Nextcloud</title>
			<path d="M12.018 6.537c-2.5 0-4.6 1.712-5.241 4.015-.56-1.147-1.748-1.946-3.127-1.946C1.636 8.606 0 10.242 0 12.256s1.636 3.65 3.65 3.65c1.379 0 2.567-.8 3.127-1.946.641 2.303 2.741 4.015 5.241 4.015 2.5 0 4.6-1.712 5.241-4.015.56 1.147 1.748 1.946 3.127 1.946 2.014 0 3.65-1.636 3.65-3.65s-1.636-3.65-3.65-3.65c-1.379 0-2.567.8-3.127 1.946-.641-2.303-2.741-4.015-5.241-4.015zm0 2.449c1.7 0 3.074 1.374 3.074 3.074v.392c0 1.7-1.374 3.074-3.074 3.074s-3.074-1.374-3.074-3.074v-.392c0-1.7 1.374-3.074 3.074-3.074zm-8.368 2.069c.663 0 1.201.538 1.201 1.201s-.538 1.201-1.201 1.201-1.201-.538-1.201-1.201.538-1.201 1.201-1.201zm16.736 0c.663 0 1.201.538 1.201 1.201s-.538 1.201-1.201 1.201-1.201-.538-1.201-1.201.538-1.201 1.201-1.201z" />
		</svg>
	);
}

export function NextcloudLoginButton() {
	const t = useTranslations("auth");

	const handleNextcloudLogin = () => {
		trackLoginAttempt("nextcloud");

		// Use the redirect-based authorize endpoint for cross-origin OAuth
		// Same pattern as Google OAuth - fixes CSRF cookie issues in Firefox/Safari
		window.location.href = `${process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL}/auth/nextcloud/authorize-redirect`;
	};

	return (
		<div className="relative w-full overflow-hidden">
			<AmbientBackground />
			<div className="mx-auto flex h-screen max-w-lg flex-col items-center justify-center px-6 md:px-0">
				<Logo className="h-16 w-16 md:h-32 md:w-32 rounded-full my-4 md:my-8 transition-all" />
				<motion.button
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
					className="group/btn relative flex w-full items-center justify-center space-x-2 rounded-lg bg-white px-6 py-3 md:py-4 text-neutral-700 shadow-lg transition-all duration-200 hover:shadow-xl dark:bg-neutral-800 dark:text-neutral-200"
					onClick={handleNextcloudLogin}
				>
					<div className="absolute inset-0 h-full w-full transform opacity-0 transition duration-200 group-hover/btn:opacity-100">
						<div className="absolute -left-px -top-px h-4 w-4 rounded-tl-lg border-l-2 border-t-2 border-blue-500 bg-transparent transition-all duration-200 group-hover/btn:-left-2 group-hover/btn:-top-2"></div>
						<div className="absolute -right-px -top-px h-4 w-4 rounded-tr-lg border-r-2 border-t-2 border-blue-500 bg-transparent transition-all duration-200 group-hover/btn:-right-2 group-hover/btn:-top-2"></div>
						<div className="absolute -bottom-px -left-px h-4 w-4 rounded-bl-lg border-b-2 border-l-2 border-blue-500 bg-transparent transition-all duration-200 group-hover/btn:-bottom-2 group-hover/btn:-left-2"></div>
						<div className="absolute -bottom-px -right-px h-4 w-4 rounded-br-lg border-b-2 border-r-2 border-blue-500 bg-transparent transition-all duration-200 group-hover/btn:-bottom-2 group-hover/btn:-right-2"></div>
					</div>
					<NextcloudIcon className="h-5 w-5 text-[#0082c9] dark:text-[#00a4f5]" />
					<span className="text-base font-medium">{t("continue_with_nextcloud")}</span>
				</motion.button>
			</div>
		</div>
	);
}

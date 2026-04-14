"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/Logo";
import { trackLoginAttempt, trackLoginSuccess } from "@/lib/posthog/events";
import { setBearerToken, setRefreshToken, getAndClearRedirectPath } from "@/lib/auth-utils";
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
	const searchParams = useSearchParams();
	const [isPolling, setIsPolling] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const popupRef = useRef<Window | null>(null);
	const pollKeyRef = useRef<string | null>(null);
	const autoLoginTriggered = useRef(false);

	// Clean up on unmount
	useEffect(() => {
		return () => {
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
			}
		};
	}, []);

	const stopPolling = useCallback(() => {
		if (pollIntervalRef.current) {
			clearInterval(pollIntervalRef.current);
			pollIntervalRef.current = null;
		}
		setIsPolling(false);
	}, []);

	const handleTokenReceived = useCallback((accessToken: string, refreshToken: string) => {
		stopPolling();

		// Close popup if still open
		if (popupRef.current && !popupRef.current.closed) {
			popupRef.current.close();
		}

		// Store tokens
		localStorage.setItem("surfsense_bearer_token", accessToken);
		setBearerToken(accessToken);
		if (refreshToken) {
			setRefreshToken(refreshToken);
		}

		trackLoginSuccess("nextcloud");

		// Navigate to dashboard (or saved redirect path)
		const savedPath = getAndClearRedirectPath();
		window.location.href = savedPath || "/dashboard";
	}, [stopPolling]);

	const startPolling = useCallback((pollKey: string) => {
		const backendUrl = process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL;
		let attempts = 0;
		const maxAttempts = 150; // 5 minutes at 2s intervals

		pollIntervalRef.current = setInterval(async () => {
			attempts++;

			// Check if popup was closed by user
			if (popupRef.current && popupRef.current.closed) {
				stopPolling();
				setError(null);
				return;
			}

			// Timeout after max attempts
			if (attempts >= maxAttempts) {
				stopPolling();
				setError("Authentication timed out. Please try again.");
				if (popupRef.current && !popupRef.current.closed) {
					popupRef.current.close();
				}
				return;
			}

			try {
				const response = await fetch(
					`${backendUrl}/auth/nextcloud/poll-token?key=${encodeURIComponent(pollKey)}`,
					{ method: "GET" }
				);

				if (response.ok) {
					const data = await response.json();
					if (data.status === "ready" && data.access_token) {
						handleTokenReceived(data.access_token, data.refresh_token || "");
					}
				}
				// 202 = still pending, keep polling
			} catch {
				// Network error, keep polling (might be temporary)
			}
		}, 2000);
	}, [stopPolling, handleTokenReceived]);

	const handleNextcloudLogin = useCallback(() => {
		trackLoginAttempt("nextcloud");
		setError(null);

		// Generate a unique poll key
		const pollKey = crypto.randomUUID();
		pollKeyRef.current = pollKey;

		const backendUrl = process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL;
		const authorizeUrl = `${backendUrl}/auth/nextcloud/authorize-redirect?poll_key=${encodeURIComponent(pollKey)}`;
		// Fallback URL without poll_key for same-window redirects.
		// Without poll_key, the backend won't intercept the callback redirect,
		// allowing the normal /auth/callback flow to work.
		const fallbackUrl = `${backendUrl}/auth/nextcloud/authorize-redirect`;

		// Detect if we're in an iframe (e.g., Nextcloud external sites)
		const isInIframe = window.self !== window.top;

		if (isInIframe) {
			// In iframe: try opening a new tab to break out of the iframe
			const newTab = window.open(authorizeUrl, "_blank");
			if (newTab) {
				setIsPolling(true);
				startPolling(pollKey);
				return;
			}
			// If new tab blocked too, fall back to same-window redirect without poll_key
			window.location.href = fallbackUrl;
			return;
		}

		// Open popup window for OAuth flow
		const width = 600;
		const height = 700;
		const left = window.screenX + (window.outerWidth - width) / 2;
		const top = window.screenY + (window.outerHeight - height) / 2;

		const popup = window.open(
			authorizeUrl,
			"nextcloud-oauth",
			`width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=yes,status=no`
		);

		if (!popup || popup.closed) {
			// Popup blocked — fall back to same-window redirect without poll_key
			window.location.href = fallbackUrl;
			return;
		}

		popupRef.current = popup;
		setIsPolling(true);

		// Start polling for the token
		startPolling(pollKey);
	}, [startPolling]);

	// Auto-login: trigger OAuth flow automatically when:
	// 1. ?auto=1 is in the URL, OR
	// 2. We're loaded inside an iframe (e.g., Nextcloud external sites app)
	useEffect(() => {
		if (autoLoginTriggered.current) return;
		const auto = searchParams.get("auto");
		const isInIframe = typeof window !== "undefined" && window.self !== window.top;
		if (auto === "1" || isInIframe) {
			autoLoginTriggered.current = true;
			// Small delay to ensure component is fully mounted
			const timer = setTimeout(() => {
				handleNextcloudLogin();
			}, 500);
			return () => clearTimeout(timer);
		}
	}, [searchParams, handleNextcloudLogin]);

	return (
		<div className="relative w-full overflow-hidden">
			<AmbientBackground />
			<div className="mx-auto flex h-screen max-w-lg flex-col items-center justify-center px-6 md:px-0">
				<Logo className="h-16 w-16 md:h-32 md:w-32 rounded-full my-4 md:my-8 transition-all" />
				<motion.button
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
					className="group/btn relative flex w-full items-center justify-center space-x-2 rounded-lg bg-white px-6 py-3 md:py-4 text-neutral-700 shadow-lg transition-all duration-200 hover:shadow-xl dark:bg-neutral-800 dark:text-neutral-200 disabled:opacity-60 disabled:cursor-wait"
					onClick={handleNextcloudLogin}
					disabled={isPolling}
				>
					<div className="absolute inset-0 h-full w-full transform opacity-0 transition duration-200 group-hover/btn:opacity-100">
						<div className="absolute -left-px -top-px h-4 w-4 rounded-tl-lg border-l-2 border-t-2 border-blue-500 bg-transparent transition-all duration-200 group-hover/btn:-left-2 group-hover/btn:-top-2"></div>
						<div className="absolute -right-px -top-px h-4 w-4 rounded-tr-lg border-r-2 border-t-2 border-blue-500 bg-transparent transition-all duration-200 group-hover/btn:-right-2 group-hover/btn:-top-2"></div>
						<div className="absolute -bottom-px -left-px h-4 w-4 rounded-bl-lg border-b-2 border-l-2 border-blue-500 bg-transparent transition-all duration-200 group-hover/btn:-bottom-2 group-hover/btn:-left-2"></div>
						<div className="absolute -bottom-px -right-px h-4 w-4 rounded-br-lg border-b-2 border-r-2 border-blue-500 bg-transparent transition-all duration-200 group-hover/btn:-bottom-2 group-hover/btn:-right-2"></div>
					</div>
					{isPolling ? (
						<>
							<svg className="h-5 w-5 animate-spin text-[#0082c9] dark:text-[#00a4f5]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							<span className="text-base font-medium">Waiting for Nextcloud...</span>
						</>
					) : (
						<>
							<NextcloudIcon className="h-5 w-5 text-[#0082c9] dark:text-[#00a4f5]" />
							<span className="text-base font-medium">{t("continue_with_nextcloud")}</span>
						</>
					)}
				</motion.button>
				{error && (
					<p className="mt-3 text-sm text-red-500 dark:text-red-400">{error}</p>
				)}
				{isPolling && (
					<button
						onClick={() => {
							stopPolling();
							if (popupRef.current && !popupRef.current.closed) {
								popupRef.current.close();
							}
						}}
						className="mt-3 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 underline"
					>
						Cancel
					</button>
				)}
			</div>
		</div>
	);
}

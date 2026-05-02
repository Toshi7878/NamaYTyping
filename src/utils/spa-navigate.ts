import { useEffect, useState } from "react";
import { monkeyWindow } from "$";

interface NavigationInfo {
	pathname: string;
	href: string;
}

type NavigationListener = (info: NavigationInfo) => void;

function createSPANavigate() {
	const listeners = new Set<NavigationListener>();

	function dispatch(): void {
		const info: NavigationInfo = {
			pathname: location.pathname,
			href: location.href,
		};
		for (const fn of listeners) {
			try {
				fn(info);
			} catch (e) {
				console.error("[SPANavigate]", e);
			}
		}
	}

	const originalPush = history.pushState.bind(history);
	const originalReplace = history.replaceState.bind(history);

	history.pushState = (...args: Parameters<typeof history.pushState>) => {
		originalPush(...args);
		dispatch();
	};

	history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
		originalReplace(...args);
		dispatch();
	};

	monkeyWindow.addEventListener("popstate", dispatch);
	monkeyWindow.addEventListener("load", dispatch);

	return {
		on(fn: NavigationListener): void {
			listeners.add(fn);
		},
		off(fn: NavigationListener): void {
			listeners.delete(fn);
		},
	};
}

const SPANavigate = createSPANavigate();

export function usePathname(): string {
	const [pathname, setPathname] = useState(() => location.pathname);

	useEffect(() => {
		function update({ pathname }: NavigationInfo) {
			setPathname(pathname);
		}
		SPANavigate.on(update);
		return () => SPANavigate.off(update);
	}, []);

	return pathname;
}

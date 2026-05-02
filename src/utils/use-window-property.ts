import { useEffect, useState } from "react";

export function useWindowProperty<K extends keyof Window>(
	key: K,
): Window[K] | undefined {
	const [value, setValue] = useState<Window[K] | undefined>(() => window[key]);

	useEffect(() => {
		if (window[key] !== undefined) {
			setValue(window[key]);
			return;
		}

		Object.defineProperty(window, key, {
			configurable: true,
			set(newValue: Window[K]) {
				Object.defineProperty(window, key, {
					configurable: true,
					writable: true,
					value: newValue,
				});
				setValue(newValue);
			},
		});

		return () => {
			const desc = Object.getOwnPropertyDescriptor(window, key);
			if (desc?.set) {
				delete (window as unknown as Record<string, unknown>)[key as string];
			}
		};
	}, [key]);

	return value;
}

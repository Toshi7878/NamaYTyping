import { useEffect, useState } from "react";
import { unsafeWindow } from "$";

export function useWindowProperty<K extends keyof Window>(
	key: K,
): Window[K] | undefined {
	const [value, setValue] = useState<Window[K] | undefined>(
		() => unsafeWindow[key],
	);

	useEffect(() => {
		if (unsafeWindow[key] !== undefined) {
			setValue(unsafeWindow[key]);
			return;
		}

		Object.defineProperty(unsafeWindow, key, {
			configurable: true,
			set(newValue: Window[K]) {
				Object.defineProperty(unsafeWindow, key, {
					configurable: true,
					writable: true,
					value: newValue,
				});
				setValue(newValue);
			},
		});

		return () => {
			const desc = Object.getOwnPropertyDescriptor(unsafeWindow, key);
			if (desc?.set) {
				delete (unsafeWindow as unknown as Record<string, unknown>)[
					key as string
				];
			}
		};
	}, [key]);

	return value;
}

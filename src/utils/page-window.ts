declare const unsafeWindow: Window;

export const pageWindow: Window = new Function("return unsafeWindow")() as Window;

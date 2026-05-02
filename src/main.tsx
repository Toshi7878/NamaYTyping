import ReactDOM from "react-dom/client";
import App from "./App";
import styles from "./index.css?inline";
import { createShadowRoot } from "./utils/create-shadow-root";

const { mountPoint } = createShadowRoot(styles, {
	position: "fixed",
	bottom: "16px",
	right: "16px",
	zIndex: "2147483647",
});

// StrictMode は使わない — useEffect の二重実行で IME リスナーが重複するため
ReactDOM.createRoot(mountPoint).render(<App />);

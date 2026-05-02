import ReactDOM from "react-dom/client";
import App from "./App";
import styles from "./index.css?inline";
import { createShadowRoot } from "./utils/create-shadow-root";

const { mountPoint } = createShadowRoot(styles);
ReactDOM.createRoot(mountPoint).render(<App />);

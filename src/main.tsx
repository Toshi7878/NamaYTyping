import styles from './index.css?inline';
import ReactDOM from 'react-dom/client';
import App from './App';

const host = document.createElement('div');
Object.assign(host.style, {
  position: 'fixed',
  bottom: '16px',
  right: '16px',
  zIndex: '2147483647',
});

const shadow = host.attachShadow({ mode: 'open' });
const styleEl = document.createElement('style');
styleEl.textContent = styles;
shadow.appendChild(styleEl);
const mountPoint = document.createElement('div');
shadow.appendChild(mountPoint);

document.documentElement.appendChild(host);

// StrictMode は使わない — useEffect の二重実行で IME リスナーが重複するため
ReactDOM.createRoot(mountPoint).render(<App host={host} />);

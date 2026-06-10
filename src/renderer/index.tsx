import '@vitejs/plugin-react/preamble';
import './App.css';
import { createRoot } from 'react-dom/client';
import App from './App';

const logs: string[] = [];
const originalLog = console.log;

const logWithCapture = (...args: any[]) => {
	const msg = args
		.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
		.join(' ');
	logs.push(msg);
	originalLog(...args);
};

const container = document.getElementById('root');

if (!container) {
	logWithCapture('ERROR: Root element not found!');
	throw new Error('Root element #root not found');
}

try {
	const root = createRoot(container);
	root.render(<App />);
} catch (error) {
	logWithCapture('ERROR during React render:', error);
	throw error;
}

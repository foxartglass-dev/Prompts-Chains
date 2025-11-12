
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import App from './App';

const convexUrl = import.meta.env.VITE_CONVEX_URL;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Initialize Convex client if URL is configured
let client: ConvexReactClient | null = null;
if (convexUrl) {
  client = new ConvexReactClient(convexUrl);
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {client ? (
      <ConvexProvider client={client}>
        <App />
      </ConvexProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Resolved at build time by Vite from .env.production / .env.local
// Production → set VITE_API_BASE_URL=https://your-backend.onrender.com
// Development → "" (Vite proxy handles /api → localhost:8000)
const apiUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

if (apiUrl) {
    setBaseUrl(apiUrl);
    console.info("[AgentCraft] API →", apiUrl);
} else {
    console.info("[AgentCraft] API → /api (via Vite proxy)");
}

createRoot(document.getElementById("root")!).render(<App />);

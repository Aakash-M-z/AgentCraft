import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// In production (deployed on Render/Vercel/etc.) point at the backend URL.
// In dev the Vite proxy handles /api → localhost:3001, so no base URL needed.
const backendUrl = import.meta.env.VITE_API_URL;
if (backendUrl) {
    setBaseUrl(backendUrl);
    console.info("[AgentCraft] API base URL:", backendUrl);
}

createRoot(document.getElementById("root")!).render(<App />);

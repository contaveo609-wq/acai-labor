// Explicit opt-in: demo calls never reach the original restaurant's database.
export const DEMO_MODE = import.meta.env["VITE_DEMO_MODE"] === "true";

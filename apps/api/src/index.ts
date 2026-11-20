import { createApp } from "./app.ts";

// Vercel picks up the default export of src/index.ts as the Express app.
const app = createApp();
export default app;

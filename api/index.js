// Vercel serverless entrypoint. The Express app lives in backend/server.js
// and is exported without calling .listen() when VERCEL=1 is set — so
// importing it here just gives us a request handler we can re-export.
import app from "../backend/server.js";

export default app;

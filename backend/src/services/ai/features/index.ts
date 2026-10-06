/**
 * Every AI feature module, imported once so their job handlers register
 * before any job can run (server.ts imports this at boot).
 */
import "./postingRead.js";
import "./fitCheck.js";
import "./resumeImport.js";
import "./resumeTailor.js";
import "../../email/inboxScan.js";

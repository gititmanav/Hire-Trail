import Papa from "papaparse";
import type { Application, Stage } from "../types";

const STAGES: Stage[] = ["Applied", "OA", "Interview", "Offer", "Rejected"];

export interface CSVRow {
  company: string;
  role: string;
  jobUrl: string;
  stage: Stage;
  notes: string;
  applicationDate: string;
}

/**
 * Export applications to CSV and trigger download
 */
export function exportToCSV(applications: Application[], filename = "hiretrail-applications.csv") {
  const rows = applications.map((app) => ({
    Company: app.company,
    Role: app.role,
    Stage: app.stage,
    "Job URL": app.jobUrl || "",
    "Application Date": new Date(app.applicationDate).toLocaleDateString("en-US"),
    Notes: app.notes || "",
  }));

  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV file into application rows
 * Returns { data, errors } — errors contain row-level issues
 */
export function parseCSV(
  file: File
): Promise<{ data: CSVRow[]; errors: string[] }> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
      complete: (results) => {
        const data: CSVRow[] = [];
        const errors: string[] = [];

        results.data.forEach((row: any, index: number) => {
          const rowNum = index + 2; // +2 for header row + 0-index

          // Try to match common column names
          const company =
            row["Company"] || row["company"] || row["Company Name"] || "";
          const role =
            row["Role"] || row["role"] || row["Position"] || row["Title"] || "";
          const jobUrl =
            row["Job URL"] || row["jobUrl"] || row["URL"] || row["Link"] || "";
          const stage =
            row["Stage"] || row["stage"] || row["Status"] || "Applied";
          const notes =
            row["Notes"] || row["notes"] || row["Comments"] || "";
          const applicationDate =
            row["Application Date"] || row["applicationDate"] || row["Date"] || "";

          if (!company.trim()) {
            errors.push(`Row ${rowNum}: Missing company name`);
            return;
          }
          if (!role.trim()) {
            errors.push(`Row ${rowNum}: Missing role`);
            return;
          }

          // Validate stage
          const normalizedStage = STAGES.find(
            (s) => s.toLowerCase() === stage.trim().toLowerCase()
          );
          if (!normalizedStage) {
            errors.push(
              `Row ${rowNum}: Invalid stage "${stage}" — must be one of: ${STAGES.join(", ")}`
            );
            return;
          }

          data.push({
            company: company.trim(),
            role: role.trim(),
            jobUrl: jobUrl.trim(),
            stage: normalizedStage,
            notes: notes.trim(),
            applicationDate: applicationDate.trim() || new Date().toISOString(),
          });
        });

        resolve({ data, errors });
      },
      error: (err: Error) => {
        resolve({ data: [], errors: [`Failed to parse CSV: ${err.message}`] });
      },
    });
  });
}

/**
 * Generate a template CSV for users to fill out
 */
export function downloadTemplate() {
  const csv = Papa.unparse({
    fields: ["Company", "Role", "Job URL", "Stage", "Application Date", "Notes"],
    data: [
      ["Google", "SWE Intern", "https://careers.google.com/123", "Applied", "2025-03-15", "Referral from alumni"],
      ["Meta", "Backend Engineer Intern", "https://metacareers.com/456", "OA", "2025-03-10", ""],
      ["Stripe", "Full Stack Intern", "", "Interview", "2025-03-01", "Phone screen completed"],
    ],
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hiretrail-import-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
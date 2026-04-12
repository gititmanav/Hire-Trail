import { Router } from "express";
import { ensureAuth } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
const router = Router();
router.use(ensureAuth);
// GET /api/jobs/search?query=...&page=1&location=...&remote=true
router.get("/search", async (req, res, next) => {
    try {
        if (!env.JSEARCH_API_KEY) {
            throw new AppError("Job search is not configured. Add JSEARCH_API_KEY to enable.", 503);
        }
        const query = req.query.query || "software engineer intern";
        const page = parseInt(req.query.page) || 1;
        const location = req.query.location || "";
        const remote = req.query.remote === "true";
        const datePosted = req.query.datePosted || "all";
        const params = new URLSearchParams({
            query: location ? `${query} in ${location}` : query,
            page: String(page),
            num_pages: "1",
            date_posted: datePosted,
        });
        if (remote)
            params.set("remote_jobs_only", "true");
        const response = await fetch(`https://jsearch.p.rapidapi.com/search?${params.toString()}`, {
            headers: {
                "X-RapidAPI-Key": env.JSEARCH_API_KEY,
                "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
            },
        });
        if (!response.ok) {
            const text = await response.text();
            console.error("JSearch error:", response.status, text);
            throw new AppError("Job search service unavailable", 502);
        }
        const data = await response.json();
        // Map RapidAPI/JSearch payload to a stable client shape
        const jobs = (data.data || []).map((job) => ({
            id: job.job_id,
            title: job.job_title,
            company: job.employer_name,
            companyLogo: job.employer_logo,
            location: job.job_city
                ? `${job.job_city}${job.job_state ? `, ${job.job_state}` : ""}${job.job_country ? `, ${job.job_country}` : ""}`
                : job.job_country || "Remote",
            remote: job.job_is_remote,
            type: job.job_employment_type,
            description: job.job_description?.slice(0, 500) || "",
            fullDescription: job.job_description || "",
            applyUrl: job.job_apply_link || "",
            postedAt: job.job_posted_at_datetime_utc,
            salary: job.job_min_salary && job.job_max_salary
                ? `$${Math.round(job.job_min_salary / 1000)}k–$${Math.round(job.job_max_salary / 1000)}k`
                : job.job_salary_period
                    ? `${job.job_salary_currency || "$"}${job.job_min_salary || "?"} ${job.job_salary_period}`
                    : null,
            source: job.job_publisher,
        }));
        res.json({
            jobs,
            total: data.total || jobs.length,
            page,
        });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=jobs.js.map
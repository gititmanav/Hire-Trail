/** In-memory PDF uploads for resumes (10MB cap, application/pdf only). */
import multer from "multer";
import { AppError } from "../errors/AppError.js";
const storage = multer.memoryStorage();
const fileFilter = (_req, file, cb) => {
    const allowed = ["application/pdf"];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new AppError("Only PDF files are allowed", 400));
    }
};
export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
//# sourceMappingURL=upload.js.map
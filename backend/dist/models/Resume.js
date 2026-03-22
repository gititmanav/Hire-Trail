import mongoose, { Schema } from "mongoose";
const resumeSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    targetRole: { type: String, default: "", trim: true },
    fileName: { type: String, default: "", trim: true },
    fileUrl: { type: String, default: "" },
    filePublicId: { type: String, default: "" },
    uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });
export const Resume = mongoose.model("Resume", resumeSchema);
//# sourceMappingURL=Resume.js.map
import mongoose, { Schema } from "mongoose";
export const ANNOUNCEMENT_TYPES = ["info", "warning", "success"];
const announcementSchema = new Schema({
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5000 },
    type: { type: String, enum: ANNOUNCEMENT_TYPES, default: "info" },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    dismissible: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
announcementSchema.index({ active: 1, startDate: 1, endDate: 1 });
export const Announcement = mongoose.model("Announcement", announcementSchema);
//# sourceMappingURL=Announcement.js.map
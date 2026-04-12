import mongoose, { Schema } from "mongoose";
export const EMAIL_TEMPLATE_TYPES = ["welcome", "reset", "suspend", "reminder", "digest"];
const emailTemplateSchema = new Schema({
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    bodyHtml: { type: String, required: true },
    variables: [{ type: String, trim: true }],
    type: { type: String, enum: EMAIL_TEMPLATE_TYPES, required: true },
    active: { type: Boolean, default: true },
}, { timestamps: true });
emailTemplateSchema.index({ type: 1 });
export const EmailTemplate = mongoose.model("EmailTemplate", emailTemplateSchema);
//# sourceMappingURL=EmailTemplate.js.map
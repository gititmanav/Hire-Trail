import mongoose, { Schema, Document } from "mongoose";

export const EMAIL_TEMPLATE_TYPES = ["welcome", "reset", "suspend", "reminder", "digest"] as const;
export type EmailTemplateType = (typeof EMAIL_TEMPLATE_TYPES)[number];

export interface IEmailTemplate extends Document {
  name: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  type: EmailTemplateType;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const emailTemplateSchema = new Schema<IEmailTemplate>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    bodyHtml: { type: String, required: true },
    variables: [{ type: String, trim: true }],
    type: { type: String, enum: EMAIL_TEMPLATE_TYPES, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

emailTemplateSchema.index({ type: 1 });

export const EmailTemplate = mongoose.model<IEmailTemplate>("EmailTemplate", emailTemplateSchema);

import mongoose, { Schema, Document } from "mongoose";

export interface IResume extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  targetRole: string;
  tags: string[];
  fileName: string;
  fileUrl: string;
  filePublicId: string;
  uploadDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const resumeSchema = new Schema<IResume>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    targetRole: { type: String, default: "", trim: true },
    tags: { type: [String], default: [] },
    fileName: { type: String, default: "", trim: true },
    fileUrl: { type: String, default: "" },
    filePublicId: { type: String, default: "" },
    uploadDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Resume = mongoose.model<IResume>("Resume", resumeSchema);

import mongoose, { Schema, Document } from "mongoose";

export interface IAdminLoginEvent extends Document {
  userId: mongoose.Types.ObjectId;
  email: string;
  name: string;
  /** "google-extension": Google sign-in from the Chrome extension. */
  provider: "local" | "google" | "google-extension";
  ipAddress: string;
  userAgent: string;
  loggedInAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const adminLoginEventSchema = new Schema<IAdminLoginEvent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    provider: { type: String, enum: ["local", "google", "google-extension"], required: true },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    loggedInAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

adminLoginEventSchema.index({ loggedInAt: -1 });
adminLoginEventSchema.index({ email: 1, loggedInAt: -1 });

export const AdminLoginEvent = mongoose.model<IAdminLoginEvent>(
  "AdminLoginEvent",
  adminLoginEventSchema
);

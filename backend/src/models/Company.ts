import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICompany extends Document {
  _id: Types.ObjectId;
  name: string;
  website: string;
  domain: string;
  /** CDN URL of the company logo (Clearbit fetched server-side, uploaded to Cloudinary). */
  logoUrl: string;
  /** When we last attempted a logo fetch. Used to avoid retry storms when Clearbit 404s. */
  logoFetchedAt: Date | null;
  /** Cloudinary public_id for the logo asset, so we can delete on update / company removal. */
  logoPublicId: string;
  createdBy: Types.ObjectId;
  users: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      maxlength: 200,
    },
    website: { type: String, default: "", trim: true },
    domain: { type: String, default: "", trim: true },
    logoUrl: { type: String, default: "", trim: true },
    logoFetchedAt: { type: Date, default: null },
    logoPublicId: { type: String, default: "", trim: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    users: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

companySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
companySchema.index({ users: 1 });
companySchema.index({ domain: 1 });

export const Company = mongoose.model<ICompany>("Company", companySchema);

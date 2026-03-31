import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICompany extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  website: string;
  industry: string;
  notes: string;
  blacklisted: boolean;
  blacklistReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      maxlength: 200,
    },
    website: {
      type: String,
      default: "",
      trim: true,
    },
    industry: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    notes: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    blacklisted: {
      type: Boolean,
      default: false,
    },
    blacklistReason: {
      type: String,
      default: "",
      maxlength: 500,
    },
  },
  { timestamps: true }
);

companySchema.index({ userId: 1, name: 1 });

export const Company = mongoose.model<ICompany>("Company", companySchema);

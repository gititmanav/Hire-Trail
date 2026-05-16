/**
 * Master profile — one canonical career history per user.
 *
 * This is the source of truth for AI tailoring. Resume PDFs become *snapshots* /
 * variants pulled from this master; parsing a PDF feeds INTO the master rather
 * than creating its own bucket.
 *
 * Tags on bullets (per-bullet keywords like "frontend", "system-design") let
 * the AI tailor pick relevant content for any given JD without duplicating data
 * across resume variants.
 */
import mongoose, { Schema, Document } from "mongoose";

export interface IBullet {
  text: string;
  tags: string[];
}

export interface IExperience {
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: IBullet[];
}

export interface IProject {
  name: string;
  url: string;
  description: string;
  bullets: IBullet[];
  technologies: string[];
}

export interface IEducation {
  school: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa: string;
  highlights: string[];
}

export interface ISkillGroup {
  category: string;
  items: string[];
}

export interface ICertification {
  name: string;
  issuer: string;
  date: string;
  url: string;
}

export interface IContactInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface IMasterProfile extends Document {
  userId: mongoose.Types.ObjectId;
  contact: IContactInfo;
  summary: string;
  experiences: IExperience[];
  projects: IProject[];
  education: IEducation[];
  skills: ISkillGroup[];
  certifications: ICertification[];
  /** Which resume the last parse came from, if any (for audit / re-parse). */
  sourceResumeId: mongoose.Types.ObjectId | null;
  lastParsedAt: Date | null;
  lastParsedProvider: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const bulletSchema = new Schema<IBullet>({
  text: { type: String, default: "", trim: true },
  tags: { type: [String], default: [] },
}, { _id: false });

const experienceSchema = new Schema<IExperience>({
  company: { type: String, default: "", trim: true },
  role: { type: String, default: "", trim: true },
  location: { type: String, default: "", trim: true },
  startDate: { type: String, default: "", trim: true },
  endDate: { type: String, default: "", trim: true },
  current: { type: Boolean, default: false },
  bullets: { type: [bulletSchema], default: [] },
}, { _id: false });

const projectSchema = new Schema<IProject>({
  name: { type: String, default: "", trim: true },
  url: { type: String, default: "", trim: true },
  description: { type: String, default: "", trim: true },
  bullets: { type: [bulletSchema], default: [] },
  technologies: { type: [String], default: [] },
}, { _id: false });

const educationSchema = new Schema<IEducation>({
  school: { type: String, default: "", trim: true },
  degree: { type: String, default: "", trim: true },
  field: { type: String, default: "", trim: true },
  location: { type: String, default: "", trim: true },
  startDate: { type: String, default: "", trim: true },
  endDate: { type: String, default: "", trim: true },
  gpa: { type: String, default: "", trim: true },
  highlights: { type: [String], default: [] },
}, { _id: false });

const skillGroupSchema = new Schema<ISkillGroup>({
  category: { type: String, default: "", trim: true },
  items: { type: [String], default: [] },
}, { _id: false });

const certificationSchema = new Schema<ICertification>({
  name: { type: String, default: "", trim: true },
  issuer: { type: String, default: "", trim: true },
  date: { type: String, default: "", trim: true },
  url: { type: String, default: "", trim: true },
}, { _id: false });

const contactInfoSchema = new Schema<IContactInfo>({
  fullName: { type: String, default: "", trim: true },
  email: { type: String, default: "", trim: true },
  phone: { type: String, default: "", trim: true },
  location: { type: String, default: "", trim: true },
  linkedin: { type: String, default: "", trim: true },
  github: { type: String, default: "", trim: true },
  portfolio: { type: String, default: "", trim: true },
}, { _id: false });

const masterProfileSchema = new Schema<IMasterProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    contact: { type: contactInfoSchema, default: () => ({}) },
    summary: { type: String, default: "", trim: true },
    experiences: { type: [experienceSchema], default: [] },
    projects: { type: [projectSchema], default: [] },
    education: { type: [educationSchema], default: [] },
    skills: { type: [skillGroupSchema], default: [] },
    certifications: { type: [certificationSchema], default: [] },
    sourceResumeId: { type: Schema.Types.ObjectId, ref: "Resume", default: null },
    lastParsedAt: { type: Date, default: null },
    lastParsedProvider: { type: String, default: null },
  },
  { timestamps: true }
);

export const MasterProfile = mongoose.model<IMasterProfile>("MasterProfile", masterProfileSchema);

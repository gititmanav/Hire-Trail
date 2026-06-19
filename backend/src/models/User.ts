/** User document: local password and/or Google OAuth; password hash stripped in `toJSON`. */
import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcrypt";

/** Default instruction for the "prompt" clipboard format. Kept in sync with the
 *  extension's fallback so a user who never customizes it still gets a useful prompt. */
export const DEFAULT_CLIPBOARD_PROMPT =
  "Here's a job description. Based on my resume, what should I emphasize for this role, and what gaps should I prepare to address?";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string | null;
  googleId: string | null;
  role: "user" | "admin";
  suspended: boolean;
  suspendedAt: Date | null;
  deleted: boolean;
  deletedAt: Date | null;
  tourCompleted: boolean;
  /** Default resume for new applications (e.g. Chrome extension). */
  primaryResumeId: mongoose.Types.ObjectId | null;
  gmailRefreshToken: string | null;
  gmailConnected: boolean;
  gmailEmail: string | null;
  gmailLastSyncAt: Date | null;
  outlookRefreshToken: string | null;
  outlookConnected: boolean;
  outlookEmail: string | null;
  outlookLastSyncAt: Date | null;
  /** Set once the one-time backfill scan has been initiated. Hides the
   *  5/10/15-day window picker on subsequent Gmail connects. */
  gmailFirstScanCompleted: boolean;
  /** Window chosen for the first scan (5, 10, or 15). Audit trail only. */
  gmailFirstScanDays: number | null;
  /** Privacy consent record for the inbox backfill. `scopeAcknowledged` is
   *  versioned so a future scope expansion can re-prompt. */
  gmailScanConsent: { acceptedAt: Date; scopeAcknowledged: string } | null;
  /** When true, re-parsing a resume merges with the master profile via the LLM instead of overwriting it. Default true. */
  mergeResumesEnabled: boolean;
  /** When true, the extension also copies the JD to the clipboard each time the user tracks a job. Opt-in; default false. */
  clipboardCopyOnTrack: boolean;
  /** Shape of the text the extension's "Copy JD" / auto-copy writes to the clipboard. */
  clipboardFormat: "raw" | "metadata" | "prompt";
  /** Custom instruction used by the "prompt" clipboard format. The JD block is
   *  appended after this text, or substituted in place of a `{jd}` token. */
  clipboardPromptTemplate: string;
  /** Set once the one-time "configure clipboard copy" discovery notification has been created for this user. */
  clipboardNudgeSeeded: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      default: null,
      minlength: [6, "Password must be at least 6 characters"],
    },
    googleId: {
      type: String,
      default: null,
      sparse: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    suspended: { type: Boolean, default: false },
    suspendedAt: { type: Date, default: null },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    tourCompleted: { type: Boolean, default: false },
    primaryResumeId: {
      type: Schema.Types.ObjectId,
      ref: "Resume",
      default: null,
    },
    gmailRefreshToken: { type: String, default: null },
    gmailConnected: { type: Boolean, default: false },
    gmailEmail: { type: String, default: null },
    gmailLastSyncAt: { type: Date, default: null },
    outlookRefreshToken: { type: String, default: null },
    outlookConnected: { type: Boolean, default: false },
    outlookEmail: { type: String, default: null },
    outlookLastSyncAt: { type: Date, default: null },
    gmailFirstScanCompleted: { type: Boolean, default: false },
    gmailFirstScanDays: { type: Number, default: null },
    gmailScanConsent: {
      type: new mongoose.Schema(
        {
          acceptedAt: { type: Date, required: true },
          scopeAcknowledged: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    mergeResumesEnabled: { type: Boolean, default: true },
    clipboardCopyOnTrack: { type: Boolean, default: false },
    clipboardFormat: {
      type: String,
      enum: ["raw", "metadata", "prompt"],
      default: "metadata",
    },
    clipboardPromptTemplate: {
      type: String,
      default: DEFAULT_CLIPBOARD_PROMPT,
      maxlength: [2000, "Prompt cannot exceed 2000 characters"],
    },
    clipboardNudgeSeeded: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const out = ret as Record<string, unknown>;
        delete out.password;
        delete out.gmailRefreshToken;
        delete out.outlookRefreshToken;
        delete out.__v;
        return out;
      },
    },
  }
);

userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });

/* Auto-exclude soft-deleted users from normal find queries.
   Admin routes that need deleted users should use User.find({ deleted: true }) explicitly
   or Model.find().setOptions({ includeDeleted: true }). */
userSchema.pre(/^find/, function (this: mongoose.Query<unknown, IUser>, next) {
  const opts = this.getOptions() as Record<string, unknown>;
  if (!opts.includeDeleted) {
    this.where({ deleted: { $ne: true } });
  }
  next();
});
userSchema.pre("countDocuments", function (this: mongoose.Query<unknown, IUser>, next) {
  const opts = this.getOptions() as Record<string, unknown>;
  if (!opts.includeDeleted) {
    this.where({ deleted: { $ne: true } });
  }
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (
  candidate: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model<IUser>("User", userSchema);

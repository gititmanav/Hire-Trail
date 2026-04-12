import mongoose, { Schema } from "mongoose";
const adminLoginEventSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    provider: { type: String, enum: ["local", "google"], required: true },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    loggedInAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });
adminLoginEventSchema.index({ loggedInAt: -1 });
adminLoginEventSchema.index({ email: 1, loggedInAt: -1 });
export const AdminLoginEvent = mongoose.model("AdminLoginEvent", adminLoginEventSchema);
//# sourceMappingURL=AdminLoginEvent.js.map
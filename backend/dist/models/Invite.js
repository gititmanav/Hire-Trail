import mongoose, { Schema } from "mongoose";
const inviteSchema = new Schema({
    code: { type: String, required: true, unique: true, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
    maxUses: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    usedBy: [
        {
            userId: { type: Schema.Types.ObjectId, ref: "User" },
            usedAt: { type: Date, default: Date.now },
        },
    ],
    active: { type: Boolean, default: true },
}, { timestamps: true });
inviteSchema.index({ code: 1 }, { unique: true });
inviteSchema.index({ expiresAt: 1 });
export const Invite = mongoose.model("Invite", inviteSchema);
//# sourceMappingURL=Invite.js.map
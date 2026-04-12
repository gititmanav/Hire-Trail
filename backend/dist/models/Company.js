import mongoose, { Schema } from "mongoose";
const companySchema = new Schema({
    name: {
        type: String,
        required: [true, "Company name is required"],
        trim: true,
        maxlength: 200,
    },
    website: { type: String, default: "", trim: true },
    domain: { type: String, default: "", trim: true },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    users: [{ type: Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });
companySchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
companySchema.index({ users: 1 });
companySchema.index({ domain: 1 });
export const Company = mongoose.model("Company", companySchema);
//# sourceMappingURL=Company.js.map
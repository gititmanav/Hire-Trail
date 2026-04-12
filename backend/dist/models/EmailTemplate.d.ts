import mongoose, { Document } from "mongoose";
export declare const EMAIL_TEMPLATE_TYPES: readonly ["welcome", "reset", "suspend", "reminder", "digest"];
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
export declare const EmailTemplate: mongoose.Model<IEmailTemplate, {}, {}, {}, mongoose.Document<unknown, {}, IEmailTemplate, {}, {}> & IEmailTemplate & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;

import mongoose, { Document, Types } from "mongoose";
export declare const CONNECTION_SOURCES: readonly ["Cold email", "Referral", "Career fair", "LinkedIn", "Professor intro", "Alumni network", "Other"];
export type ConnectionSource = (typeof CONNECTION_SOURCES)[number];
export interface IContact extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    name: string;
    company: string;
    role: string;
    linkedinUrl: string;
    connectionSource: string;
    lastContactDate: Date;
    notes: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Contact: mongoose.Model<IContact, {}, {}, {}, mongoose.Document<unknown, {}, IContact, {}, {}> & IContact & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;

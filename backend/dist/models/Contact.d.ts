import mongoose, { Document, Types } from "mongoose";
export declare const CONNECTION_SOURCES: readonly ["Cold email", "Referral", "Career fair", "LinkedIn", "Professor intro", "Alumni network", "Other"];
export type ConnectionSource = (typeof CONNECTION_SOURCES)[number];
export declare const CONTACT_OUTREACH_STATUSES: readonly ["not_contacted", "reached_out", "responded", "meeting_scheduled", "follow_up_needed", "gone_cold"];
export type ContactOutreachStatus = (typeof CONTACT_OUTREACH_STATUSES)[number];
export interface IContact extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    name: string;
    company: string;
    companyId: Types.ObjectId | null;
    role: string;
    linkedinUrl: string;
    connectionSource: string;
    lastContactDate: Date;
    notes: string;
    applicationIds: Types.ObjectId[];
    outreachStatus: ContactOutreachStatus;
    lastOutreachDate: Date | null;
    nextFollowUpDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Contact: mongoose.Model<IContact, {}, {}, {}, mongoose.Document<unknown, {}, IContact, {}, {}> & IContact & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;

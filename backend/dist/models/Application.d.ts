import mongoose, { Document, Types } from "mongoose";
export declare const STAGES: readonly ["Applied", "OA", "Interview", "Offer", "Rejected"];
export declare const OUTREACH_STATUSES: readonly ["none", "reached_out", "referred", "response_received"];
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];
export declare const ARCHIVE_REASONS: readonly ["auto_stale", "rejected", "manual"];
export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];
export type Stage = (typeof STAGES)[number];
interface StageEntry {
    stage: Stage;
    date: Date;
}
export interface IApplication extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    company: string;
    companyId: Types.ObjectId | null;
    role: string;
    jobUrl: string;
    applicationDate: Date;
    stage: Stage;
    stageHistory: StageEntry[];
    notes: string;
    resumeId: Types.ObjectId | null;
    contactId: Types.ObjectId | null;
    outreachStatus: OutreachStatus;
    archived: boolean;
    archivedAt: Date | null;
    archivedReason: ArchiveReason | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Application: mongoose.Model<IApplication, {}, {}, {}, mongoose.Document<unknown, {}, IApplication, {}, {}> & IApplication & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export {};

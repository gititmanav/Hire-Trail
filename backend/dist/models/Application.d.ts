import mongoose, { Document, Types } from "mongoose";
export declare const STAGES: readonly ["Applied", "OA", "Interview", "Offer", "Rejected"];
export type Stage = (typeof STAGES)[number];
interface StageEntry {
    stage: Stage;
    date: Date;
}
export interface IApplication extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    company: string;
    role: string;
    jobUrl: string;
    applicationDate: Date;
    stage: Stage;
    stageHistory: StageEntry[];
    notes: string;
    resumeId: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Application: mongoose.Model<IApplication, {}, {}, {}, mongoose.Document<unknown, {}, IApplication, {}, {}> & IApplication & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export {};

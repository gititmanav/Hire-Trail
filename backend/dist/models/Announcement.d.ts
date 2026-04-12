import mongoose, { Document } from "mongoose";
export declare const ANNOUNCEMENT_TYPES: readonly ["info", "warning", "success"];
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];
export interface IAnnouncement extends Document {
    title: string;
    body: string;
    type: AnnouncementType;
    startDate: Date;
    endDate: Date;
    dismissible: boolean;
    active: boolean;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Announcement: mongoose.Model<IAnnouncement, {}, {}, {}, mongoose.Document<unknown, {}, IAnnouncement, {}, {}> & IAnnouncement & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;

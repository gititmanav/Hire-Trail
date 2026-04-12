import mongoose, { Document } from "mongoose";
export declare const SETTING_CATEGORIES: readonly ["general", "limits", "features", "session", "storage"];
export type SettingCategory = (typeof SETTING_CATEGORIES)[number];
export declare const SETTING_VALUE_TYPES: readonly ["string", "number", "boolean", "json"];
export type SettingValueType = (typeof SETTING_VALUE_TYPES)[number];
export interface ISystemSettings extends Document {
    key: string;
    value: unknown;
    valueType: SettingValueType;
    description: string;
    category: SettingCategory;
    updatedBy: mongoose.Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SystemSettings: mongoose.Model<ISystemSettings, {}, {}, {}, mongoose.Document<unknown, {}, ISystemSettings, {}, {}> & ISystemSettings & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
/** Default settings seeded on first access */
export declare const DEFAULT_SETTINGS: Array<{
    key: string;
    value: unknown;
    valueType: SettingValueType;
    description: string;
    category: SettingCategory;
}>;

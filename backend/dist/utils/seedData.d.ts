export interface SeedResult {
    users: number;
    resumes: number;
    applications: number;
    contacts: number;
    deadlines: number;
    companies: number;
    total: number;
}
/** Create demo user + synthetic data. Does NOT clear existing data first. */
export declare function runSeed(): Promise<SeedResult>;
/** Clear all data for the demo user only (preserves real users). */
export declare function clearSeedData(): Promise<{
    cleared: boolean;
}>;

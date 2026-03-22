/** Lifted job-search UI state so `/jobs` survives layout remounts and stays in sync with the header. */
import { createContext, useContext } from "react";

export interface JobSearchState {
  query: string;
  location: string;
  remote: boolean;
  datePosted: string;
  jobs: any[];
  total: number;
  page: number;
  searched: boolean;
  expanded: string | null;
  tracking: Set<string>;
}

const defaultState: JobSearchState = {
  query: "software engineer intern",
  location: "",
  remote: false,
  datePosted: "all",
  jobs: [],
  total: 0,
  page: 1,
  searched: false,
  expanded: null,
  tracking: new Set(),
};

type Setter = (s: JobSearchState | ((prev: JobSearchState) => JobSearchState)) => void;

export const JobSearchContext = createContext<{ state: JobSearchState; setState: Setter }>({
  state: defaultState,
  setState: () => {},
});

export const useJobSearch = () => useContext(JobSearchContext);
export { defaultState };
export interface Qualitygate {
  projectStatus: ProjectStatus;
}

export interface ProjectStatus {
  status: string;
  ignoredConditions: boolean;
  conditions: Condition[];
}

export interface Condition {
  status: string;
  metricKey: string;
  actualValue: string;
}

export interface Issue {
  key: string;
  project: string;
  component: string;
  rule: string;
  status: string;
  message: string;
  severity: string;
  line: number;
  author?: string;
  assignee?: string;
  effort: string;
  tags: string[];
  type: string;
}

export interface Hotspot {
  key: string;
  component: string;
  project: string;
  securityCategory: string;
  vulnerabilityProbability: string;
  status: string;
  line: number;
  message: string;
  author: string;
  creationDate: string;
  updateDate: string;
  textRange: {};
  flows: [];
  ruleKey: string;
  messageFormattings: [];
}

export interface HotspotList {
  hotspots: Hotspot[];
  paging: {
    pageIndex: number,
    pageSize: number,
    total: number
  },
  components: []
}

export interface IssueList {
  issues: Issue[];
  total: number;
  p: number;
  ps: number;
}

export interface Task {
  id: string;
  type: string;
  status: string;
  startedAt: Date;
  submittedAt: Date;
}

export interface Tasks {
  tasks: Task[];
}
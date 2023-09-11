export interface SonarData {
  bug_count: number;
  vul_count: number;
  smell_count: number;
  closed_issue_count: number;
  hotspot_count: number;
  coverage_percentage: string | number;
  duplication_percentage : string | number;
  project_status: string;
}
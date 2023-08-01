import { Axios } from "../http";

import * as entity from "./entity";
import { SonarReport } from "./report";
import { SonarProperties } from "./properties";
import { Log } from "../utils";

const SONAR_QUALITY_API = "/api/qualitygates/project_status";
const SONAR_ISSUE_API = "/api/issues/search";
const SONAR_TASK_API = "/api/ce/activity";
const PAGE_SIZE = 200;

export class Sonar {
  host: string;
  http: Axios;
  projectKey?: string;
  qualityGate: SonarReport;
  config?: SonarProperties;
  mergeRequestID: string;
  

  constructor(opt: {
    tokenKey: string;
    host: string;
    projectKey: string;
    mergeRequestID: string;
  }) {
    try {
      this.config = new SonarProperties({ projectDir: process.cwd() });
      this.host = this.config.getSonarURL();
      this.projectKey = this.config.getProjectKey();
    } catch (e: any) {
      Log.error(e.message);
      this.host = opt.host;
      this.projectKey = opt.projectKey;
    }
    this.mergeRequestID = opt.mergeRequestID;
    this.qualityGate = new SonarReport({ host: this.host, projectKey: this.projectKey });

    Log.info("tokenKey: "+ opt.tokenKey);
    const headers = {
      Authorization:
        "Basic " + Buffer.from(opt.tokenKey + ":" + "").toString("base64"),
    };
    Log.info("this.host: "+ this.host);
    Log.info("headers: "+ JSON.stringify(headers));
    this.http = new Axios({ host: this.host, headers: headers });
  }

  async getQualityStatus() {
    const response = await this.http.get<entity.Qualitygate>(SONAR_QUALITY_API, { 
      projectKey: this.projectKey,
      pullRequest: this.mergeRequestID,
    });
    return response.data;
  }

  async getTaskStatus() {
    const response = await this.http.get<entity.Tasks>(SONAR_TASK_API, {
      component: this.projectKey,
      onlyCurrents: true,
    });
    return response.data;
  }

  private async findIssuesByPage(fromTime: string, page: number) {
    const response = await this.http.get<entity.IssueList>(SONAR_ISSUE_API, {
      componentKeys: this.projectKey,
      createdAfter: fromTime,
      // sinceLeakPeriod: true, // get issues of new code on sonar
      p: page,
      ps: PAGE_SIZE,
    })
    return response.data;
  }

  private async findIssuesByPageByPullRequest(pullRequestId: string, page: number) {
    const response = await this.http.get<entity.IssueList>(SONAR_ISSUE_API, {
      componentKeys: this.projectKey,
      pullRequest: pullRequestId
    })
    Log.info("parameter: "+ JSON.stringify({
      componentKeys: this.projectKey,
      pullRequest: pullRequestId
    }))
    Log.info("issues: "+ JSON.stringify(response.data));
    return response.data;
  }

  async findIssues(fromTime: string): Promise<entity.IssueList> {
    // first page data
    const issues = await this.findIssuesByPage(fromTime, 1);
    const issueList = issues;
    if (issues) {
      const totalPage = Math.ceil(issues.total / issues.ps);
      for (let p = issues.p + 1; p <= totalPage; p++) {
        const issuePage = await this.findIssuesByPage(fromTime, p);
        if (!issuePage) {
          break;
        }
        issueList.issues.push(...issuePage.issues);
      }
    }
    return issueList;
  }

  async findIssuesByPullRequest(pullRequestId: string): Promise<entity.IssueList> {
    // first page data
    const issues = await this.findIssuesByPageByPullRequest(pullRequestId, 1);
    const issueList = issues;
    if (issues) {
      const totalPage = Math.ceil(issues.total / issues.ps);
      for (let p = issues.p + 1; p <= totalPage; p++) {
        const issuePage = await this.findIssuesByPageByPullRequest(pullRequestId, p);
        if (!issuePage) {
          break;
        }
        issueList.issues.push(...issuePage.issues);
      }
    }
    return issueList;
  }
}

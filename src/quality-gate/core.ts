import { Git, GitMerge, GitReviewParam } from "../git";
import { Sonar, SonarReport } from "../sonar";
import { Log } from "../utils";
import { Monitor } from "../monitor";

const INTERVAL_SECONDS = 60;

declare global {
  interface Date {
    isoDateTime: () => string;
  }
}
// format sonar date
Date.prototype.isoDateTime = function (): string {
  return this.toISOString().replace(".000", "+0000").replace("Z", "");
};

export class QualityGate {
  sonar: Sonar;
  git?: Git;
  gitMerge: GitMerge;
  monitor?: Monitor;
  sonarReport: SonarReport;

  constructor(opt: {
    sonar: Sonar;
    git?: Git;
    gitMerge: GitMerge;
    monitor?: Monitor;
  }) {
    this.sonar = opt.sonar;
    this.git = opt.git;
    this.gitMerge = opt.gitMerge;
    this.monitor = opt.monitor;
    this.sonarReport = new SonarReport({
      host: this.sonar.host,
      projectKey: this.sonar.projectKey,
    });
  }

  async handler() {
    Log.info("====")
    Log.info("start getTaskStatus");
    const taskStatus = await this.sonar.getTaskStatus();
    Log.info("finish getTaskStatus");
    if (!taskStatus || taskStatus.tasks.length == 0) {
      return false;
    }
    const taskSubmmitTime = new Date(taskStatus.tasks[0].submittedAt);
    // get previous 1 minutes
    taskSubmmitTime.setSeconds(taskSubmmitTime.getSeconds() - INTERVAL_SECONDS);
    Log.info("====")
    Log.info("start getQualityStatus");
    let quality = await this.sonar.getQualityStatus();
    // delay 10 second if sonar not ready yet
    if (!quality || quality.projectStatus.status == 'NONE') {
      const ms = 20000;
      Log.info("delay and rerun");
      await new Promise(resolve => setTimeout(resolve, ms));
      quality = await this.sonar.getQualityStatus();
    }
    if (!quality) {
      return false;
    }
    Log.info("finish getQualityStatus: "+ JSON.stringify(quality));
    Log.info("====")
    Log.info("start findIssuesByPullRequest");
    const sonarIssues = await this.sonar.findIssuesByPullRequest(this.sonar.mergeRequestID);
    Log.info("finish findIssuesByPullRequest: "+ JSON.stringify(sonarIssues));
    if (!sonarIssues) {
      return false;
    }

    let bugCnt = 0,
      vulCnt = 0,
      smellCnt = 0, 
      closedCnt = 0;

    const gitmergeParams: GitReviewParam[] = [];
    for (const i in sonarIssues.issues) {
      const issue = sonarIssues.issues[i];
      const path = issue.component.replace(issue.project + ":", "");
      if (issue.status == "CLOSED") {
        closedCnt++;
        continue;
      }
      if (issue.type == "BUG") {
        bugCnt++;
      } else if (issue.type == "VULNERABILITY") {
        vulCnt++;
      } else {
        smellCnt++;
      }
      gitmergeParams.push({
        comment: this.sonar.qualityGate.issueNote(issue),
        path: path,
        line: issue.line
      })
    }

    Log.info("====")
    Log.info("start getHotspotsByPullRequest");
    const sonarHotspots = await this.sonar.getHotspotsByPullRequest(this.sonar.mergeRequestID);
    let hotspotCnt = sonarHotspots.paging.total;
    Log.info("finish getHotspotsByPullRequest: "+ JSON.stringify(sonarHotspots));

    for (const i in sonarHotspots.hotspots) {
      const hotspot = sonarHotspots.hotspots[i];
      const path = hotspot.component.replace(hotspot.project + ":", "");
      gitmergeParams.push({
        comment: `**${hotspot.message}**`,
        path: path,
        line: hotspot.line
      })
    }
    
    const comment = this.sonar.qualityGate.report(
      this.sonar.mergeRequestID,
      quality.projectStatus,
      bugCnt,
      vulCnt,
      smellCnt,
      closedCnt,
      hotspotCnt
    );
    Log.info("review comment :"+ comment);;

    // create quality report
    Log.info("====")
    Log.info("start saveQualityDiscussion");
    const discussion = await this.gitMerge.saveQualityDiscussion(comment);
    Log.info("finish saveQualityDiscussion: "+ JSON.stringify(discussion));

    Log.info(">>> Monitor: "+ JSON.stringify(this.monitor));
    if (this.monitor) {
      const [,,, duplicatedCode, coverageValue,] = this.sonarReport.getIssueSecurity(quality.projectStatus)
      // save monitor report
      Log.info("====")
      Log.info("start monitor");
      const monitor = await this.monitor?.save({
        bug_count: bugCnt,
        vul_count: vulCnt,
        smell_count: smellCnt,
        closed_issue_count: closedCnt,
        hotspot_count: hotspotCnt,
        coverage_percentage: coverageValue,
        duplication_percentage: duplicatedCode,
        project_status: quality.projectStatus.status
      });
      Log.info("finish monitor: "+ JSON.stringify(monitor['response_schema']));
    }
    

    // create review comments
    Log.info("====")
    Log.info("start createReviewComments:");
    const review = await this.gitMerge.createReviewComments(gitmergeParams);
    Log.info("finish createReviewComments: "+ JSON.stringify(review));
    return true;
  }
}

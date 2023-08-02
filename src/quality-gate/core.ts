import { Git, GitMerge, GitReviewParam } from "../git";
import { Sonar } from "../sonar";
import { Log } from "../utils";

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

  constructor(opt: {
    sonar: Sonar;
    git?: Git;
    gitMerge: GitMerge;
  }) {
    this.sonar = opt.sonar;
    this.git = opt.git;
    this.gitMerge = opt.gitMerge;
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
    if (quality.projectStatus.status == 'NONE') {
      const ms = 10000;
      await new Promise(resolve => setTimeout(resolve, ms));
      quality = await this.sonar.getQualityStatus();
    }
    if (!quality) {
      return false;
    }
    Log.info("finish getQualityStatus");
    Log.info("====")
    Log.info("start findIssuesByPullRequest");
    const sonarIssues = await this.sonar.findIssuesByPullRequest(this.sonar.mergeRequestID);
    Log.info("finish findIssuesByPullRequest");
    if (!sonarIssues) {
      return false;
    }

    let bugCnt = 0,
      vulCnt = 0,
      smellCnt = 0;

    const gitmergeParams: GitReviewParam[] = [];
    for (const i in sonarIssues.issues) {
      const issue = sonarIssues.issues[i];
      const path = issue.component.replace(issue.project + ":", "");
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
    // create review comments
    Log.info("====")
    Log.info("start createReviewComments");
    await this.gitMerge.createReviewComments(gitmergeParams);
    const comment = this.sonar.qualityGate.report(
      this.sonar.mergeRequestID,
      quality.projectStatus,
      bugCnt,
      vulCnt,
      smellCnt
    );
    Log.info("finish createReviewComments");
    Log.info("comment :"+ comment);;
    // create quality report
    Log.info("====")
    Log.info("start saveQualityDiscussion");
    await this.gitMerge.saveQualityDiscussion(comment);
    if (bugCnt + vulCnt + smellCnt > 0) {
      return false;
    }
    Log.info("finish saveQualityDiscussion");
    return true;
  }
}

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
    const taskStatus = await this.sonar.getTaskStatus();
    if (!taskStatus || taskStatus.tasks.length == 0) {
      return false;
    }
    const taskSubmmitTime = new Date(taskStatus.tasks[0].submittedAt);
    // get previous 1 minutes
    taskSubmmitTime.setSeconds(taskSubmmitTime.getSeconds() - INTERVAL_SECONDS);
    
    const quality = await this.sonar.getQualityStatus();
    if (!quality) {
      return false;
    }
    const sonarIssues = await this.sonar.findIssuesByPullRequest(this.sonar.mergeRequestID);
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
    await this.gitMerge.createReviewComments(gitmergeParams);
    const comment = this.sonar.qualityGate.report(
      this.sonar.mergeRequestID,
      quality.projectStatus,
      bugCnt,
      vulCnt,
      smellCnt
    );
    Log.info("comment :"+ comment);;
    // create quality report
    await this.gitMerge.saveQualityDiscussion(comment);
    if (bugCnt + vulCnt + smellCnt > 0) {
      return false;
    }
    return true;
  }
}

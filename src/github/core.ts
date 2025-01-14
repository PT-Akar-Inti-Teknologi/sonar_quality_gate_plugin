import { Git, GitMerge, GitReviewParam } from "../git";
import { Axios } from "../http";
import { Comment } from "./entity";
import { Log } from "../utils";

export class Github implements Git {
  host: string;
  owner: string;
  http: Axios;
  projectID: string;
  headers?: any;

  constructor(opt: {
    host: string;
    token: string;
    projectID: string;
  }) {
    this.owner = opt.host;
    this.host = `https://api.github.com`;
    this.projectID = opt.projectID;

    const headers = {
      "Authorization": "token " + opt.token,
      "Accept": "application/vnd.github.v3+json"
    };
    this.headers = headers;
    this.http = new Axios({ host: this.host, headers: headers });
    Log.info("Git http: "+ JSON.stringify(this.http));
  }
}

export class GithubMerge extends Github implements GitMerge {
  mergeRequestID: number;
  constructor(opt: {
    host: string;
    token: string;
    projectID: string;
    mergeRequestID: number;
  }) {
    super(opt);
    this.mergeRequestID = opt.mergeRequestID;
  }

  async getQualityDiscussion(headers?: any): Promise<Comment | null> {
    const api = `/repos/${this.projectID}/issues/${this.mergeRequestID}/comments`;
    const response = await this.http.get<Comment[]>(api, {}, headers);
    const pattern = /^# SonarQube Code Analytics/g;
    const notes = response.data;
    for (const i in notes) {
      const data = notes[i];
      if (pattern.test(data.body)) {
        return data;
      }
    }
    return null;
  }

  async createComment(comment: string, headers?: any): Promise<Comment> {
    const api = `/repos/${this.owner}/${this.projectID}/issues/${this.mergeRequestID}/comments`;
    const response = await this.http.post(api, {
      body: comment
    }, {}, headers);
    return response.data
  }

  async updateComment(noteID: number, comment: string, headers?: any): Promise<Comment> {
    const api = `/repos/${this.projectID}/issues/comments/${noteID}`;
    const response = await this.http.patch(api, {
      body: comment
    }, {}, headers);
    return response.data
  }

  async saveQualityDiscussion(comment: string, headers?: any): Promise<Comment> {
    const discussion = false;
    const data = await this.createComment(comment, headers);
    // let data = null;
    // if (discussion) {
    //   data = await this.updateComment(discussion.id, comment, headers);
    // } else {
    //   data = await this.createComment(comment, headers);
    // }
    return data;
  }

  async createReviewComments(
    params: GitReviewParam[]
  ): Promise<Comment | null> {
    const api = `/repos/${this.owner}/${this.projectID}/pulls/${this.mergeRequestID}/reviews`;

    const comments: any = [];
    for (const i in params) {
      comments.push({
        path: params[i].path,
        line: params[i].line,
        body: params[i].comment
      });
    }
    if (comments.length == 0){
      return null;
    }

    const data = {
      body: "",
      event: "COMMENT",
      comments: comments
    };
    Log.info("start review comment: "+ JSON.stringify(data));
    const response = await this.http.post(api, data, {});
    Log.info("response review comment:"+ JSON.stringify(response));
    return response.data
  }
}
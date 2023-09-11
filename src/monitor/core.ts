import { Log } from "../utils";
import { Axios } from "../http";
import { SonarData } from './entity';

const MONITOR_PR_CHECKER = "/pr_check";

export class Monitor {
  http: Axios;
  host: string;
  projectId: any;
  mergeId: any;

  constructor(opt: {
    host: string;
    token: string;
    projectId: any;
    mergeId: any;
  }) {
    const headers = {
      Authorization:
        "Basic " + opt.token,
      'Content-Type': 'application/json'
    };
    this.host = opt.host;
    this.mergeId = opt.mergeId;
    this.projectId = opt.projectId;
    Log.info("Monitor host: "+ this.host);
    Log.info("Monitor headers: "+ JSON.stringify(headers));
    this.http = new Axios({ host: this.host, headers: headers });
  }

  async save(sonarData: SonarData, headers?: any) {
    Log.info("monitor body params: "+ JSON.stringify({ 
      project_id: this.projectId,
      merge_id: this.mergeId,
      sonar_data: sonarData
    }));
    const response = await this.http.post(MONITOR_PR_CHECKER, { 
      project_id: this.projectId,
      merge_id: this.mergeId,
      sonar_data: sonarData
    }, {}, headers);
    return response.data;
  }
}

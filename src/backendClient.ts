import * as vscode from "vscode";
import { AnalysisResult, ChangedFile } from "./types";

export class BackendClient {
  async analyze(workspace: string, branch: string, files: ChangedFile[]): Promise<AnalysisResult> {
    const config = vscode.workspace.getConfiguration("aiDevOpsRisk");
    const token = config.get<string>("accessToken");
    const response = await fetch(`${config.get<string>("apiUrl")}/risk/editor/analyze`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ workspace, branch, files })
    });
    if (!response.ok) throw new Error(`Analysis failed (${response.status}): ${await response.text()}`);
    return response.json() as Promise<AnalysisResult>;
  }
}

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { BackendClient } from "./backendClient";
import { AnalysisResult, ChangedFile, Finding } from "./types";

const source = "AI DevOps Risk";

class RiskPanelProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private result?: AnalysisResult;
  private wsPath = "";

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.command === "openFile" && msg.filePath) {
        const uri = vscode.Uri.file(msg.filePath);
        const line = Math.max(0, (msg.line || 1) - 1);
        vscode.window.showTextDocument(uri, {
          selection: new vscode.Range(line, 0, line, 0),
        });
      } else if (msg.command === "runAnalysis") {
        vscode.commands.executeCommand("aiDevOpsRisk.analyzeGitChanges");
      }
    });
    this.refresh();
  }

  update(result: AnalysisResult, wsPath: string): void {
    this.result = result;
    this.wsPath = wsPath;
    this.refresh();
  }

  private refresh(): void {
    if (!this.view) return;
    this.view.webview.html = this.getHtml();
  }

  private getHtml(): string {
    if (!this.result) {
      return `<!DOCTYPE html><html><head><style>
        body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-sideBar-background); padding: 16px; margin: 0; }
        .welcome { text-align: center; margin-top: 32px; opacity: 0.8; }
        .icon { font-size: 40px; margin-bottom: 12px; }
        h3 { color: var(--vscode-foreground); margin: 0 0 8px; font-size: 14px; }
        p { font-size: 12px; line-height: 1.5; color: var(--vscode-descriptionForeground); }
        .btn { display: inline-block; margin-top: 16px; padding: 6px 14px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .btn:hover { background: var(--vscode-button-hoverBackground); }
      </style></head><body>
        <div class="welcome">
          <div class="icon">🛡️</div>
          <h3>AI DevOps Risk Analyzer</h3>
          <p>Analyze your code for security risks, misconfigurations, and vulnerabilities.</p>
          <button class="btn" onclick="vscode.postMessage({command:'runAnalysis'})">Analyze Git Changes</button>
        </div>
        <script>const vscode = acquireVsCodeApi();</script>
      </body></html>`;
    }

    const r = this.result;
    const scoreColor =
      r.riskScore >= 70 ? "#e74c3c" : r.riskScore >= 40 ? "#f39c12" : "#2ecc71";
    const sevUpper = (r.severity || "Unknown").toUpperCase();
    const sevColor =
      sevUpper === "CRITICAL"
        ? "#e74c3c"
        : sevUpper === "HIGH"
          ? "#e67e22"
          : sevUpper === "MEDIUM"
            ? "#f1c40f"
            : "#2ecc71";
    const pct = Math.min(100, r.riskScore);
    const circumference = 2 * Math.PI * 38;
    const dashOffset = circumference - (pct / 100) * circumference;

    const scoreEntries = Object.entries(r.scores || {});
    const scoreBarsHtml = scoreEntries
      .map(([key, val]) => {
        const v = Number(val) || 0;
        const c = v >= 70 ? "#e74c3c" : v >= 40 ? "#f39c12" : "#2ecc71";
        return `<div class="score-row"><span class="score-label">${this.escHtml(key)}</span><div class="score-bar"><div class="score-fill" style="width:${v}%;background:${c}"></div></div><span class="score-val">${v}</span></div>`;
      })
      .join("");

    const findingsHtml = (r.findings || [])
      .map((f, i) => {
        const s = (f.severity || "Unknown").toUpperCase();
        const fc =
          s === "CRITICAL"
            ? "#e74c3c"
            : s === "HIGH"
              ? "#e67e22"
              : s === "MEDIUM"
                ? "#f1c40f"
                : "#2ecc71";
        const fullPath = path.resolve(
          this.wsPath,
          (f.filePath || "").replace(/^[\/\\]/, ""),
        );
        const escapedPath = this.escHtml(fullPath)
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'");
        return `<div class="finding">
        <div class="finding-header" onclick="toggle(${i})">
          <span class="sev-dot" style="background:${fc}"></span>
          <span class="finding-sev" style="color:${fc}">${s}</span>
          <span class="finding-title">${this.escHtml(f.title)}</span>
          <span class="chevron" id="chev-${i}">▸</span>
        </div>
        <div class="finding-body" id="body-${i}">
          <div class="finding-file" onclick="openFile('${escapedPath}', ${f.lineNumber})">
            📄 ${this.escHtml(f.filePath)}:${f.lineNumber}
          </div>
          ${f.category ? `<div class="finding-meta"><strong>Category:</strong> ${this.escHtml(f.category)}</div>` : ""}
          <div class="finding-desc">${this.escHtml(f.description)}</div>
          ${f.businessImpact ? `<div class="finding-impact"><strong>Impact:</strong> ${this.escHtml(f.businessImpact)}</div>` : ""}
          <div class="finding-rec"><strong>💡 Recommendation:</strong><br/>${this.escHtml(f.recommendation)}</div>
        </div>
      </div>`;
      })
      .join("");

    return `<!DOCTYPE html><html><head><style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-sideBar-background); padding: 12px; font-size: 12px; }

      /* Score Header */
      .header { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; padding: 12px; background: var(--vscode-editor-background); border-radius: 8px; border: 1px solid var(--vscode-panel-border); }
      .score-ring { position: relative; width: 80px; height: 80px; flex-shrink: 0; }
      .score-ring svg { transform: rotate(-90deg); }
      .score-ring .track { fill: none; stroke: var(--vscode-panel-border); stroke-width: 6; }
      .score-ring .progress { fill: none; stroke: ${scoreColor}; stroke-width: 6; stroke-linecap: round; stroke-dasharray: ${circumference}; stroke-dashoffset: ${dashOffset}; transition: stroke-dashoffset 0.8s ease; }
      .score-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
      .score-num { font-size: 22px; font-weight: 700; color: ${scoreColor}; display: block; line-height: 1; }
      .score-of { font-size: 10px; color: var(--vscode-descriptionForeground); }
      .header-info { flex: 1; }
      .sev-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; color: #fff; background: ${sevColor}; margin-bottom: 6px; }
      .decision { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 2px; }
      .confidence { font-size: 10px; color: var(--vscode-descriptionForeground); }

      /* Score Breakdown */
      .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--vscode-descriptionForeground); margin: 14px 0 8px; }
      .scores-card { background: var(--vscode-editor-background); border-radius: 8px; border: 1px solid var(--vscode-panel-border); padding: 10px 12px; margin-bottom: 12px; }
      .score-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .score-row:last-child { margin-bottom: 0; }
      .score-label { width: 72px; font-size: 11px; text-transform: capitalize; color: var(--vscode-foreground); }
      .score-bar { flex: 1; height: 6px; background: var(--vscode-panel-border); border-radius: 3px; overflow: hidden; }
      .score-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
      .score-val { width: 24px; text-align: right; font-size: 11px; font-weight: 600; }

      /* Findings */
      .findings-count { font-size: 11px; color: var(--vscode-descriptionForeground); margin-left: 4px; font-weight: 400; }
      .finding { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin-bottom: 8px; overflow: hidden; }
      .finding-header { display: flex; align-items: center; gap: 6px; padding: 8px 10px; cursor: pointer; user-select: none; }
      .finding-header:hover { background: var(--vscode-list-hoverBackground); }
      .sev-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
      .finding-sev { font-size: 10px; font-weight: 700; flex-shrink: 0; width: 56px; }
      .finding-title { flex: 1; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .chevron { font-size: 10px; color: var(--vscode-descriptionForeground); transition: transform 0.2s; }
      .chevron.open { transform: rotate(90deg); }
      .finding-body { display: none; padding: 0 10px 10px; border-top: 1px solid var(--vscode-panel-border); }
      .finding-body.open { display: block; }
      .finding-file { padding: 8px 0 6px; color: var(--vscode-textLink-foreground); cursor: pointer; font-size: 11px; }
      .finding-file:hover { text-decoration: underline; }
      .finding-meta { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 6px; }
      .finding-desc { font-size: 11px; line-height: 1.5; margin-bottom: 8px; padding: 6px 8px; background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textBlockQuote-border); border-radius: 2px; }
      .finding-impact { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 6px; }
      .finding-rec { font-size: 11px; line-height: 1.5; padding: 6px 8px; background: rgba(46,204,113,0.08); border-left: 3px solid #2ecc71; border-radius: 2px; }
    </style></head><body>

      <div class="header">
        <div class="score-ring">
          <svg width="80" height="80" viewBox="0 0 84 84">
            <circle class="track" cx="42" cy="42" r="38"/>
            <circle class="progress" cx="42" cy="42" r="38"/>
          </svg>
          <div class="score-text">
            <span class="score-num">${r.riskScore}</span>
            <span class="score-of">/100</span>
          </div>
        </div>
        <div class="header-info">
          <div class="sev-badge">${sevUpper}</div>
          <div class="decision">${this.escHtml(r.decision || "")}</div>
          <div class="confidence">Confidence: ${r.confidence || 0}%</div>
        </div>
      </div>

      ${scoreEntries.length ? `<div class="section-title">Score Breakdown</div><div class="scores-card">${scoreBarsHtml}</div>` : ""}

      <div class="section-title">Findings <span class="findings-count">(${(r.findings || []).length})</span></div>
      ${findingsHtml || "<div style='text-align:center;padding:16px;opacity:0.6'>No findings</div>"}

      <script>
        const vscode = acquireVsCodeApi();
        function toggle(i) {
          const body = document.getElementById('body-' + i);
          const chev = document.getElementById('chev-' + i);
          body.classList.toggle('open');
          chev.classList.toggle('open');
        }
        function openFile(filePath, line) {
          vscode.postMessage({ command: 'openFile', filePath: filePath, line: line });
        }
      </script>
    </body></html>`;
  }

  private escHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const client = new BackendClient();
  const diagnostics = vscode.languages.createDiagnosticCollection(source);
  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  const provider = new RiskPanelProvider();
  const findingsByFile = new Map<string, Finding[]>();
  const decorations = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor("editorCodeLens.foreground"),
      margin: "0 0 0 1rem",
    },
  });
  let debounce: NodeJS.Timeout | undefined;
  status.command = "aiDevOpsRisk.analyzeGitChanges";
  status.show();
  status.text = "$(shield) AI DevOps: idle";
  context.subscriptions.push(
    diagnostics,
    status,
    decorations,
    vscode.window.registerWebviewViewProvider(
      "aiDevOpsRisk.findings",
      provider,
    ),
  );

  const toChangedFile = (
    document: vscode.TextDocument,
    selection?: vscode.Selection,
  ): ChangedFile => ({
    path: vscode.workspace.asRelativePath(document.uri),
    content:
      selection && !selection.isEmpty
        ? document.getText(selection)
        : document.getText(),
    change_type: "modified",
  });
  const workspaceName = () =>
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "untitled";
  const render = (result: AnalysisResult) => {
    findingsByFile.clear();
    diagnostics.clear();
    for (const finding of result.findings) {
      const fullPath = path.resolve(
        workspaceName(),
        finding.filePath.replace(/^[/\\]/, ""),
      );
      const values = findingsByFile.get(fullPath) ?? [];
      values.push(finding);
      findingsByFile.set(fullPath, values);
    }
    for (const [file, findings] of findingsByFile) {
      const uri = vscode.Uri.file(file);
      diagnostics.set(
        uri,
        findings.map(
          (f) =>
            new vscode.Diagnostic(
              new vscode.Range(
                Math.max(0, f.lineNumber - 1),
                0,
                Math.max(0, f.lineNumber - 1),
                Number.MAX_VALUE,
              ),
              f.description,
              severity(f.severity),
            ),
        ),
      );
    }
    provider.update(result, workspaceName());
    const editor = vscode.window.activeTextEditor;
    if (editor)
      editor.setDecorations(
        decorations,
        (findingsByFile.get(editor.document.uri.fsPath) ?? []).map((f) => ({
          range: new vscode.Range(
            Math.max(0, f.lineNumber - 1),
            0,
            Math.max(0, f.lineNumber - 1),
            0,
          ),
          renderOptions: {
            after: { contentText: `AI DevOps: ${f.recommendation}` },
          },
        })),
      );
    status.text = `$(shield) AI DevOps: ${result.riskScore}/100 ${result.severity} • Sec ${result.scores.security} • TF ${result.scores.terraform}`;
  };
  const analyze = async (files: ChangedFile[]) => {
    if (!files.length) return;
    status.text = "$(sync~spin) AI DevOps: analyzing";
    try {
      render(await client.analyze(workspaceName(), "local", files));
    } catch (error) {
      status.text = "$(warning) AI DevOps: unavailable";
      vscode.window.showErrorMessage(
        error instanceof Error ? error.message : String(error),
      );
    }
  };
  const current = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) void analyze([toChangedFile(editor.document)]);
  };
  context.subscriptions.push(
    vscode.commands.registerCommand("aiDevOpsRisk.analyzeCurrentFile", current),
    vscode.commands.registerCommand("aiDevOpsRisk.analyzeSelectedCode", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor)
        void analyze([toChangedFile(editor.document, editor.selection)]);
    }),
    vscode.commands.registerCommand(
      "aiDevOpsRisk.analyzeWorkspace",
      async () => {
        const uris = await vscode.workspace.findFiles(
          "**/*.{py,java,cs,tf,bicep,yml,yaml,Dockerfile,sh,ps1}",
          "**/{node_modules,.git,dist}/**",
          50,
        );
        void analyze(
          await Promise.all(
            uris.map(async (uri) =>
              toChangedFile(await vscode.workspace.openTextDocument(uri)),
            ),
          ),
        );
      },
    ),
    vscode.commands.registerCommand(
      "aiDevOpsRisk.analyzeGitChanges",
      async () => {
        void analyze(await changedGitFiles());
      },
    ),
    vscode.commands.registerCommand("aiDevOpsRisk.analyzeCommit", async () => {
      const files = await changedGitFiles();
      if (!files.length) return;
      status.text = "$(sync~spin) AI DevOps: pre-commit check";
      try {
        const result = await client.analyze(workspaceName(), "local", files);
        render(result);
        if (result.severity === "Critical") {
          const selection = await vscode.window.showWarningMessage(
            "Critical AI DevOps findings detected. Commit anyway?",
            { modal: true },
            "Commit Anyway",
            "Cancel",
          );
          if (selection !== "Commit Anyway")
            vscode.window.showInformationMessage(
              "Commit cancelled. Resolve the critical findings and try again.",
            );
        } else
          vscode.window.showInformationMessage(
            `Pre-commit analysis passed: ${result.severity} (${result.riskScore}/100).`,
          );
      } catch (error) {
        vscode.window.showErrorMessage(
          error instanceof Error ? error.message : String(error),
        );
      }
    }),
    vscode.commands.registerCommand("aiDevOpsRisk.analyzeTerraform", () =>
      analyzeByPattern("**/*.{tf,tfvars}", analyze),
    ),
    vscode.commands.registerCommand("aiDevOpsRisk.analyzeKubernetes", () =>
      analyzeByPattern("**/*.{yaml,yml}", analyze),
    ),
    vscode.commands.registerCommand("aiDevOpsRisk.analyzeDockerfile", () =>
      analyzeByPattern("**/Dockerfile", analyze),
    ),
    vscode.commands.registerCommand("aiDevOpsRisk.analyzePipeline", () =>
      analyzeByPattern("**/{azure-pipelines.yml,*.pipeline.yml}", analyze),
    ),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (
        doc.uri.scheme === "file" &&
        vscode.workspace.getConfiguration("aiDevOpsRisk").get("analyzeOnSave")
      )
        void analyze([toChangedFile(doc)]);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.scheme !== "file") return;
      clearTimeout(debounce);
      debounce = setTimeout(
        () => void analyze([toChangedFile(event.document)]),
        vscode.workspace
          .getConfiguration("aiDevOpsRisk")
          .get<number>("typingDebounceMs"),
      );
    }),
    vscode.languages.registerHoverProvider(
      { scheme: "file" },
      {
        provideHover(doc, position) {
          const items =
            findingsByFile
              .get(doc.uri.fsPath)
              ?.filter((f) => f.lineNumber === position.line + 1) ?? [];
          return items.length
            ? new vscode.Hover(
                items.map(
                  (f) =>
                    new vscode.MarkdownString(
                      `**${f.severity}: ${f.title}**\n\n${f.description}\n\n${f.recommendation}`,
                    ),
                ),
              )
            : undefined;
        },
      },
    ),
    vscode.languages.registerCodeActionsProvider(
      { scheme: "file" },
      {
        provideCodeActions(doc, range) {
          return (findingsByFile.get(doc.uri.fsPath) ?? [])
            .filter(
              (f) =>
                f.lineNumber === range.start.line + 1 && f.suggestedCodeFix,
            )
            .map((f) => fixAction(doc, f));
        },
      },
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "aiDevOpsRisk.applyFix",
      async (uri: vscode.Uri, finding: Finding) => {
        if (!finding.suggestedCodeFix) return;
        const original = await vscode.workspace.openTextDocument(uri);
        const preview = await vscode.workspace.openTextDocument({
          content: finding.suggestedCodeFix,
          language: original.languageId,
        });
        await vscode.window.showTextDocument(preview, {
          preview: true,
          viewColumn: vscode.ViewColumn.Beside,
        });
        if (
          (await vscode.window.showWarningMessage(
            `Apply AI fix for ${finding.title}?`,
            { modal: true },
            "Apply",
          )) !== "Apply"
        )
          return;
        const line = Math.max(0, finding.lineNumber - 1);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
          uri,
          new vscode.Range(
            line,
            0,
            line,
            original.lineAt(line).range.end.character,
          ),
          finding.suggestedCodeFix,
        );
        await vscode.workspace.applyEdit(edit);
      },
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "aiDevOpsRisk.installPreCommitHook",
      async () => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
          vscode.window.showErrorMessage("No workspace folder open.");
          return;
        }
        await installHookForFolder(folder.uri.fsPath, true);
      },
    ),
  );

  // Auto-install pre-commit hook on activation
  autoInstallHook(context);
}

async function installHookForFolder(
  folderPath: string,
  manual: boolean,
): Promise<boolean> {
  const gitDir = path.join(folderPath, ".git");
  if (!fs.existsSync(gitDir)) {
    if (manual)
      vscode.window.showErrorMessage(
        "No Git repository found in this workspace.",
      );
    return false;
  }
  const hooksDir = path.join(gitDir, "hooks");
  const hookPath = path.join(hooksDir, "pre-commit");
  if (fs.existsSync(hookPath)) {
    const content = fs.readFileSync(hookPath, "utf-8");
    if (content.includes("AI DevOps Risk Analyzer")) {
      if (manual)
        vscode.window.showInformationMessage(
          "AI DevOps pre-commit hook is already installed.",
        );
      return true;
    }
    if (manual) {
      const answer = await vscode.window.showWarningMessage(
        "A pre-commit hook already exists. Overwrite it?",
        { modal: true },
        "Overwrite",
        "Cancel",
      );
      if (answer !== "Overwrite") return false;
    } else {
      return false; // Don't overwrite existing hooks silently
    }
  }
  const config = vscode.workspace.getConfiguration("aiDevOpsRisk");
  const apiUrl = config.get<string>("apiUrl") || "";
  const token = config.get<string>("accessToken") || "";
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(hookPath, generatePreCommitHook(apiUrl, token), {
    mode: 0o755,
  });
  if (manual)
    vscode.window.showInformationMessage(
      "AI DevOps pre-commit hook installed! Commits with Critical/High risks will be blocked.",
    );
  return true;
}

function autoInstallHook(context: vscode.ExtensionContext): void {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return;
  for (const folder of folders) {
    const folderPath = folder.uri.fsPath;
    const gitDir = path.join(folderPath, ".git");
    if (!fs.existsSync(gitDir)) continue;
    const hookPath = path.join(gitDir, "hooks", "pre-commit");
    // Skip if hook already exists
    if (fs.existsSync(hookPath)) {
      const content = fs.readFileSync(hookPath, "utf-8");
      if (content.includes("AI DevOps Risk Analyzer")) continue;
    }
    // Check if user already declined for this repo
    const stateKey = `hookDeclined:${folderPath}`;
    if (context.globalState.get<boolean>(stateKey)) continue;
    // Prompt user
    void vscode.window
      .showInformationMessage(
        `Enable AI DevOps risk scanning for commits in "${folder.name}"?`,
        "Install Hook",
        "Not Now",
        "Don't Ask Again",
      )
      .then(async (choice) => {
        if (choice === "Install Hook") {
          const installed = await installHookForFolder(folderPath, false);
          if (installed)
            vscode.window.showInformationMessage(
              `AI DevOps pre-commit hook installed for "${folder.name}". Risky commits will be blocked.`,
            );
        } else if (choice === "Don't Ask Again") {
          context.globalState.update(stateKey, true);
        }
      });
  }
}
async function analyzeByPattern(
  pattern: string,
  analyze: (files: ChangedFile[]) => Promise<void>,
): Promise<void> {
  const uris = await vscode.workspace.findFiles(
    pattern,
    "**/{node_modules,.git,dist}/**",
    50,
  );
  await analyze(
    await Promise.all(
      uris.map(async (uri) => ({
        path: vscode.workspace.asRelativePath(uri),
        content: (await vscode.workspace.openTextDocument(uri)).getText(),
        change_type: "modified" as const,
      })),
    ),
  );
}
function severity(value: string): vscode.DiagnosticSeverity {
  return value === "Critical" || value === "High"
    ? vscode.DiagnosticSeverity.Error
    : value === "Medium"
      ? vscode.DiagnosticSeverity.Warning
      : vscode.DiagnosticSeverity.Information;
}
function fixAction(
  document: vscode.TextDocument,
  finding: Finding,
): vscode.CodeAction {
  const action = new vscode.CodeAction(
    `AI DevOps: Apply fix for ${finding.title}`,
    vscode.CodeActionKind.QuickFix,
  );
  action.command = {
    command: "aiDevOpsRisk.applyFix",
    title: "Apply AI fix",
    arguments: [document.uri, finding],
  };
  return action;
}
async function changedGitFiles(): Promise<ChangedFile[]> {
  const git = vscode.extensions.getExtension<{
    getAPI(version: 1): {
      repositories: Array<{
        state: {
          workingTreeChanges: Array<{ uri: vscode.Uri }>;
          indexChanges: Array<{ uri: vscode.Uri }>;
        };
      }>;
    };
  }>("vscode.git")?.exports;
  const repository = git?.getAPI(1).repositories[0];
  if (!repository) {
    vscode.window.showWarningMessage(
      "No Git repository is available; use Analyze Workspace instead.",
    );
    return [];
  }
  const uris = new Map<string, vscode.Uri>();
  [
    ...repository.state.workingTreeChanges,
    ...repository.state.indexChanges,
  ].forEach((change) => uris.set(change.uri.fsPath, change.uri));
  return Promise.all(
    [...uris.values()].map(async (uri) => ({
      path: vscode.workspace.asRelativePath(uri),
      content: (await vscode.workspace.openTextDocument(uri)).getText(),
      change_type: "modified" as const,
    })),
  );
}
function generatePreCommitHook(apiUrl: string, token: string): string {
  return `#!/bin/sh
# AI DevOps Risk Analyzer - Pre-Commit Hook
# Automatically blocks commits with Critical security risks
# To bypass: git commit --no-verify

PYTHON_CMD=""
if command -v python3 > /dev/null 2>&1; then
  PYTHON_CMD="python3"
elif command -v python > /dev/null 2>&1; then
  PYTHON_CMD="python"
else
  echo "Python not found. Skipping AI DevOps risk analysis."
  exit 0
fi

$PYTHON_CMD << 'AI_DEVOPS_HOOK'
import json, sys, os, subprocess
try:
    from urllib.request import Request, urlopen
    from urllib.error import HTTPError
except ImportError:
    sys.exit(0)

API_URL = "${apiUrl}"
TOKEN = "${token}"

result = subprocess.run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"], capture_output=True, text=True)
files = [f.strip() for f in result.stdout.strip().split("\\n") if f.strip()]
if not files:
    sys.exit(0)

EXTENSIONS = {".py", ".java", ".cs", ".tf", ".bicep", ".yml", ".yaml", ".sh", ".ps1", ".js", ".ts", ".json", ".xml", ".toml", ".cfg", ".ini", ".env", ".config"}
changed_files = []
for filepath in files:
    ext = os.path.splitext(filepath)[1].lower()
    basename = os.path.basename(filepath).lower()
    if ext in EXTENSIONS or basename in {"dockerfile", "makefile", "jenkinsfile"}:
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            changed_files.append({"path": filepath, "content": content, "change_type": "modified"})
        except Exception:
            pass

if not changed_files:
    sys.exit(0)

print("\\n" + "=" * 60)
print("  AI DevOps Risk Analyzer - Pre-Commit Check")
print("=" * 60)
print("  Scanning %d file(s)..." % len(changed_files))

payload = json.dumps({"workspace": os.path.basename(os.getcwd()), "branch": "local", "files": changed_files}).encode("utf-8")
headers = {"Content-Type": "application/json"}
if TOKEN:
    headers["Authorization"] = "Bearer " + TOKEN

req = Request(API_URL + "/risk/editor/analyze", data=payload, headers=headers)
try:
    resp = urlopen(req, timeout=30)
    data = json.loads(resp.read())
except HTTPError as e:
    print("  Warning: API error (%d). Allowing commit." % e.code)
    sys.exit(0)
except Exception as e:
    print("  Warning: API unreachable. Allowing commit.")
    sys.exit(0)

score = data.get("riskScore", 0)
severity = data.get("severity", "Unknown").upper()
findings = data.get("findings", [])

print("\\n  Risk Score: %d/100 (%s)" % (score, severity))
print("-" * 60)

for f in findings:
    sev = f.get("severity", "Unknown").upper()
    if sev in ("CRITICAL", "HIGH"):
        icon = "X"
    elif sev == "MEDIUM":
        icon = "!"
    else:
        icon = "i"
    print("  [%s] [%s] %s" % (icon, sev, f.get("title", "Unknown")))
    print("      File: %s:%s" % (f.get("filePath", "?"), f.get("lineNumber", 0)))
    print("      Fix:  %s" % f.get("recommendation", "N/A"))
    print()

print("=" * 60)

if severity == "CRITICAL":
    print("  COMMIT BLOCKED: Critical security risks detected!")
    print("  Fix the issues or use: git commit --no-verify")
    print("=" * 60 + "\\n")
    sys.exit(1)
elif severity == "HIGH":
    print("  COMMIT BLOCKED: High security risks detected!")
    print("  Fix the issues or use: git commit --no-verify")
    print("=" * 60 + "\\n")
    sys.exit(1)
else:
    print("  OK: No critical/high risks found. Commit allowed.")
    print("=" * 60 + "\\n")
    sys.exit(0)
AI_DEVOPS_HOOK
`;
}
export function deactivate(): void {}

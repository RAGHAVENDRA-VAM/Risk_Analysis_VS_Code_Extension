export interface ChangedFile { path: string; content: string; change_type: "added" | "modified" | "deleted"; }
export interface Finding { id: number; severity: string; ruleName: string; category: string; filePath: string; lineNumber: number; title: string; description: string; businessImpact: string; recommendation: string; suggestedCodeFix?: string; referenceLinks: string[]; }
export interface AnalysisResult { riskScore: number; severity: string; decision: string; confidence: number; summary: Record<string, number>; findings: Finding[]; scores: Record<string, number>; cached: boolean; }

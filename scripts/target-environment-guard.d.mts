export class UnsafeMutationTargetError extends Error {
  code: string;
}
export interface MutationTarget { targetEnvironment: string; origin: string; projectRef: string | null; }
export interface BrowserMutationTarget extends MutationTarget { appOrigin: string; }
export function assertSafeMutationTarget(args: { url: string; operation: string; env?: Record<string,string|undefined> }): MutationTarget;
export function assertSafeBrowserMutationTarget(args: { appUrl: string; supabaseUrl: string; operation: string; env?: Record<string,string|undefined> }): BrowserMutationTarget;
export function assertBrowserMutationTargetAttestation(args: { target: BrowserMutationTarget; operation: string; env?: Record<string,string|undefined>; fetchImpl?: typeof fetch }): Promise<BrowserMutationTarget & { attested: true }>;

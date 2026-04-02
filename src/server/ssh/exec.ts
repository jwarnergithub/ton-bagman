import "server-only";

export type RemoteExecRequest = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
};

export type RawRemoteExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
};

export type RemoteExecResult = RawRemoteExecResult & {
  commandLine: string;
  durationMs: number;
  ok: boolean;
};

export type RemoteCommandExecutor = {
  exec(commandLine: string): Promise<RawRemoteExecResult>;
};

type ExecDependencies = {
  now?: () => number;
};

function quoteShellArgument(value: string) {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function buildEnvPrefix(env: Record<string, string> | undefined) {
  if (!env) {
    return null;
  }

  const entries = Object.entries(env);
  if (entries.length === 0) {
    return null;
  }

  return `env ${entries
    .map(([key, value]) => `${key}=${quoteShellArgument(value)}`)
    .join(" ")}`;
}

export function buildRemoteCommandLine(request: RemoteExecRequest) {
  if (!request.command.trim()) {
    throw new Error("Remote command is required.");
  }

  const baseCommand = [request.command, ...(request.args ?? [])]
    .map(quoteShellArgument)
    .join(" ");

  const segments: string[] = [];

  if (request.cwd?.trim()) {
    segments.push(`cd ${quoteShellArgument(request.cwd.trim())}`);
  }

  const envPrefix = buildEnvPrefix(request.env);
  if (envPrefix) {
    segments.push(envPrefix);
  }

  segments.push(baseCommand);

  return segments.join(" && ");
}

export async function execRemoteCommand(
  executor: RemoteCommandExecutor,
  request: RemoteExecRequest,
  dependencies: ExecDependencies = {},
): Promise<RemoteExecResult> {
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  const commandLine = buildRemoteCommandLine(request);
  const result = await executor.exec(commandLine);

  return {
    ...result,
    commandLine,
    durationMs: now() - startedAt,
    ok: result.exitCode === 0,
  };
}

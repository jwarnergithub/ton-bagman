import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { ConnectConfig } from "ssh2";
import type { RuntimeConfig } from "@/src/server/config/env";
import {
  execRemoteCommand,
  type RawRemoteExecResult,
  type RemoteCommandExecutor,
  type RemoteExecRequest,
  type RemoteExecResult,
} from "@/src/server/ssh/exec";
import { uploadFileWithSftp, type SftpTransferClient, type SftpUploadRequest, type SftpUploadResult } from "@/src/server/ssh/sftp";

export type SshConnectionSummary = {
  configured: true;
  host: string;
  port: number;
  user: string;
  authMode: RuntimeConfig["sshAuthMode"];
  hostVerification: "fingerprint" | "known_hosts" | "fingerprint+known_hosts" | "missing";
  readyTimeoutMs: number;
  status: "configured";
};

export type SshConnectionTestResult = {
  ok: true;
  status: "connected";
  host: string;
  port: number;
  user: string;
  durationMs: number;
};

export type SshRunner = RemoteCommandExecutor & {
  openSftp(): Promise<SftpTransferClient>;
  dispose(): Promise<void>;
};

export type SshClient = {
  execute(request: RemoteExecRequest): Promise<RemoteExecResult>;
  uploadFile(request: SftpUploadRequest): Promise<SftpUploadResult>;
  dispose(): Promise<void>;
};

type ReadPrivateKey = (path: string) => Promise<string>;
type ReadTextFile = (path: string) => Promise<string>;

export type SshClientDependencies = {
  connectRunner?: (config: RuntimeConfig) => Promise<SshRunner>;
  createConnection?: () => Ssh2Connection;
  readPrivateKey?: ReadPrivateKey;
  readTextFile?: ReadTextFile;
  now?: () => number;
  statLocalFile?: (path: string) => Promise<{
    size: number;
  }>;
};

type Ssh2Connection = {
  once(event: "ready", listener: () => void): Ssh2Connection;
  once(event: "error", listener: (error: Error) => void): Ssh2Connection;
  connect(config: ConnectConfig): void;
  exec(
    command: string,
    callback: (error: Error | undefined, channel: SshExecChannel) => void,
  ): void;
  sftp(
    callback: (error: Error | undefined, sftp: Ssh2SftpConnection) => void,
  ): void;
  end(): void;
};

type SshExecChannel = {
  on(event: "data", listener: (chunk: Buffer | string) => void): SshExecChannel;
  once(
    event: "close",
    listener: (exitCode?: number, signal?: string) => void,
  ): SshExecChannel;
  once(event: "error", listener: (error: Error) => void): SshExecChannel;
  stderr: {
    on(event: "data", listener: (chunk: Buffer | string) => void): void;
  };
};

type Ssh2SftpConnection = {
  fastPut(
    localPath: string,
    remotePath: string,
    callback: (error?: Error) => void,
  ): void;
  end(): void;
};

const SSH_AUTH_FAILURE_PATTERN = /all configured authentication methods failed/i;

function getHostVerificationMode(config: RuntimeConfig) {
  if (config.sshHostFingerprint && config.sshKnownHostsPath) {
    return "fingerprint+known_hosts" as const;
  }

  if (config.sshHostFingerprint) {
    return "fingerprint" as const;
  }

  if (config.sshKnownHostsPath) {
    return "known_hosts" as const;
  }

  return "missing" as const;
}

async function resolvePrivateKey(
  config: RuntimeConfig,
  readPrivateKeyFile: ReadPrivateKey,
) {
  if (config.sshAuthMode === "inline_key" && config.sshPrivateKey) {
    return config.sshPrivateKey;
  }

  if (config.sshAuthMode === "key_path" && config.sshPrivateKeyPath) {
    return readPrivateKeyFile(config.sshPrivateKeyPath);
  }

  throw new Error("SSH private key configuration is required for this auth mode.");
}

function normalizeFingerprint(value: string) {
  return value.replace(/^SHA256:/, "").trim();
}

function getBufferFingerprint(key: Buffer) {
  return createHash("sha256").update(key).digest("base64");
}

function hostMatchesKnownHostsEntry(
  configuredHost: string,
  configuredPort: number,
  hostPattern: string,
) {
  const candidates = hostPattern.split(",").map((value) => value.trim());
  const portCandidate = `[${configuredHost}]:${configuredPort}`;

  return candidates.includes(configuredHost) || candidates.includes(portCandidate);
}

function verifyAgainstKnownHosts(
  config: RuntimeConfig,
  knownHostsContents: string,
  key: Buffer,
) {
  const keyBase64 = key.toString("base64");

  return knownHostsContents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .some((line) => {
      const [hosts, , encodedKey] = line.split(/\s+/, 3);

      if (!hosts || !encodedKey) {
        return false;
      }

      return (
        hostMatchesKnownHostsEntry(config.sshHost, config.sshPort, hosts) &&
        encodedKey === keyBase64
      );
    });
}

async function createHostVerifier(
  config: RuntimeConfig,
  readTextFile: ReadTextFile,
) {
  const knownHostsContents = config.sshKnownHostsPath
    ? await readTextFile(config.sshKnownHostsPath)
    : null;

  if (!config.sshHostFingerprint && !knownHostsContents) {
    throw new Error(
      "SSH host verification is required. Set TON_SSH_HOST_FINGERPRINT or TON_SSH_KNOWN_HOSTS_PATH.",
    );
  }

  return (key: Buffer) => {
    const fingerprintMatches = config.sshHostFingerprint
      ? getBufferFingerprint(key) === normalizeFingerprint(config.sshHostFingerprint)
      : false;
    const knownHostsMatch = knownHostsContents
      ? verifyAgainstKnownHosts(config, knownHostsContents, key)
      : false;

    return fingerprintMatches || knownHostsMatch;
  };
}

async function createSsh2Runner(
  config: RuntimeConfig,
  dependencies: Pick<
    SshClientDependencies,
    "createConnection" | "readPrivateKey" | "readTextFile"
  >,
): Promise<SshRunner> {
  const readTextFile =
    dependencies.readTextFile ?? (async (path: string) => readFile(path, "utf8"));
  const readPrivateKeyFile = dependencies.readPrivateKey ?? readTextFile;
  const createConnection =
    dependencies.createConnection ?? (await loadSsh2ConnectionFactory());
  const hostVerifier = await createHostVerifier(config, readTextFile);
  const client = createConnection();

  const connectionConfig: ConnectConfig = {
    host: config.sshHost,
    port: config.sshPort,
    username: config.sshUser,
    passphrase: config.sshPassphrase ?? undefined,
    readyTimeout: config.sshReadyTimeoutMs,
    hostVerifier,
  };

  if (config.sshAuthMode === "agent") {
    connectionConfig.agent = config.sshAgentSocket ?? undefined;
  } else {
    connectionConfig.privateKey = await resolvePrivateKey(config, readPrivateKeyFile);
  }

  try {
    await new Promise<void>((resolve, reject) => {
      client.once("ready", () => resolve());
      client.once("error", (error) => reject(error));
      client.connect(connectionConfig);
    });
  } catch (error) {
    throw describeSshConnectionError(error, config);
  }

  return {
    async exec(commandLine: string): Promise<RawRemoteExecResult> {
      return new Promise((resolve, reject) => {
        client.exec(commandLine, (error, channel) => {
          if (error) {
            reject(error);
            return;
          }

          let stdout = "";
          let stderr = "";

          channel.on("data", (chunk: Buffer | string) => {
            stdout += chunk.toString();
          });

          channel.stderr.on("data", (chunk: Buffer | string) => {
            stderr += chunk.toString();
          });

          channel.once(
            "close",
            (exitCode: number | undefined, signal: string | undefined) => {
              resolve({
                stdout,
                stderr,
                exitCode: exitCode ?? null,
                signal: signal ?? null,
              });
            },
          );

          channel.once("error", (channelError) => {
            reject(channelError);
          });
        });
      });
    },
    async openSftp(): Promise<SftpTransferClient> {
      return new Promise((resolve, reject) => {
        client.sftp((error, sftp) => {
          if (error) {
            reject(error);
            return;
          }

          resolve({
            fastPut(localPath: string, remotePath: string) {
              return new Promise<void>((putResolve, putReject) => {
                sftp.fastPut(localPath, remotePath, (putError) => {
                  if (putError) {
                    putReject(putError);
                    return;
                  }

                  putResolve();
                });
              });
            },
            close() {
              sftp.end();
            },
          });
        });
      });
    },
    async dispose() {
      client.end();
    },
  };
}

function describeSshConnectionError(error: unknown, config: RuntimeConfig) {
  if (!(error instanceof Error)) {
    return new Error("SSH connection failed.");
  }

  if (
    config.sshAuthMode === "agent" &&
    SSH_AUTH_FAILURE_PATTERN.test(error.message)
  ) {
    return new Error(
      "SSH authentication failed. TON_SSH_AUTH_MODE=agent requires the app process to have a working SSH_AUTH_SOCK. On a deployed server, prefer TON_SSH_AUTH_MODE=key_path with TON_SSH_PRIVATE_KEY_PATH unless your app service is explicitly started with access to your SSH agent socket.",
    );
  }

  return error;
}

async function loadSsh2ConnectionFactory(): Promise<() => Ssh2Connection> {
  const { Client } = await import("ssh2");
  return () => new Client() as Ssh2Connection;
}

export function getSshConnectionSummary(
  config: RuntimeConfig,
): SshConnectionSummary {
  return {
    configured: true,
    host: config.sshHost,
    port: config.sshPort,
    user: config.sshUser,
    authMode: config.sshAuthMode,
    hostVerification: getHostVerificationMode(config),
    readyTimeoutMs: config.sshReadyTimeoutMs,
    status: "configured",
  };
}

export async function createSshClient(
  config: RuntimeConfig,
  dependencies: SshClientDependencies = {},
): Promise<SshClient> {
  const runner =
    dependencies.connectRunner ??
    ((runtimeConfig: RuntimeConfig) =>
      createSsh2Runner(runtimeConfig, {
        createConnection: dependencies.createConnection,
        readPrivateKey: dependencies.readPrivateKey,
        readTextFile: dependencies.readTextFile,
      }));

  const activeRunner = await runner(config);

  return {
    execute(request: RemoteExecRequest) {
      return execRemoteCommand(activeRunner, request, {
        now: dependencies.now,
      });
    },
    async uploadFile(request: SftpUploadRequest) {
      const sftpClient = await activeRunner.openSftp();

      return uploadFileWithSftp(sftpClient, request, {
        now: dependencies.now,
        statLocalFile: dependencies.statLocalFile,
      });
    },
    async dispose() {
      await activeRunner.dispose();
    },
  };
}

export async function testSshConnection(
  config: RuntimeConfig,
  dependencies: SshClientDependencies = {},
): Promise<SshConnectionTestResult> {
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  const client = await createSshClient(config, dependencies);

  await client.dispose();

  return {
    ok: true,
    status: "connected",
    host: config.sshHost,
    port: config.sshPort,
    user: config.sshUser,
    durationMs: now() - startedAt,
  };
}

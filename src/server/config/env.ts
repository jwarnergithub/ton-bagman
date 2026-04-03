import "server-only";
import path from "node:path/posix";
import { z } from "zod";

export type AppEnv = "development" | "test" | "production";
export type SshAuthMode = "agent" | "key_path" | "inline_key";

export type RuntimeConfig = {
  appEnv: AppEnv;
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshAuthMode: SshAuthMode;
  sshAgentSocket: string | null;
  sshPrivateKey: string | null;
  sshPrivateKeyPath: string | null;
  sshPassphrase: string | null;
  sshHostFingerprint: string | null;
  sshKnownHostsPath: string | null;
  sshReadyTimeoutMs: number;
  tonDaemonControlAddress: string;
  tonDaemonCliKeyPath: string;
  tonDaemonServerPubPath: string;
  tonApiBaseUrl: string;
  tonApiKey: string | null;
  remoteBaseDir: string;
  remoteBagSourceDir: string;
  remoteDeleteAllowedDirs: string[];
  localStagingDir: string;
};

const LOCAL_STAGING_ROOT_DIR = ".ton-storage";
const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().min(1).optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    TON_SSH_HOST: z.string().trim().min(1, "TON_SSH_HOST is required."),
    TON_SSH_PORT: z.coerce.number().int().min(1).max(65535).default(22),
    TON_SSH_USER: z.string().trim().min(1, "TON_SSH_USER is required."),
    TON_SSH_AUTH_MODE: z
      .enum(["agent", "key_path", "inline_key"])
      .default("agent"),
    SSH_AUTH_SOCK: z.string().trim().min(1).optional(),
    TON_SSH_PRIVATE_KEY: z.string().trim().min(1).optional(),
    TON_SSH_PRIVATE_KEY_PATH: z.string().trim().min(1).optional(),
    TON_SSH_PASSPHRASE: z.string().optional(),
    TON_SSH_HOST_FINGERPRINT: z.string().trim().min(1).optional(),
    TON_SSH_KNOWN_HOSTS_PATH: z.string().trim().min(1).optional(),
    TON_SSH_READY_TIMEOUT_MS: z.coerce.number().int().min(1).default(20000),
    TON_DAEMON_CONTROL_ADDRESS: z
      .string()
      .trim()
      .min(1)
      .default("127.0.0.1:5555"),
    TON_DAEMON_CLI_KEY_PATH: z
      .string()
      .trim()
      .min(1)
      .default("/opt/ton-storage/db/cli-keys/client"),
    TON_DAEMON_SERVER_PUB_PATH: z
      .string()
      .trim()
      .min(1)
      .default("/opt/ton-storage/db/cli-keys/server.pub"),
    TONAPI_BASE_URL: z
      .string()
      .trim()
      .min(1)
      .default("https://tonapi.io"),
    TONAPI_API_KEY: optionalTrimmedString,
    TON_REMOTE_BASE_DIR: z
      .string()
      .trim()
      .min(1)
      .default("/var/lib/ton-storage"),
    TON_REMOTE_BAG_SOURCE_DIR: z.string().trim().min(1).optional(),
    TON_REMOTE_DELETE_ALLOWED_DIRS: z.string().optional(),
    TON_LOCAL_STAGING_DIR: z
      .string()
      .trim()
      .min(1)
      .default(".ton-storage/staging"),
  })
  .superRefine((value, context) => {
    if (value.TON_SSH_AUTH_MODE === "agent" && !value.SSH_AUTH_SOCK) {
      context.addIssue({
        code: "custom",
        message: "SSH_AUTH_SOCK is required when TON_SSH_AUTH_MODE=agent.",
        path: ["SSH_AUTH_SOCK"],
      });
    }

    if (
      value.TON_SSH_AUTH_MODE === "key_path" &&
      !value.TON_SSH_PRIVATE_KEY_PATH
    ) {
      context.addIssue({
        code: "custom",
        message:
          "TON_SSH_PRIVATE_KEY_PATH is required when TON_SSH_AUTH_MODE=key_path.",
        path: ["TON_SSH_PRIVATE_KEY_PATH"],
      });
    }

    if (
      value.TON_SSH_AUTH_MODE === "inline_key" &&
      !value.TON_SSH_PRIVATE_KEY
    ) {
      context.addIssue({
        code: "custom",
        message:
          "TON_SSH_PRIVATE_KEY is required when TON_SSH_AUTH_MODE=inline_key.",
        path: ["TON_SSH_PRIVATE_KEY"],
      });
    }

    if (
      value.TON_SSH_AUTH_MODE === "agent" &&
      value.TON_SSH_PASSPHRASE
    ) {
      context.addIssue({
        code: "custom",
        message:
          "TON_SSH_PASSPHRASE is only supported for key_path or inline_key auth modes.",
        path: ["TON_SSH_PASSPHRASE"],
      });
    }

    const hasHostVerification = Boolean(
      value.TON_SSH_HOST_FINGERPRINT || value.TON_SSH_KNOWN_HOSTS_PATH,
    );

    if (!hasHostVerification && value.NODE_ENV === "production") {
      context.addIssue({
        code: "custom",
        message:
          "Host verification is required in production. Set TON_SSH_HOST_FINGERPRINT or TON_SSH_KNOWN_HOSTS_PATH.",
        path: ["TON_SSH_HOST_FINGERPRINT"],
      });
    }
  });

let cachedConfig: RuntimeConfig | null = null;

export function parseRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const parsed = envSchema.parse(env);
  const remoteDeleteAllowedDirs = (
    parsed.TON_REMOTE_DELETE_ALLOWED_DIRS ?? parsed.TON_REMOTE_BASE_DIR
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    appEnv: parsed.NODE_ENV,
    sshHost: parsed.TON_SSH_HOST,
    sshPort: parsed.TON_SSH_PORT,
    sshUser: parsed.TON_SSH_USER,
    sshAuthMode: parsed.TON_SSH_AUTH_MODE,
    sshAgentSocket: parsed.SSH_AUTH_SOCK ?? null,
    sshPrivateKey: parsed.TON_SSH_PRIVATE_KEY ?? null,
    sshPrivateKeyPath: parsed.TON_SSH_PRIVATE_KEY_PATH ?? null,
    sshPassphrase: parsed.TON_SSH_PASSPHRASE ?? null,
    sshHostFingerprint: parsed.TON_SSH_HOST_FINGERPRINT ?? null,
    sshKnownHostsPath: parsed.TON_SSH_KNOWN_HOSTS_PATH ?? null,
    sshReadyTimeoutMs: parsed.TON_SSH_READY_TIMEOUT_MS,
    tonDaemonControlAddress: parsed.TON_DAEMON_CONTROL_ADDRESS,
    tonDaemonCliKeyPath: parsed.TON_DAEMON_CLI_KEY_PATH,
    tonDaemonServerPubPath: parsed.TON_DAEMON_SERVER_PUB_PATH,
    tonApiBaseUrl: parsed.TONAPI_BASE_URL.replace(/\/+$/, ""),
    tonApiKey: parsed.TONAPI_API_KEY ?? null,
    remoteBaseDir: parsed.TON_REMOTE_BASE_DIR,
    remoteBagSourceDir:
      parsed.TON_REMOTE_BAG_SOURCE_DIR ??
      path.join(path.dirname(parsed.TON_REMOTE_BASE_DIR), "bag-sources"),
    remoteDeleteAllowedDirs,
    localStagingDir: normalizeLocalStagingDir(parsed.TON_LOCAL_STAGING_DIR),
  };
}

export function getRuntimeConfig(): RuntimeConfig {
  if (!cachedConfig) {
    cachedConfig = parseRuntimeConfig(process.env);
  }

  return cachedConfig;
}

export function resetRuntimeConfigCache() {
  cachedConfig = null;
}

function normalizeLocalStagingDir(input: string) {
  const trimmed = input.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
  const withoutRootPrefix = trimmed.startsWith(`${LOCAL_STAGING_ROOT_DIR}/`)
    ? trimmed.slice(`${LOCAL_STAGING_ROOT_DIR}/`.length)
    : trimmed;
  const segments = withoutRootPrefix.split("/").map((segment) => segment.trim());

  if (
    !withoutRootPrefix ||
    withoutRootPrefix === LOCAL_STAGING_ROOT_DIR ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(
      "TON_LOCAL_STAGING_DIR must be a relative subdirectory inside .ton-storage.",
    );
  }

  return withoutRootPrefix;
}

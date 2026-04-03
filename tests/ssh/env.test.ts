import { describe, expect, it } from "vitest";
import { parseRuntimeConfig } from "../../src/server/config/env";

describe("parseRuntimeConfig", () => {
  it("parses a valid inline-key configuration", () => {
    const config = parseRuntimeConfig({
      NODE_ENV: "test",
      TON_SSH_HOST: "vps.example.com",
      TON_SSH_USER: "root",
      TON_SSH_AUTH_MODE: "inline_key",
      TON_SSH_PRIVATE_KEY: "PRIVATE KEY DATA",
      TON_SSH_HOST_FINGERPRINT: "SHA256:example",
    });

    expect(config).toMatchObject({
      appEnv: "test",
      sshHost: "vps.example.com",
      sshPort: 22,
      sshUser: "root",
      sshAuthMode: "inline_key",
      sshPrivateKey: "PRIVATE KEY DATA",
      sshPrivateKeyPath: null,
      sshHostFingerprint: "SHA256:example",
      tonApiBaseUrl: "https://tonapi.io",
      tonApiKey: null,
      remoteBagSourceDir: "/var/lib/bag-sources",
      localStagingDir: "staging",
    });
  });

  it("parses a valid key-path configuration", () => {
    const config = parseRuntimeConfig({
      NODE_ENV: "production",
      TON_SSH_HOST: "192.0.2.10",
      TON_SSH_PORT: "2222",
      TON_SSH_USER: "deploy",
      TON_SSH_AUTH_MODE: "key_path",
      TON_SSH_PRIVATE_KEY_PATH: "/keys/vultr",
      TON_SSH_KNOWN_HOSTS_PATH: "/keys/known_hosts",
      TON_SSH_READY_TIMEOUT_MS: "5000",
    });

    expect(config).toMatchObject({
      appEnv: "production",
      sshHost: "192.0.2.10",
      sshPort: 2222,
      sshUser: "deploy",
      sshAuthMode: "key_path",
      sshPrivateKey: null,
      sshPrivateKeyPath: "/keys/vultr",
      sshKnownHostsPath: "/keys/known_hosts",
      sshReadyTimeoutMs: 5000,
      tonApiBaseUrl: "https://tonapi.io",
      tonApiKey: null,
      remoteBagSourceDir: "/var/lib/bag-sources",
      localStagingDir: "staging",
    });
  });

  it("parses TonAPI settings when provided", () => {
    const config = parseRuntimeConfig({
      NODE_ENV: "test",
      TON_SSH_HOST: "vps.example.com",
      TON_SSH_USER: "root",
      TON_SSH_HOST_FINGERPRINT: "SHA256:example",
      SSH_AUTH_SOCK: "/tmp/agent.sock",
      TONAPI_BASE_URL: "https://tonapi.io/",
      TONAPI_API_KEY: "test-key",
    });

    expect(config).toMatchObject({
      tonApiBaseUrl: "https://tonapi.io",
      tonApiKey: "test-key",
    });
  });

  it("treats an empty TonAPI key as unset", () => {
    const config = parseRuntimeConfig({
      NODE_ENV: "test",
      TON_SSH_HOST: "vps.example.com",
      TON_SSH_USER: "root",
      TON_SSH_HOST_FINGERPRINT: "SHA256:example",
      SSH_AUTH_SOCK: "/tmp/agent.sock",
      TONAPI_API_KEY: "",
    });

    expect(config.tonApiKey).toBeNull();
  });

  it("parses a valid agent configuration", () => {
    const config = parseRuntimeConfig({
      NODE_ENV: "test",
      TON_SSH_HOST: "vps.example.com",
      TON_SSH_USER: "root",
      TON_SSH_HOST_FINGERPRINT: "SHA256:example",
      SSH_AUTH_SOCK: "/tmp/agent.sock",
    });

    expect(config).toMatchObject({
      sshAuthMode: "agent",
      sshAgentSocket: "/tmp/agent.sock",
    });
  });

  it("normalizes the legacy .ton-storage-prefixed staging directory", () => {
    const config = parseRuntimeConfig({
      NODE_ENV: "test",
      TON_SSH_HOST: "vps.example.com",
      TON_SSH_USER: "root",
      TON_SSH_HOST_FINGERPRINT: "SHA256:example",
      SSH_AUTH_SOCK: "/tmp/agent.sock",
      TON_LOCAL_STAGING_DIR: ".ton-storage/staging",
    });

    expect(config.localStagingDir).toBe("staging");
  });

  it("rejects staging directories that escape the bounded local staging root", () => {
    expect(() =>
      parseRuntimeConfig({
        NODE_ENV: "test",
        TON_SSH_HOST: "vps.example.com",
        TON_SSH_USER: "root",
        TON_SSH_HOST_FINGERPRINT: "SHA256:example",
        SSH_AUTH_SOCK: "/tmp/agent.sock",
        TON_LOCAL_STAGING_DIR: "../outside",
      }),
    ).toThrow(/relative subdirectory inside \.ton-storage/);
  });

  it("rejects agent mode without SSH_AUTH_SOCK", () => {
    expect(() =>
      parseRuntimeConfig({
        NODE_ENV: "test",
        TON_SSH_HOST: "vps.example.com",
        TON_SSH_USER: "root",
        TON_SSH_HOST_FINGERPRINT: "SHA256:example",
      }),
    ).toThrow(/SSH_AUTH_SOCK/);
  });

  it("rejects passphrases in agent mode", () => {
    expect(() =>
      parseRuntimeConfig({
        NODE_ENV: "test",
        TON_SSH_HOST: "vps.example.com",
        TON_SSH_USER: "root",
        TON_SSH_HOST_FINGERPRINT: "SHA256:example",
        SSH_AUTH_SOCK: "/tmp/agent.sock",
        TON_SSH_PASSPHRASE: "secret",
      }),
    ).toThrow(/only supported for key_path or inline_key/);
  });

  it("fails startup in production without host verification config", () => {
    expect(() =>
      parseRuntimeConfig({
        NODE_ENV: "production",
        TON_SSH_HOST: "vps.example.com",
        TON_SSH_USER: "root",
        SSH_AUTH_SOCK: "/tmp/agent.sock",
      }),
    ).toThrow(/Host verification is required in production/);
  });
});

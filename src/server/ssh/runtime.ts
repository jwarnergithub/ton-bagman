import "server-only";
import { getRuntimeConfig, type RuntimeConfig } from "@/src/server/config/env";
import { createSshClient, type SshClient } from "@/src/server/ssh/client";

export async function withSshClient<T>(
  callback: (client: SshClient, config: RuntimeConfig) => Promise<T>,
) {
  const config = getRuntimeConfig();
  const client = await createSshClient(config);

  try {
    return await callback(client, config);
  } finally {
    await client.dispose();
  }
}

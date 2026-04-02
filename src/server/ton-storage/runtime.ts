import "server-only";
import { withSshClient } from "@/src/server/ssh/runtime";
import {
  createTonStorageService,
  type TonStorageService,
} from "@/src/server/ton-storage/service";

export async function withTonStorageService<T>(
  callback: (service: TonStorageService) => Promise<T>,
) {
  return withSshClient(async (sshClient, config) => {
    const service = createTonStorageService({
      config: {
        tonDaemonControlAddress: config.tonDaemonControlAddress,
        tonDaemonCliKeyPath: config.tonDaemonCliKeyPath,
        tonDaemonServerPubPath: config.tonDaemonServerPubPath,
      },
      execute: (request) => sshClient.execute(request),
    });

    return await callback(service);
  });
}

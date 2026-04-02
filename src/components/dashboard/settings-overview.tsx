import { ConnectionTestForm } from "@/src/components/shared/connection-test-form";
import { KeyValueList } from "@/src/components/shared/key-value-list";
import { PageShell } from "@/src/components/shared/page-shell";
import { Panel } from "@/src/components/shared/panel";
import { RemoteDeleteForm } from "@/src/components/shared/remote-delete-form";
import { getRuntimeConfig } from "@/src/server/config/env";
import { getSshConnectionSummary } from "@/src/server/ssh/client";

function getSettingsData() {
  try {
    const config = getRuntimeConfig();
    const summary = getSshConnectionSummary(config);

    return {
      summary,
      config,
      error: null,
    };
  } catch (error) {
    return {
      summary: null,
      config: null,
      error: error instanceof Error ? error.message : "Configuration unavailable.",
    };
  }
}

export async function SettingsOverview() {
  const { summary, config, error } = getSettingsData();

  return (
    <PageShell
      eyebrow="Safety"
      title="Safety and Diagnostics"
      description="Review safe runtime details, test the VPS connection, and use guarded maintenance tools."
    >
      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Panel
          title="Runtime Summary"
          description="Only secret-safe connection details are shown here."
        >
          {summary && config ? (
            <KeyValueList
              items={[
                { label: "Host", value: summary.host },
                { label: "Port", value: String(summary.port) },
                { label: "User", value: summary.user },
                { label: "Auth mode", value: summary.authMode },
                { label: "Ready timeout", value: `${summary.readyTimeoutMs} ms` },
                { label: "Remote base dir", value: config.remoteBaseDir },
                { label: "Remote bag source dir", value: config.remoteBagSourceDir },
                { label: "Local staging dir", value: config.localStagingDir },
              ]}
            />
          ) : (
            <p className="text-sm leading-6 text-rose-700">{error}</p>
          )}
        </Panel>

        <Panel
          title="Connection Test"
          description="Runs the explicit connection-test endpoint and shows the JSON response."
        >
          <ConnectionTestForm />
        </Panel>
      </section>

      <Panel
        title="Guarded Destructive Action"
        description="Use this only when you want to permanently delete a file or folder from the VPS. The app asks for extra confirmation before it will allow the deletion."
      >
        <RemoteDeleteForm />
      </Panel>
    </PageShell>
  );
}

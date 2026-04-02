import { DataPill } from "@/src/components/shared/data-pill";
import { RemoveRemoteItemForm } from "@/src/components/shared/remove-remote-item-form";
import type { RemoteFileEntry } from "@/src/server/files/remoteFiles";

type RemoteUploadsTreeProps = {
  directory: string;
  items: RemoteFileEntry[];
};

type TreeNode = {
  name: string;
  path: string;
  kind: RemoteFileEntry["kind"] | "directory";
  item?: RemoteFileEntry;
  children: TreeNode[];
};

export function RemoteUploadsTree({ directory, items }: RemoteUploadsTreeProps) {
  const tree = buildRemoteTree(directory, items);

  return (
    <ul className="space-y-2 text-sm">
      {tree.map((node) => (
        <TreeNodeView key={node.path} node={node} depth={0} />
      ))}
    </ul>
  );
}

function TreeNodeView({ node, depth }: { node: TreeNode; depth: number }) {
  const targetName = node.item?.name ?? node.name;

  return (
    <li>
      <div
        className="flex flex-col gap-2 rounded-2xl px-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
      >
        <div className="min-w-0">
          <p className="truncate font-medium">
            {node.kind === "directory" ? `${node.name}/` : node.name}
          </p>
          <p className="text-xs break-all text-[var(--color-ink-muted)]">{node.path}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DataPill label="Type" value={node.kind} />
          <DataPill
            label="Size"
            value={
              node.item?.sizeBytes === null || node.item?.sizeBytes === undefined
                ? "Unknown"
                : formatBytes(node.item.sizeBytes)
            }
          />
          <RemoveRemoteItemForm remotePath={node.path} targetName={targetName} />
        </div>
      </div>
      {node.children.length > 0 ? (
        <ul className="space-y-1">
          {node.children.map((child) => (
            <TreeNodeView key={child.path} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function buildRemoteTree(directory: string, items: RemoteFileEntry[]) {
  const roots: TreeNode[] = [];

  for (const item of items) {
    const relativePath = item.remotePath.startsWith(`${directory}/`)
      ? item.remotePath.slice(directory.length + 1)
      : item.name;
    const segments = relativePath.split("/").filter(Boolean);
    let currentLevel = roots;
    let currentPath = directory;

    segments.forEach((segment, index) => {
      currentPath = `${currentPath}/${segment}`;
      let node = currentLevel.find((entry) => entry.name === segment);

      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          kind: index === segments.length - 1 ? item.kind : "directory",
          children: [],
        };
        currentLevel.push(node);
      }

      if (index === segments.length - 1) {
        node.item = item;
      }

      currentLevel = node.children;
    });
  }

  return roots.sort((left, right) => left.path.localeCompare(right.path));
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${sizeBytes} B`;
}

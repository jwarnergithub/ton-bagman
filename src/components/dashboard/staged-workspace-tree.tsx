import { DataPill } from "@/src/components/shared/data-pill";
import { RemoveStagedItemButton } from "@/src/components/shared/remove-staged-item-button";
import type { StagedFile } from "@/src/server/files/staging";

type StagedWorkspaceTreeProps = {
  items: StagedFile[];
};

type TreeNode = {
  name: string;
  path: string;
  kind: "file" | "directory";
  stagedFile?: StagedFile;
  children: TreeNode[];
};

export function StagedWorkspaceTree({ items }: StagedWorkspaceTreeProps) {
  const tree = buildStagedTree(items);

  return (
    <ul className="space-y-2 text-sm">
      {tree.map((node) => (
        <TreeNodeView key={node.path} node={node} depth={0} />
      ))}
    </ul>
  );
}

function TreeNodeView({ node, depth }: { node: TreeNode; depth: number }) {
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
          {node.stagedFile ? (
            <p className="text-xs text-[var(--color-ink-muted)]">
              Staged {new Date(node.stagedFile.storedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {node.stagedFile ? (
            <>
              <DataPill label="Size" value={formatBytes(node.stagedFile.sizeBytes)} />
              <RemoveStagedItemButton stagedFileId={node.stagedFile.id} />
            </>
          ) : (
            <DataPill label="Type" value="folder" />
          )}
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

function buildStagedTree(items: StagedFile[]) {
  const roots: TreeNode[] = [];

  for (const item of items) {
    const segments = item.relativePath.split("/");
    let currentLevel = roots;
    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      let node = currentLevel.find((entry) => entry.name === segment);

      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          kind: index === segments.length - 1 ? "file" : "directory",
          children: [],
        };
        currentLevel.push(node);
      }

      if (index === segments.length - 1) {
        node.stagedFile = item;
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

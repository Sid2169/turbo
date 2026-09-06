import { useCallback, useEffect, useRef, useState } from "react";
import { FileSystemTree, WebContainer } from "@webcontainer/api";

import { 
  buildFileTree,
  getFilePath
} from "@/features/preview/utils/file-tree";
import { useFiles } from "@/features/projects/hooks/use-files";

import { Doc, Id } from "../../../../convex/_generated/dataModel";

// Singleton WebContainer instance
let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

const getWebContainer = async (): Promise<WebContainer> => {
  if (webcontainerInstance) {
    return webcontainerInstance;
  }

  if (!bootPromise) {
    bootPromise = WebContainer.boot({ coep: "credentialless" });
  }

  webcontainerInstance = await bootPromise;
  return webcontainerInstance;
};

const teardownWebContainer = () => {
  if (webcontainerInstance) {
    webcontainerInstance.teardown();
    webcontainerInstance = null;
  }
  bootPromise = null;
};

/**
 * Locate the folder relative to the mounted root that contains package.json.
 * Returns "" when it is at the root, a subpath like "app" when nested, and
 * null when the project has no package.json at all.
 */
const findProjectRootDir = (files: Doc<"files">[]): string | null => {
  const filesMap = new Map(files.map((f) => [f._id, f]));
  const packageJson = files.find(
    (f) => f.type === "file" && f.name === "package.json" && !f.storageId
  );

  if (!packageJson) {
    return null;
  }

  const path = getFilePath(packageJson, filesMap).split("/");
  path.pop();

  return path.join("/");
};

/**
 * Locate the folder containing index.html for static sites. Returns "" when
 * index.html is at the root, a subpath when nested, and null when the project
 * has no index.html at all.
 */
const findStaticIndexDir = (files: Doc<"files">[]): string | null => {
  const filesMap = new Map(files.map((f) => [f._id, f]));
  const indexHtml = files.find(
    (f) =>
      f.type === "file" &&
      !f.storageId &&
      (f.name === "index.html" || f.name === "index.htm")
  );

  if (!indexHtml) {
    return null;
  }

  const path = getFilePath(indexHtml, filesMap).split("/");
  path.pop();

  return path.join("/");
};

/**
 * Insert an extra file into a FileSystemTree at the given relative directory.
 */
const injectIntoTree = (
  tree: FileSystemTree,
  relDir: string,
  name: string,
  contents: string
): FileSystemTree => {
  const parts = relDir ? relDir.split("/") : [];
  let node = tree;

  for (const part of parts) {
    const child = node[part];
    if (child && "directory" in child) {
      node = child.directory;
    } else {
      const dir = { directory: {} };
      node[part] = dir;
      node = dir.directory;
    }
  }

  node[name] = { file: { contents } };

  return tree;
};

const STATIC_SERVER_JS = `
const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

const root = path.resolve(__dirname);

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }

  let filePath;
  if (pathname === "/" || pathname === "") {
    const index = ["index.html", "index.htm"].find((name) =>
      fs.existsSync(path.join(root, name))
    );
    filePath = path.join(root, index || "index.html");
  } else {
    filePath = path.join(root, pathname);
  }

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type":
        MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    });
    res.end(data);
  });
});

server.listen(8080, "0.0.0.0", () => {
  console.log("Static preview server running on http://0.0.0.0:8080");
});
`;

interface UseWebContainerProps {
  projectId: Id<"projects">;
  enabled: boolean;
  settings?: {
    installCommand?: string;
    devCommand?: string;
  };
};

export const useWebContainer = ({
  projectId,
  enabled,
  settings,
}: UseWebContainerProps) => {
  const [status, setStatus] = useState<
    "idle" | "booting" | "installing" | "running" | "error"
  >("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [terminalOutput, setTerminalOutput] = useState("");

  const containerRef = useRef<WebContainer | null>(null);
  const hasStartedRef = useRef(false);

  // Fetch files from Convex (auto-updates on changes)
  const files = useFiles(projectId);

  // Initial boot and mount
  useEffect(() => {
    if (!enabled || !files || files.length === 0 || hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    const start = async () => {
      try {
        setStatus("booting");
        setError(null);
        setTerminalOutput("");

        const appendOutput = (data: string) => {
          setTerminalOutput((prev) => prev + data);
        };

        const container = await getWebContainer();
        containerRef.current = container;

        const projectRoot = findProjectRootDir(files);
        const staticIndexDir = projectRoot === null
          ? findStaticIndexDir(files)
          : null;

        const isStatic = projectRoot === null && staticIndexDir !== null;

        if (projectRoot === null && staticIndexDir === null) {
          throw new Error(
            "Could not find package.json or index.html in this project, so there is nothing to run in the preview."
          );
        }

        let fileTree = buildFileTree(files);
        let spawnOptions: { cwd: string } | undefined;

        if (isStatic) {
          // Static site: inject a dependency-free Node file server for previewing.
          fileTree = injectIntoTree(
            fileTree,
            staticIndexDir as string,
            "server.js",
            STATIC_SERVER_JS
          );
          spawnOptions = staticIndexDir
            ? { cwd: staticIndexDir as string }
            : undefined;
        } else {
          spawnOptions = projectRoot
            ? { cwd: projectRoot as string }
            : undefined;
        }

        await container.mount(fileTree);

        let devServerReady = false;

        container.on("server-ready", (_port, url) => {
          devServerReady = true;
          setPreviewUrl(url);
          setStatus("running");
        });

        if (isStatic) {
          setStatus("installing");

          const devCmd = "node server.js";
          appendOutput(`$ ${devCmd}\n`);
          const devProcess = await container.spawn("node", ["server.js"], spawnOptions);
          devProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                appendOutput(data);
              },
            })
          );

          // Surface dev server failures instead of hanging on "Installing..."
          devProcess.exit.then((code) => {
            if (!devServerReady) {
              setStatus("error");
              setError(
                `${devCmd} exited with code ${code}. Check the terminal output above.`
              );
            }
          });

          return;
        }

        setStatus("installing");

        // Parse install command (default: npm install)
        const installCmd = settings?.installCommand || "npm install";
        const [installBin, ...installArgs] = installCmd.split(" ");
        appendOutput(`$ ${installCmd}\n`)
        const installProcess = await container.spawn(
          installBin,
          installArgs,
          spawnOptions
        );
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              appendOutput(data);
            },
          })
        );
        const installExitCode = await installProcess.exit;

        if (installExitCode !== 0) {
          throw new Error(
            `${installCmd} failed with code ${installExitCode}. Check the terminal output above.`
          );
        }

        // Parse dev command (default: npm run dev)
        const devCmd = settings?.devCommand || "npm run dev";
        const [devBin, ...devArgs] = devCmd.split(" ");
        appendOutput(`\n$ ${devCmd}\n`);
        const devProcess = await container.spawn(devBin, devArgs, spawnOptions);
        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              appendOutput(data);
            },
          })
        );

        // Surface dev server failures instead of hanging on "Installing..."
        devProcess.exit.then((code) => {
          if (!devServerReady) {
            setStatus("error");
            setError(
              `${devCmd} exited with code ${code}. Check the terminal output above.`
            );
          }
        });
      } catch (error) {
        setError(error instanceof Error ? error.message : "Unknown error");
        setStatus("error");
      }
    };

    start();
  }, [
    enabled,
    files,
    restartKey,
    settings?.devCommand,
    settings?.installCommand,
  ]);

  // Sync file changes (hot-reload)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !files || status !== "running") return;

    const filesMap = new Map(files.map((f) => [f._id, f]));

    for (const file of files) {
      if (file.type !== "file" || file.storageId || !file.content) continue;

      const filePath = getFilePath(file, filesMap);
      container.fs.writeFile(filePath, file.content);
    }
  }, [files, status]);

  // Reset when disabled
  useEffect(() => {
    if (!enabled) {
      hasStartedRef.current = false;
      setStatus("idle");
      setPreviewUrl(null);
      setError(null);
    }
  }, [enabled]);

  // Restart the entire WebContainer process
  const restart = useCallback(() => {
    teardownWebContainer();
    containerRef.current = null;
    hasStartedRef.current = false;
    setStatus("idle");
    setPreviewUrl(null);
    setError(null);
    setRestartKey((k) => k + 1);
  }, []);

  return {
    status,
    previewUrl,
    error,
    restart,
    terminalOutput,
  };
};

const fs = require("fs/promises");
const path = require("path");

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMANDS = {
  CREATE_FILE: "create a file",
  DELETE_FILE: "delete the file",
  RENAME_FILE: "rename the file",
  ADD_TO_FILE: "add to the file",
  READ_FILE:   "read the file",
  COPY_FILE:   "copy the file",
  LIST_DIR:    "list the directory",
  FILE_INFO:   "file info",
};

const COMMAND_FILE = "./command.txt";

// ─── Logger ───────────────────────────────────────────────────────────────────

const logger = {
  info:    (msg) => console.log(`[INFO]  ${new Date().toISOString()} — ${msg}`),
  success: (msg) => console.log(`[OK]    ${new Date().toISOString()} — ${msg}`),
  warn:    (msg) => console.warn(`[WARN]  ${new Date().toISOString()} — ${msg}`),
  error:   (msg, err) =>
    console.error(`[ERROR] ${new Date().toISOString()} — ${msg}${err ? `: ${err.message}` : ""}`),
};

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Resolves and validates a path so it stays within the working directory.
 * Prevents path-traversal attacks (e.g. "../../etc/passwd").
 */
const resolveSafePath = (rawPath) => {
  if (!rawPath || !rawPath.trim()) throw new Error("Empty path provided.");
  const resolved = path.resolve(rawPath.trim());
  const cwd = path.resolve(".");
  if (!resolved.startsWith(cwd)) {
    throw new Error(`Path traversal detected: "${rawPath}" escapes working directory.`);
  }
  return resolved;
};

const pathExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

// ─── Commands ─────────────────────────────────────────────────────────────────

/**
 * create a file <path>
 * Bug fixed: original used "w" flag (truncates) to check existence.
 * Now correctly checks with access() before creating.
 */
const createFile = async (rawPath) => {
  try {
    const filePath = resolveSafePath(rawPath);
    if (await pathExists(filePath)) {
      logger.warn(`File already exists: "${filePath}"`);
      return;
    }
    // Ensure parent directories exist
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const handle = await fs.open(filePath, "w");
    await handle.close();
    logger.success(`File created: "${filePath}"`);
  } catch (err) {
    logger.error(`createFile failed for "${rawPath}"`, err);
  }
};

/**
 * delete the file <path>
 * Bug fixed: original opened with "r" then closed before unlinking — redundant
 * and races between the close and unlink. Now uses a single access check.
 */
const deleteFile = async (rawPath) => {
  try {
    const filePath = resolveSafePath(rawPath);
    if (!(await pathExists(filePath))) {
      logger.warn(`File not found, cannot delete: "${filePath}"`);
      return;
    }
    await fs.unlink(filePath);
    logger.success(`File deleted: "${filePath}"`);
  } catch (err) {
    logger.error(`deleteFile failed for "${rawPath}"`, err);
  }
};

/**
 * rename the file <old path> to <new path>
 * Bug fixed: original opened with "w" flag which would CREATE / truncate the
 * source file if it didn't exist, then try to rename it — wrong behavior.
 */
const renameFile = async (rawOldPath, rawNewPath) => {
  try {
    const oldPath = resolveSafePath(rawOldPath);
    const newPath = resolveSafePath(rawNewPath);
    if (!(await pathExists(oldPath))) {
      logger.warn(`Source file not found: "${oldPath}"`);
      return;
    }
    if (await pathExists(newPath)) {
      logger.warn(`Destination already exists: "${newPath}". Rename aborted.`);
      return;
    }
    await fs.mkdir(path.dirname(newPath), { recursive: true });
    await fs.rename(oldPath, newPath);
    logger.success(`File renamed: "${oldPath}" → "${newPath}"`);
  } catch (err) {
    logger.error(`renameFile failed ("${rawOldPath}" → "${rawNewPath}")`, err);
  }
};

/**
 * add to the file <path> this content: <content>
 * Bug fixed: original called existingFileHandle.write() (returns a Promise)
 * without awaiting it, so content could be lost on fast close.
 */
const addToFile = async (rawPath, content) => {
  try {
    const filePath = resolveSafePath(rawPath);
    // Auto-create file if it doesn't exist
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const handle = await fs.open(filePath, "a");
    await handle.write(content);
    await handle.close();
    logger.success(`Content appended to: "${filePath}"`);
  } catch (err) {
    logger.error(`addToFile failed for "${rawPath}"`, err);
  }
};

/**
 * read the file <path>   (NEW)
 */
const readFile = async (rawPath) => {
  try {
    const filePath = resolveSafePath(rawPath);
    if (!(await pathExists(filePath))) {
      logger.warn(`File not found: "${filePath}"`);
      return;
    }
    const content = await fs.readFile(filePath, "utf-8");
    logger.success(`Contents of "${filePath}":`);
    console.log("─".repeat(60));
    console.log(content || "(empty file)");
    console.log("─".repeat(60));
  } catch (err) {
    logger.error(`readFile failed for "${rawPath}"`, err);
  }
};

/**
 * copy the file <source> to <destination>   (NEW)
 */
const copyFile = async (rawSrc, rawDest) => {
  try {
    const src  = resolveSafePath(rawSrc);
    const dest = resolveSafePath(rawDest);
    if (!(await pathExists(src))) {
      logger.warn(`Source file not found: "${src}"`);
      return;
    }
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
    logger.success(`File copied: "${src}" → "${dest}"`);
  } catch (err) {
    logger.error(`copyFile failed ("${rawSrc}" → "${rawDest}")`, err);
  }
};

/**
 * list the directory <path>   (NEW)
 */
const listDirectory = async (rawPath) => {
  try {
    const dirPath = resolveSafePath(rawPath || ".");
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    logger.success(`Contents of "${dirPath}":`);
    console.log("─".repeat(60));
    if (entries.length === 0) {
      console.log("  (empty directory)");
    } else {
      for (const entry of entries) {
        const type = entry.isDirectory() ? "DIR " : "FILE";
        console.log(`  [${type}] ${entry.name}`);
      }
    }
    console.log("─".repeat(60));
  } catch (err) {
    logger.error(`listDirectory failed for "${rawPath}"`, err);
  }
};

/**
 * file info <path>   (NEW)
 */
const fileInfo = async (rawPath) => {
  try {
    const filePath = resolveSafePath(rawPath);
    if (!(await pathExists(filePath))) {
      logger.warn(`Path not found: "${filePath}"`);
      return;
    }
    const stats = await fs.stat(filePath);
    logger.success(`Info for "${filePath}":`);
    console.log("─".repeat(60));
    console.log(`  Type     : ${stats.isDirectory() ? "Directory" : "File"}`);
    console.log(`  Size     : ${stats.size} bytes`);
    console.log(`  Created  : ${stats.birthtime.toISOString()}`);
    console.log(`  Modified : ${stats.mtime.toISOString()}`);
    console.log(`  Accessed : ${stats.atime.toISOString()}`);
    console.log("─".repeat(60));
  } catch (err) {
    logger.error(`fileInfo failed for "${rawPath}"`, err);
  }
};

// ─── Command Parser ───────────────────────────────────────────────────────────

const parseAndExecute = async (raw) => {
  // Trim whitespace / BOM / null bytes that editors sometimes inject
  const command = raw.replace(/^\uFEFF/, "").trim().replace(/\r\n/g, "\n");

  if (!command) {
    logger.warn("Received empty command — ignoring.");
    return;
  }

  logger.info(`Command received: "${command}"`);

  if (command.startsWith(COMMANDS.CREATE_FILE)) {
    const filePath = command.substring(COMMANDS.CREATE_FILE.length).trim();
    await createFile(filePath);

  } else if (command.startsWith(COMMANDS.DELETE_FILE)) {
    const filePath = command.substring(COMMANDS.DELETE_FILE.length).trim();
    await deleteFile(filePath);

  } else if (command.startsWith(COMMANDS.RENAME_FILE)) {
    const rest = command.substring(COMMANDS.RENAME_FILE.length).trim();
    const toIdx = rest.indexOf(" to ");
    if (toIdx === -1) {
      logger.error('rename syntax: rename the file <old> to <new>');
      return;
    }
    const oldPath = rest.substring(0, toIdx).trim();
    const newPath = rest.substring(toIdx + 4).trim();
    await renameFile(oldPath, newPath);

  } else if (command.startsWith(COMMANDS.ADD_TO_FILE)) {
    const rest     = command.substring(COMMANDS.ADD_TO_FILE.length).trim();
    const marker   = " this content: ";
    const markerIdx = rest.indexOf(marker);
    if (markerIdx === -1) {
      logger.error('addToFile syntax: add to the file <path> this content: <text>');
      return;
    }
    const filePath = rest.substring(0, markerIdx).trim();
    const content  = rest.substring(markerIdx + marker.length);
    await addToFile(filePath, content);

  } else if (command.startsWith(COMMANDS.READ_FILE)) {
    const filePath = command.substring(COMMANDS.READ_FILE.length).trim();
    await readFile(filePath);

  } else if (command.startsWith(COMMANDS.COPY_FILE)) {
    const rest  = command.substring(COMMANDS.COPY_FILE.length).trim();
    const toIdx = rest.indexOf(" to ");
    if (toIdx === -1) {
      logger.error('copyFile syntax: copy the file <src> to <dest>');
      return;
    }
    const src  = rest.substring(0, toIdx).trim();
    const dest = rest.substring(toIdx + 4).trim();
    await copyFile(src, dest);

  } else if (command.startsWith(COMMANDS.LIST_DIR)) {
    const dirPath = command.substring(COMMANDS.LIST_DIR.length).trim() || ".";
    await listDirectory(dirPath);

  } else if (command.startsWith(COMMANDS.FILE_INFO)) {
    const filePath = command.substring(COMMANDS.FILE_INFO.length).trim();
    await fileInfo(filePath);

  } else {
    logger.warn(`Unknown command: "${command}"`);
    logger.info("Available commands:");
    Object.values(COMMANDS).forEach((c) => console.log(`  • ${c} ...`));
  }
};

// ─── Main Watcher ─────────────────────────────────────────────────────────────

(async () => {
  // Ensure command.txt exists before watching
  if (!(await pathExists(COMMAND_FILE))) {
    const handle = await fs.open(COMMAND_FILE, "w");
    await handle.close();
    logger.info(`Created missing command file: "${COMMAND_FILE}"`);
  }

  logger.info(`Watching "${COMMAND_FILE}" for changes…`);
  logger.info("Write a command to the file and save it.");

  let processing = false; // debounce / prevent overlapping executions
  let lastContent = "";

  const file = await fs.open(COMMAND_FILE, "r");

  file.on("change", async () => {
    if (processing) return;
    processing = true;
    try {
      const size = (await file.stat()).size;
      if (size === 0) { processing = false; return; }

      const buffer = Buffer.alloc(size);
      await file.read(buffer, 0, size, 0);
      const content = buffer.toString("utf-8");

      // Skip duplicate events (many editors fire multiple change events on save)
      if (content === lastContent) { processing = false; return; }
      lastContent = content;

      await parseAndExecute(content);
    } catch (err) {
      logger.error("Unexpected error while processing command", err);
    } finally {
      processing = false;
    }
  });

  const watcher = fs.watch(COMMAND_FILE);

  for await (const event of watcher) {
    if (event.eventType === "change") {
      file.emit("change");
    }
  }
})();
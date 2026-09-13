"use strict";

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const projectRoot = path.resolve(__dirname, "..", "..");
const checkScript = path.join(projectRoot, "tools", "check-code.js");
const statusFile = path.join(projectRoot, "preview-templates", "typecheck-status.js");
const watchedDirs = ["assets", "tests"];
const CHECK_DEBOUNCE_MS = 500;

const watchers = [];
let debounceTimer = null;
let isChecking = false;
let isCheckQueued = false;

function runCheck(onDone) {
    execFile(
        process.execPath,
        [checkScript],
        {
            cwd: projectRoot,
            env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: "1" }),
            maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
            if (!error) {
                onDone([]);
                return;
            }
            const output = (stderr || stdout || error.message).trim();
            onDone(output.split(/\r?\n/).filter((line) => line.trim().length > 0));
        }
    );
}

function writeStatus(state, errors) {
    const status = JSON.stringify({ state, errors });
    fs.writeFileSync(statusFile, `window.TYPECHECK_STATUS = ${status};\n`);
}

function checkAndPublish() {
    if (isChecking) {
        isCheckQueued = true;
        return;
    }

    isChecking = true;
    writeStatus("checking", []);

    runCheck((errors) => {
        isChecking = false;
        writeStatus(errors.length > 0 ? "failed" : "passed", errors);

        if (errors.length > 0) {
            Editor.error(`[typecheck] Превью и сборка заблокированы, исправьте ошибки:\n${errors.join("\n")}`);
        } else {
            Editor.success("[typecheck] Ошибок TypeScript нет");
        }

        if (isCheckQueued) {
            isCheckQueued = false;
            checkAndPublish();
        }
    });
}

function scheduleCheck(fileName) {
    if (fileName && !fileName.endsWith(".ts")) {
        return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkAndPublish, CHECK_DEBOUNCE_MS);
}

function blockBuildOnErrors(options, callback) {
    runCheck((errors) => {
        if (errors.length > 0) {
            Editor.error(`[typecheck] Сборка остановлена, исправьте ошибки:\n${errors.join("\n")}`);
            callback(new Error("TypeScript check failed"));
            return;
        }
        callback();
    });
}

module.exports = {
    load() {
        for (const dir of watchedDirs) {
            const dirPath = path.join(projectRoot, dir);
            if (fs.existsSync(dirPath)) {
                watchers.push(fs.watch(dirPath, { recursive: true }, (event, fileName) => scheduleCheck(fileName)));
            }
        }

        Editor.Builder.on("before-change-files", blockBuildOnErrors);
        checkAndPublish();
    },

    unload() {
        clearTimeout(debounceTimer);
        watchers.forEach((watcher) => watcher.close());
        watchers.length = 0;
        Editor.Builder.removeListener("before-change-files", blockBuildOnErrors);
    },

    messages: {},
};

"use strict";

const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const checkedDirs = ["assets", "tests"].map((dir) => path.join(projectRoot, dir) + path.sep);

function loadProgram() {
    const configHost = Object.assign({}, ts.sys, {
        onUnRecoverableConfigFileDiagnostic(diagnostic) {
            throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
        },
    });
    const config = ts.getParsedCommandLineOfConfigFile(path.join(projectRoot, "tsconfig.json"), {}, configHost);

    return ts.createProgram({
        rootNames: config.fileNames,
        options: Object.assign({}, config.options, { noEmit: true }),
    });
}

function describe(file, position, message) {
    const { line, character } = file.getLineAndCharacterOfPosition(position);
    return `${path.relative(projectRoot, file.fileName)}:${line + 1}:${character + 1} ${message}`;
}

function findTypeErrors(program) {
    return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        return diagnostic.file && diagnostic.start !== undefined
            ? describe(diagnostic.file, diagnostic.start, message)
            : message;
    });
}

function isProjectSource(file) {
    const fileName = path.resolve(file.fileName);
    return !file.isDeclarationFile && checkedDirs.some((dir) => fileName.startsWith(dir));
}

function findForbiddenSyntax(program) {
    const errors = [];

    for (const file of program.getSourceFiles().filter(isProjectSource)) {
        const visit = (node) => {
            if (node.kind === ts.SyntaxKind.AnyKeyword) {
                errors.push(describe(file, node.getStart(file), "тип any запрещён"));
            }
            if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
                errors.push(describe(file, node.getStart(file), "приведение типов (as) запрещено"));
            }
            ts.forEachChild(node, visit);
        };
        visit(file);
    }

    return errors;
}

function checkProject() {
    const program = loadProgram();
    return findTypeErrors(program).concat(findForbiddenSyntax(program));
}

if (require.main === module) {
    const errors = checkProject();

    if (errors.length > 0) {
        console.error(errors.join("\n"));
        console.error(`\nНайдено ошибок: ${errors.length}`);
        process.exit(1);
    }

    console.log("Ошибок TypeScript нет");
}

module.exports = { checkProject };

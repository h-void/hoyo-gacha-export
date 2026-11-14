'use strict'

const fs = require('fs')
const path = require('path')

const PATCH_MARKER = '/* hoyo-gacha-export: apfs-detach-retry */'

const ORIGINAL_ATTACH_AND_DETACH = `async function attachAndExecute(dmgPath, readWrite, task) {
    //noinspection SpellCheckingInspection
    const args = ["attach", "-noverify", "-noautoopen"];
    if (readWrite) {
        args.push("-readwrite");
    }
    args.push(dmgPath);
    const attachResult = await builder_util_1.exec("hdiutil", args);
    const deviceResult = attachResult == null ? null : /^(\\/dev\\/\\w+)/.exec(attachResult);
    const device = deviceResult == null || deviceResult.length !== 2 ? null : deviceResult[1];
    if (device == null) {
        throw new Error(\`Cannot mount: \${attachResult}\`);
    }
    return await promise_1.executeFinally(task(), () => detach(device));
}
exports.attachAndExecute = attachAndExecute;
async function detach(name) {
    try {
        await builder_util_1.exec("hdiutil", ["detach", "-quiet", name]);
    }
    catch (e) {
        await new Promise((resolve, reject) => {
            setTimeout(() => {
                builder_util_1.exec("hdiutil", ["detach", "-force", name]).then(resolve).catch(reject);
            }, 1000);
        });
    }
}`

const PATCHED_ATTACH_AND_DETACH = `${PATCH_MARKER}
async function attachAndExecute(dmgPath, readWrite, task) {
    const args = ["attach", "-noverify", "-noautoopen"];
    if (readWrite) {
        args.push("-readwrite");
    }
    args.push(dmgPath);
    const attachResult = await builder_util_1.exec("hdiutil", args);
    const matchedDisks = attachResult == null
        ? []
        : Array.from(new Set(attachResult.match(/\\/dev\\/disk\\d+/g) || []));
    if (matchedDisks.length === 0) {
        throw new Error(\`Cannot mount: \${attachResult}\`);
    }
    const detachTargets = matchedDisks.slice().reverse();
    return await promise_1.executeFinally(task(), async () => {
        for (const target of detachTargets) {
            await detach(target);
        }
    });
}
exports.attachAndExecute = attachAndExecute;
async function detach(name) {
    const fsSync = require("fs");
    if (!fsSync.existsSync(name)) {
        return;
    }
    try {
        await builder_util_1.exec("sync", []);
    }
    catch (_) {}
    try {
        await builder_util_1.exec("hdiutil", ["detach", "-quiet", name]);
        return;
    }
    catch (_) {}
    let lastError = null;
    for (let attempt = 1; attempt <= 15; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (!fsSync.existsSync(name)) {
            return;
        }
        try {
            await builder_util_1.exec("hdiutil", ["detach", "-force", name]);
            return;
        }
        catch (err) {
            lastError = err;
            if (!fsSync.existsSync(name)) {
                return;
            }
        }
    }
    throw lastError;
}`

function patchDmgBuilder(rootDir = path.resolve(__dirname, '..')) {
  const dmgUtilPath = path.join(rootDir, 'node_modules', 'dmg-builder', 'out', 'dmgUtil.js')
  const dmgPath = path.join(rootDir, 'node_modules', 'dmg-builder', 'out', 'dmg.js')

  let patched = false

  if (fs.existsSync(dmgUtilPath)) {
    const raw = fs.readFileSync(dmgUtilPath, 'utf8')
    if (!raw.includes(PATCH_MARKER) && raw.includes(ORIGINAL_ATTACH_AND_DETACH)) {
      fs.writeFileSync(dmgUtilPath, raw.replace(ORIGINAL_ATTACH_AND_DETACH, PATCHED_ATTACH_AND_DETACH), 'utf8')
      patched = true
    }
  }

  if (fs.existsSync(dmgPath)) {
    const raw = fs.readFileSync(dmgPath, 'utf8')
    if (!raw.includes(PATCH_MARKER)) {
      const next = raw
        .replace(
          'addLogLevel(["create", "-srcfolder", appPath,',
          'addLogLevel(["create", "-ov", "-srcfolder", appPath,'
        )
        .replace(
          'builder_util_1.retry(() => builder_util_1.spawn("hdiutil", imageArgs), 5, 1000)',
          'builder_util_1.retry(() => builder_util_1.spawn("hdiutil", imageArgs), 10, 2000)'
        )
      if (next !== raw) {
        fs.writeFileSync(dmgPath, `${PATCH_MARKER}\n${next}`, 'utf8')
        patched = true
      }
    }
  }

  return patched
}

if (require.main === module) {
  patchDmgBuilder()
}

module.exports = { patchDmgBuilder, PATCH_MARKER }

import { createRequire } from "node:module";
const require = createRequire("D:/project/git-primer/node_modules/");
const { chromium } = require("playwright-core");
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(fileURLToPath(import.meta.url)) + "/..";
const shots = dirname(fileURLToPath(import.meta.url)) + "/shots";
await mkdir(shots, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".webp": "image/webp", ".gif": "image/gif" };
const server = createServer(async (req, res) => {
  try {
    const p = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const body = await readFile(join(root, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port + "/";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const t = (sel) => page.$eval(sel, (n) => n.textContent.trim());
const term = (sel) => page.$eval(sel, (n) => n.textContent);
const ok = [], bad = [];
const check = (name, cond) => cond ? ok.push(name) : bad.push(name);

/* d1 盲飞对照台：播放整条 run */
await page.click("#d1-play");
await page.waitForTimeout(10800);
check("d1 run done 11/11", (await t("#d1-n")) === "10 / 10");
check("d1 cockpit gauges DONE", (await t("#d1-run")) === "DONE");
check("d1 chat has user+bot", (await page.$$eval("#d1-chat .bubble", (n) => n.length)) === 2);
check("d1 gate button surfaced", (await t("#d1-gatebtn")).includes("可点"));
await page.click("#d1 button:has-text('重来')");
check("d1 reset", (await t("#d1-n")) === "0 / 10");

/* d2 事件流总装台：单步走完 */
for (let i = 0; i < 10; i++) await page.click("#d2-next");
check("d2 11 dispatched", (await t("#d2-n")) === "10 / 10");
check("d2 payload done usage", (await term("#d2-payload")).includes("cache_read"));
check("d2 lit gauges", (await t("#d2-lit")).startsWith("3 / 5"));
check("d2 sse+poll note", (await t("#d2-sse")).includes("轮询"));
await page.click("#d2 .btn-row button:has-text('重来')");

/* d3 状态机探照灯：合法路径 */
await page.click("#d3 .btn-row button:has-text('创建审批单')");
await page.click("#d3 .btn-row button:has-text('人：允许')");
check("d3 pending→approved", (await t("#d3-state")) === "approved");
await page.click("#d3 .btn-row button:has-text('线程：认领')");
await page.click("#d3 .btn-row button:has-text('执行返回 ok')");
check("d3 claim+finish → succeeded", (await t("#d3-state")) === "succeeded");
/* d3 非法转移：running 后再允许 */
await page.click("#d3 .btn-row button:has-text('人：允许')");
check("d3 illegal allow rejected", (await t("#d3-rej")) === "1 次" && (await term("#d3-term")).includes("CAS 只认"));
await page.click("#d3 .btn-row button:has-text('重来')");
await page.click("#d3 .btn-row button:has-text('创建审批单')");
await page.click("#d3 .btn-row button:has-text('reconcile：过期')");
check("d3 expire path", (await t("#d3-state")) === "expired");

/* d4 审批闸门：批准→认领→成功→重复读 200 */
await page.click("#d4-create");
check("d4 pending 120s", (await t("#d4-state")) === "pending" && (await t("#d4-ttl")).includes("120s"));
await page.click("#d4-allow");
check("d4 allow → 200 approved", (await t("#d4-code")) === "200" && (await t("#d4-state")) === "approved");
await page.waitForTimeout(3600);
check("d4 claimed+finished", (await t("#d4-state")) === "succeeded" && (await t("#d4-claims")) === "1");
await page.click("#d4-repeat");
check("d4 repeat decision read → 200", (await t("#d4-code")) === "200");
/* d4 过期支票：重来→创建→快进 4 次→allow → 409 */
await page.click("#d4 button:has-text('重来')");
check("d4 reset", (await t("#d4-state")) === "∅");
await page.click("#d4-create");
for (let i = 0; i < 4; i++) await page.click("#d4-skip");
await page.waitForTimeout(1100);
check("d4 expired by reconcile", (await t("#d4-state")) === "expired");
await page.click("#d4-allow");
check("d4 late allow → 409 no-resurrect", (await t("#d4-code")) === "409");

/* d5 黑匣子重放台：拖到 14/14，再回 5 看脱敏对照 */
await page.$eval("#d5-slider", (n, v) => { n.value = v; n.dispatchEvent(new Event("input")); }, 14);
check("d5 scrub to end", (await t("#d5-idx")) === "14 / 14");
check("d5 merged row counted", (await t("#d5-merged")).includes("19"));
check("d5 redacted secrets 0", (await t("#d5-secrets")).includes("0"));
await page.$eval("#d5-slider", (n, v) => { n.value = v; n.dispatchEvent(new Event("input")); }, 5);
await page.click("#d5-redact");
check("d5 raw shows 1 secret at n=5", (await t("#d5-secrets")).includes("1 处裸奔"));
check("d5 frame has raw Bearer", (await term("#d5-frame")).includes("sk-NQR7tW9x3AbCdEf0"));
await page.click("#d5-redact");
check("d5 re-redact", (await term("#d5-frame")).includes("sk-NQR***"));

/* d6 看门狗：hang + ON */
await page.click("button:has-text('上游挂死')");
await page.waitForTimeout(4300);
check("d6 watchdog fired 90s", (await term("#d6-term")).includes("90.0"));
check("d6 degrade to attempt 2", (await t("#d6-try")) === "attempt 2");
check("d6 neutral switch notice", (await t("#d6-ux")).includes("中性"));
await page.waitForTimeout(1300);
check("d6 attempt2 done", (await term("#d6-term")).includes("110.8"));

/* 速查卡 12 */
check("cheat 12 cards", (await page.$$eval(".cheat .cc", (n) => n.length)) === 12);
check("six interactive tags", (await page.$$eval(".demo-tag", (n) => n.length)) === 6);

/* 截图 */
for (const [id, name] of [["#d1","d1"],["#d2","d2"],["#d4","d4"],["#d5","d5"],["#d6","d6"],[".finale","finale"]]) {
  await page.$eval(id, (n) => n.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(250);
  await page.screenshot({ path: shots + "/" + name + ".png" });
}

/* 移动端 390px */
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mp.goto(base, { waitUntil: "networkidle" });
await mp.waitForTimeout(400);
const overflow = await mp.evaluate(() => {
  const out = [];
  document.querySelectorAll(".demo, .tbl-wrap, .term, .cheat, svg").forEach((n) => {
    const r = n.getBoundingClientRect();
    if (r.right > 391 && r.width > 20) out.push(n.className + " → " + Math.round(r.right));
  });
  return out.slice(0, 8);
});
check("mobile no overflow", overflow.length === 0);
if (overflow.length) console.log("OVERFLOW:", overflow);

console.log("PASS:", ok.length, "→", ok.join(" | "));
if (bad.length) console.log("FAIL:", bad.join(" | "));
console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
await browser.close();
process.exit(bad.length || errors.length ? 1 : 0);

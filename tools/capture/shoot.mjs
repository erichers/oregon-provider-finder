import playwright from "../../web/node_modules/playwright-core/index.js";

const { chromium } = playwright;
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const shots = resolve(root, "docs/screenshots");
const media = resolve(root, "docs/media");
const raw = resolve(root, "tools/capture/output-raw");
mkdirSync(shots, { recursive: true });
mkdirSync(media, { recursive: true });
mkdirSync(raw, { recursive: true });

const base = "http://127.0.0.1:4200";
const detail = "/provider/1003827965";

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function framed(page, name, urlLabel, displayWidth) {
  const bare = resolve(raw, `${name}-bare.png`);
  await page.screenshot({ path: bare });
  const frame = await browser.newPage({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 1 });
  await frame.goto("file://" + resolve(root, "tools/capture/frame.html"));
  await frame.evaluate(({ src, label, width }) => {
    const image = document.getElementById("shot");
    image.src = src;
    image.style.width = width + "px";
    const pill = document.getElementById("url");
    pill.textContent = label;
    pill.style.maxWidth = Math.max(160, width - 90) + "px";
  }, { src: "file://" + bare, label: urlLabel, width: displayWidth });
  await frame.waitForFunction(() => document.getElementById("shot").complete);
  const box = await frame.locator(".window").boundingBox();
  const path = resolve(shots, `${name}.png`);
  await frame.screenshot({
    path,
    clip: { x: 8, y: 8, width: box.width + 16, height: box.height + 16 },
  });
  await frame.close();
  const bytes = statSync(path).size;
  if (bytes > 400 * 1024) {
    const tmp = path + ".tmp.png";
    spawnSync("ffmpeg", ["-y", "-i", path, "-vf", "palettegen", resolve(raw, `${name}-palette.png`)], { stdio: "ignore" });
    spawnSync("ffmpeg", [
      "-y", "-i", path, "-i", resolve(raw, `${name}-palette.png`),
      "-lavfi", "paletteuse", tmp,
    ], { stdio: "ignore" });
    spawnSync("mv", [tmp, path]);
  }
  console.log(name, statSync(path).size);
}

if (process.env.SKIP_SHOTS !== "1") {
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto(base + "/", { waitUntil: "domcontentloaded" });
await desktop.waitForSelector(".map-frame.leaflet-container");
await desktop.waitForTimeout(1500);
await framed(desktop, "search-desktop", "localhost:4200/", 1440);

const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await phone.goto(base + "/", { waitUntil: "domcontentloaded" });
await phone.waitForSelector(".map-frame.leaflet-container");
await phone.waitForTimeout(1500);
await framed(phone, "search-phone", "localhost:4200/", 390);

const resultsUrl = "/?groups=physician&near=Portland&radius=25";
await desktop.goto(base + resultsUrl, { waitUntil: "domcontentloaded" });
await desktop.waitForSelector(".result");
await desktop.waitForSelector(".map-frame.leaflet-container");
await desktop.locator("#results").evaluate((node) => node.scrollIntoView({ block: "start" }));
await desktop.waitForTimeout(2200);
await framed(desktop, "results-desktop", "localhost:4200/?groups=physician&near=Portland&radius=25", 1440);
await framed(desktop, "map-desktop", "localhost:4200/?groups=physician&near=Portland&radius=25", 1440);

await phone.goto(base + resultsUrl, { waitUntil: "domcontentloaded" });
await phone.waitForSelector(".result");
await phone.waitForSelector(".map-frame.leaflet-container");
await phone.waitForSelector(".drawer-sheet");
await phone.locator("#results").evaluate((node) => node.scrollIntoView({ block: "start" }));
await phone.waitForTimeout(800);
await framed(phone, "results-phone", "localhost:4200/?groups=physician&near=Portland&radius=25", 390);
await framed(phone, "map-phone", "localhost:4200/?groups=physician&near=Portland&radius=25", 390);

await desktop.goto(base + "/", { waitUntil: "domcontentloaded" });
await desktop.locator("#words").fill("nurse practitioner in Salem within 10 miles");
await desktop.getByRole("button", { name: "Search" }).click();
await desktop.waitForSelector("text=Remove");
await framed(desktop, "plain-words", "localhost:4200" + new URL(desktop.url()).search, 1440);

await desktop.goto(base + detail, { waitUntil: "domcontentloaded" });
await desktop.waitForSelector(".provider-name");
await framed(desktop, "detail-desktop", "localhost:4200" + detail, 1440);

await phone.goto(base + detail, { waitUntil: "domcontentloaded" });
await phone.waitForSelector(".provider-name");
await framed(phone, "detail-phone", "localhost:4200" + detail, 390);

await phone.goto(base + "/about-data", { waitUntil: "domcontentloaded" });
await phone.waitForSelector("h2");
await framed(phone, "about-phone", "localhost:4200/about-data", 390);

await desktop.close();
await phone.close();
}

if (process.env.SKIP_VIDEO === "1") {
  await browser.close();
  process.exit(0);
}

const videoContext = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: raw, size: { width: 1280, height: 800 } },
});
const page = await videoContext.newPage();
await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.locator("#words").pressSequentially("a psychiatric nurse practitioner near Bend", { delay: 80 });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Search" }).click();
await page.waitForSelector("text=Remove");
await page.waitForTimeout(1800);
for (let attempt = 0; attempt < 6 && (await page.locator(".result").count()) === 0; attempt++) {
  const extra = page.getByRole("button", { name: /^Remove / }).filter({ hasNotText: /Bend|Nurse practitioners|Psychiatry/ });
  if ((await extra.count()) === 0) {
    break;
  }
  await extra.first().click();
  await page.waitForTimeout(700);
}
await page.waitForSelector(".result");
await page.locator("#results").evaluate((node) => node.scrollIntoView());
await page.waitForTimeout(2000);
await page.mouse.wheel(0, 400);
await page.waitForTimeout(2000);
await page.locator(".result-hit").first().click();
await page.getByRole("link", { name: "Full profile" }).click();
await page.waitForSelector(".provider-name");
await page.waitForTimeout(3000);
await page.goBack();
await page.waitForSelector("#care-needs");
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Psychiatry" }).click();
await page.waitForTimeout(6000);
const video = page.video();
await videoContext.close();
const webm = await video.path();
const gif = resolve(media, "walkthrough.gif");
const mp4 = resolve(media, "walkthrough.mp4");
const palette = resolve(raw, "walk-palette.png");
spawnSync("ffmpeg", ["-y", "-i", webm, "-vf", "fps=12,scale=960:-1:flags=lanczos,palettegen", palette], { stdio: "inherit" });
spawnSync("ffmpeg", [
  "-y", "-i", webm, "-i", palette,
  "-lavfi", "fps=12,scale=960:-1:flags=lanczos [x]; [x][1:v] paletteuse",
  gif,
], { stdio: "inherit" });
spawnSync("ffmpeg", ["-y", "-i", webm, "-vf", "fps=15,scale=960:-1:flags=lanczos", "-movflags", "+faststart", mp4], { stdio: "inherit" });
console.log("gif", statSync(gif).size, "mp4", statSync(mp4).size, "webm", webm);
await browser.close();

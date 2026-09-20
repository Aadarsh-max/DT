import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../config/db.js';
import { enqueueExecuteRun } from '../jobs/producers.js';
import { UPLOAD_DIR } from '../middleware/upload.middleware.js';
import { ApiError } from '../utils/ApiError.js';
import { aiEngine } from './aiEngine.client.js';
import { assertProjectAccess } from './project.service.js';
import { rankTestCases } from './prioritize.service.js';
import { ACTIVE, nextRunCode } from './run.service.js';

const unlink = (p) => (p ? fs.rm(p, { force: true }).catch(() => {}) : Promise.resolve());

const view = (c = {}) => ({
  hasApk: !!c.apkFile,
  apkName: c.apkName ?? null,
  apkSize: c.apkSize ?? null,
  uploadedAt: c.uploadedAt ?? null,
  appPackage: c.appPackage ?? '',
  appActivity: c.appActivity ?? '',
  udid: c.udid ?? '',
});

export async function getMobileConfig(projectId, user) {
  const project = await assertProjectAccess(projectId, user);
  return view(project.mobileConfig ?? {});
}

export async function saveMobileConfig(projectId, user, input) {
  const project = await assertProjectAccess(projectId, user);
  const config = {
    ...(project.mobileConfig ?? {}),
    appPackage: input.appPackage ?? null,
    appActivity: input.appActivity ?? null,
    udid: input.udid ?? null,
  };
  await prisma.project.update({ where: { id: projectId }, data: { mobileConfig: config } });
  return view(config);
}

export async function saveApk(projectId, user, file) {
  if (!file) throw ApiError.badRequest('No file received. Attach it in the "file" field.');

  let project;
  try {
    project = await assertProjectAccess(projectId, user);

    // A real APK is a zip archive: it starts with "PK\x03\x04"
    const fh = await fs.open(file.path, 'r');
    const head = Buffer.alloc(4);
    await fh.read(head, 0, 4, 0);
    await fh.close();
    if (head.toString('latin1') !== 'PK\x03\x04') throw ApiError.badRequest('That file is not a valid APK');
  } catch (e) {
    await unlink(file.path);
    throw e;
  }

  const rel = `apks/${projectId}/${Date.now()}.apk`;
  const abs = path.join(UPLOAD_DIR, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.rename(file.path, abs);

  const prev = project.mobileConfig ?? {};
  const config = {
    ...prev,
    apkFile: rel,
    apkName: String(file.originalname).slice(0, 120),
    apkSize: file.size,
    uploadedAt: new Date().toISOString(),
  };
  await prisma.project.update({ where: { id: projectId }, data: { mobileConfig: config } });
  if (prev.apkFile) await unlink(path.join(UPLOAD_DIR, prev.apkFile));
  return view(config);
}

export async function removeApk(projectId, user) {
  const project = await assertProjectAccess(projectId, user);
  const prev = project.mobileConfig ?? {};
  if (!prev.apkFile) return view(prev);

  const { apkFile, apkName, apkSize, uploadedAt, ...rest } = prev;
  await prisma.project.update({ where: { id: projectId }, data: { mobileConfig: rest } });
  await unlink(path.join(UPLOAD_DIR, apkFile));
  return view(rest);
}

export async function createMobileRun(projectId, user, opts) {
  const project = await assertProjectAccess(projectId, user);
  const cfg = project.mobileConfig ?? {};

  if (!cfg.apkFile && !cfg.appPackage) {
    throw ApiError.badRequest('Upload an APK or enter the package name of an installed app first');
  }
  let apkPath = null;
  if (cfg.apkFile) {
    apkPath = path.resolve(UPLOAD_DIR, cfg.apkFile);
    await fs.access(apkPath).catch(() => {
      throw ApiError.badRequest('The uploaded APK is missing. Upload it again.');
    });
  }

  const active = await prisma.testRun.findFirst({
    where: { projectId, status: { in: ACTIVE } },
    select: { id: true },
  });
  if (active) throw ApiError.conflict('A test run is already in progress for this project');

  let cases = await prisma.testCase.findMany({
    where: { projectId, type: 'MOBILE', ...(opts.testCaseIds && { id: { in: opts.testCaseIds } }) },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: 200,
    select: { id: true, type: true, platform: true, priority: true, module: true },
  });
  if (cases.length === 0) {
    throw ApiError.badRequest('No mobile test cases yet. Generate them on this page first.');
  }
  if (opts.smartOrder && cases.length > 1) cases = (await rankTestCases(projectId, cases)).ordered;
  cases = cases.slice(0, opts.maxCases);

  let run;
  for (let attempt = 0; attempt < 3 && !run; attempt++) {
    try {
      run = await prisma.testRun.create({
        data: {
          runCode: await nextRunCode(),
          projectId,
          triggeredById: user.id,
          status: 'QUEUED',
          stage: 'queued',
          targetUrl: `Android: ${cfg.appPackage || cfg.apkName}`,
          total: cases.length,
        },
      });
    } catch (e) {
      if (e?.code !== 'P2002' || attempt === 2) throw e; // run code collision: retry
    }
  }

  try {
    await enqueueExecuteRun({
      runId: run.id,
      caseIds: cases.map((c) => c.id),
      uiUrl: null,
      apiBase: null,
      headless: true,
      authToken: null,
      mobile: {
        apkPath,
        appPackage: cfg.appPackage || null,
        appActivity: cfg.appActivity || null,
        udid: cfg.udid || null,
        autoGrant: !!opts.autoGrantPermissions,
      },
    });
  } catch (e) {
    await prisma.testRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', errorMsg: 'Could not queue the run. Is Redis running?', finishedAt: new Date() },
    });
    throw e;
  }
  return run;
}

export const mobileEngineStatus = () => aiEngine.mobileStatus();
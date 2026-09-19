import fs from "node:fs/promises";
import path from "node:path";
import { Worker } from "bullmq";
import { prisma } from "../../config/db.js";
import { QUEUE_NAMES } from "../../config/queue.js";
import { redis } from "../../config/redis.js";
import { aiEngine } from "../../services/aiEngine.client.js";
import {
  REPORT_DIR,
  collectReportFacts,
} from "../../services/report.service.js";
import { logger } from "../../utils/logger.js";

const shorten = (s, n = 300) =>
  s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, "")}…`;

async function processor(job) {
  const { reportId } = job.data;
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report || report.status !== "GENERATING") return { skipped: true };

  try {
    const facts = await collectReportFacts(report);
    const out = await aiEngine.generateReport({ title: report.title, facts });

    const rel = `${report.projectId}/${report.id}.pdf`;
    const abs = path.join(REPORT_DIR, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, Buffer.from(out.pdfB64, "base64"));

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "READY",
        errorMsg: null,
        filePath: rel,
        summary: shorten(out.sections.executiveSummary),
        content: {
          facts,
          sections: out.sections,
          health: out.health,
          caveats: out.caveats,
          aiWritten: out.aiWritten,
          provider: out.provider,
          model: out.model,
          warnings: out.warnings,
        },
      },
    });
    return { ok: true };
  } catch (e) {
    await prisma.report
      .update({
        where: { id: reportId },
        data: { status: "FAILED", errorMsg: String(e.message).slice(0, 500) },
      })
      .catch(() => {}); // the row may have been deleted meanwhile
    throw e;
  }
}

export function startGenerateReportWorker() {
  const worker = new Worker(QUEUE_NAMES.GENERATE_REPORT, processor, {
    connection: redis,
    concurrency: 1,
    lockDuration: 5 * 60 * 1000,
  });
  worker.on("completed", (job, result) => {
    if (!result?.skipped) logger.info(`Report ${job.id} generated`);
  });
  worker.on("failed", (job, err) =>
    logger.error(`Report ${job?.id} failed: ${err.message}`),
  );
  worker.on("error", (err) =>
    logger.error(`Report worker error: ${err.message}`),
  );
  logger.info("Generate-report worker started");
  return worker;
}

import { Worker } from 'bullmq';
import { prisma } from '../../config/db.js';
import { QUEUE_NAMES } from '../../config/queue.js';
import { redis } from '../../config/redis.js';
import { aiEngine } from '../../services/aiEngine.client.js';
import { recentTitles, saveGeneratedTestCases } from '../../services/testcase.service.js';
import { logger } from '../../utils/logger.js';

const LABEL = {
  FUNCTIONAL: 'functional',
  BOUNDARY: 'boundary',
  NEGATIVE: 'negative',
  SECURITY: 'security',
  API: 'API',
};

async function processor(job) {
  const { projectId, types, perType, module, requirementIds, requirementId } = job.data;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('The project no longer exists');

  const warnings = [];
  const byType = {};
  let created = 0;
  let failures = 0;

  const report = (percent, message, stage = 'generating') =>
    job.updateProgress({ percent, stage, message, created, warnings: [...warnings] });

  await report(3, 'Reading your requirements', 'preparing');

  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    await report(
      5 + Math.round((i / types.length) * 90),
      `Generating ${LABEL[type]} test cases (${i + 1} of ${types.length})`
    );

    try {
      const avoidTitles = await recentTitles(projectId, type);
      const data = await aiEngine.generateTests({
        projectId,
        testType: type,
        count: perType,
        platform: type === 'API' ? 'API' : project.platform,
        projectName: project.name,
        baseUrl: project.baseUrl,
        module,
        requirementIds,
        avoidTitles,
      });

      const saved = await saveGeneratedTestCases({
        project,
        type,
        requirementId,
        cases: data.test_cases ?? [],
      });
      byType[type] = saved;
      created += saved;
      if (saved === 0) warnings.push(`${LABEL[type]}: no new test cases (all were duplicates)`);
    } catch (e) {
      failures += 1;
      byType[type] = 0;
      warnings.push(`${LABEL[type]}: ${e.message}`);
      logger.error(`Generation failed for ${type}: ${e.message}`);
    }
  }

  if (failures === types.length) throw new Error(warnings[0] ?? 'Generation failed');

  await report(100, `Done. ${created} new test cases added.`, 'done');
  return { created, byType, warnings };
}

export function startGenerateTestsWorker() {
  const worker = new Worker(QUEUE_NAMES.GENERATE_TESTS, processor, {
    connection: redis,
    concurrency: 1, // one local model call at a time keeps RAM predictable
  });

  worker.on('completed', (job, result) =>
    logger.info(`Generation ${job.id} finished: ${result.created} test cases`)
  );
  worker.on('failed', (job, err) => logger.error(`Generation ${job?.id} failed: ${err.message}`));
  worker.on('error', (err) => logger.error(`Generate worker error: ${err.message}`));

  logger.info('Generate-tests worker started');
  return worker;
}
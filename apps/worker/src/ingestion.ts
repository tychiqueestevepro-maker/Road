import type { RoadDataConnector } from "@road-reality/shared";
import {
  createIngestionRun,
  finishIngestionRun,
  getDataSourceBySlug,
  markSourcePoll,
  seedDataSources,
  upsertRawRecord,
  upsertRoadEvent,
  type RoadRealityDb
} from "@road-reality/database";
import { createDeclaredStateConnectors } from "./connectors.js";
import { logger } from "./logger.js";

export interface IngestionSummary {
  source: string;
  status: "success" | "partial" | "failed";
  recordsReceived: number;
  recordsPersisted: number;
  error?: string;
}

export async function runIngestionOnce(db: RoadRealityDb): Promise<IngestionSummary[]> {
  await seedDataSources(db);
  const connectors = createDeclaredStateConnectors();
  const summaries: IngestionSummary[] = [];

  for (const connector of connectors) {
    summaries.push(await ingestConnector(db, connector));
  }

  return summaries;
}

export async function ingestConnector(
  db: RoadRealityDb,
  connector: RoadDataConnector
): Promise<IngestionSummary> {
  const source = await getDataSourceBySlug(db, connector.sourceName);
  if (!source) {
    throw new Error(`data source ${connector.sourceName} has not been seeded`);
  }

  const run = await createIngestionRun(db, source.id);
  const started = performance.now();

  try {
    const result = await connector.fetch();
    const normalized = await connector.normalize(result);
    let persisted = 0;

    for (const event of normalized) {
      const raw = await upsertRawRecord(db, {
        sourceId: source.id,
        externalId: event.externalId,
        payload: event.rawPayload,
        sourceUpdatedAt: event.sourceUpdatedAt,
        ingestedAt: event.ingestedAt
      });
      await upsertRoadEvent(db, source.id, raw.id, event);
      persisted += 1;
    }

    await finishIngestionRun(db, run.id, {
      status: "success",
      recordsReceived: result.records.length,
      recordsUpdated: persisted,
      metadata: {
        connector: connector.sourceName,
        source: result.source,
        duration_ms: Math.round(performance.now() - started),
        source_metadata: result.metadata
      }
    });
    await markSourcePoll(db, source.id, {
      ok: true,
      metadata: {
        last_records_received: result.records.length,
        last_records_persisted: persisted,
        last_ingestion_run_id: run.id
      }
    });

    logger.info({
      connector: connector.sourceName,
      ingestion_run_id: run.id,
      source: source.slug,
      records_received: result.records.length,
      records_updated: persisted,
      duration_ms: Math.round(performance.now() - started)
    });

    return {
      source: connector.sourceName,
      status: "success",
      recordsReceived: result.records.length,
      recordsPersisted: persisted
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishIngestionRun(db, run.id, {
      status: "failed",
      error: message,
      recordsFailed: 1,
      metadata: {
        connector: connector.sourceName,
        duration_ms: Math.round(performance.now() - started)
      }
    });
    await markSourcePoll(db, source.id, {
      ok: false,
      error: message,
      metadata: { last_ingestion_run_id: run.id }
    });
    logger.error({
      connector: connector.sourceName,
      ingestion_run_id: run.id,
      source: source.slug,
      error: message,
      duration_ms: Math.round(performance.now() - started)
    });

    return {
      source: connector.sourceName,
      status: "failed",
      recordsReceived: 0,
      recordsPersisted: 0,
      error: message
    };
  }
}

export async function getConnectorHealth() {
  const connectors = createDeclaredStateConnectors();
  return Promise.all(connectors.map((connector) => connector.healthCheck()));
}


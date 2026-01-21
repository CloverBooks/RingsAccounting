import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | null = null;

export async function initTelemetry(): Promise<void> {
  if (process.env.OTEL_ENABLED !== 'true') {
    return;
  }

  const exporterEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const traceExporter = exporterEndpoint
    ? new OTLPTraceExporter({ url: exporterEndpoint })
    : undefined;

  sdk = new NodeSDK({
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  await sdk.start();

  process.on('SIGTERM', async () => {
    await sdk?.shutdown();
  });
}

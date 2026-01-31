import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

export const initializeTelemetry = () => {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const traceExporter = endpoint
    ? new OTLPTraceExporter({ url: endpoint })
    : undefined;

  const sdk = new NodeSDK({
    traceExporter,
  });

  sdk.start();

  return sdk;
};

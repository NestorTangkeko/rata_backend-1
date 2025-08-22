/*instrumentation.js*/
// Require dependencies
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME,ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');

// Add your port and startServer to the Prometheus options
const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'rata-backend',
        [ATTR_SERVICE_VERSION]: '1.0.0',
    }),
    traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_COLLECTOR //?? 'http://localhost:4137/v1/traces',
    }),
    metricReader: new PrometheusExporter({
        port: process.env.PROMETHEUS_PORT | 9090
    }),
    instrumentations: [getNodeAutoInstrumentations()],
});

console.log(process.env.OTEL_COLLECTOR)

sdk.start();
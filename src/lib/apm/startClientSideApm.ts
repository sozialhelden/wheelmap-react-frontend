import { init } from '@elastic/apm-rum';
import env from '../env';

export default function startClientSideApm() {
  if (!env.ELASTIC_APM_SECRET_TOKEN) {
    console.log('No secret token given, skipping apm.');
    return;
  }

  console.log('Starting client side APM.');

  const apm = init({
    serviceName: 'wheelmap-react-frontend',
    serviceVersion: env.npm_package_version, // Used on the APM Server to find the right sourcemap
    serverUrl: env.REACT_APP_ELASTIC_APM_SERVER_URL,
    // @ts-ignore
    secretToken: env.REACT_APP_ELASTIC_APM_SECRET_TOKEN,
    // Other APM monitored services
    distributedTracingOrigins: [
      env.REACT_APP_LEGACY_API_BASE_URL,
      env.REACT_APP_ACCESSIBILITY_CLOUD_BASE_URL,
      env.REACT_APP_ACCESSIBILITY_CLOUD_UNCACHED_BASE_URL,
    ].filter(Boolean),
  });

  return apm;
}

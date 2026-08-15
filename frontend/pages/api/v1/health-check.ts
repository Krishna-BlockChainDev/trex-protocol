import type { NextApiRequest, NextApiResponse } from 'next';

interface HealthCheckResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
  service: string;
}

/**
 * GET /v1/health-check  (rewritten from /api/v1/health-check via next.config.ts)
 *
 * Used by the ALB target-group health check defined in cdk/templates/trex-protocol.yml
 * under `loadBalancer.defaultHealthCheck`.
 *
 * Returns HTTP 200 with a JSON body as long as the Next.js process is running.
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthCheckResponse | { error: string }>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'trex-protocol',
  });
}

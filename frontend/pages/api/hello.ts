// Health-check endpoint — returns 200 OK with build timestamp.
import type { NextApiRequest, NextApiResponse } from 'next';

type HealthResponse = {
  status: 'ok';
  timestamp: string;
};

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<HealthResponse>,
) {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}

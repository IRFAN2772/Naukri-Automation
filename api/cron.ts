import type { VercelRequest, VercelResponse } from '@vercel/node';
import { run } from '../src/main'; // Statically imported at top level

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Verify CRON_SECRET authorization header
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  process.exitCode = 0; // Reset process exit status

  try {
    // Fallback for GitHub Action outputs context
    process.env.GITHUB_OUTPUT = '/tmp/output.txt';

    // 2. Execute main script directly
    await run();

    const failed = process.exitCode === 1;
    process.exitCode = 0;

    return res.status(failed ? 500 : 200).json({
      success: !failed,
      message: failed
        ? 'Naukri update failed — check Vercel execution logs'
        : 'Naukri profile updated successfully from Mumbai (bom1)',
    });
  } catch (error: any) {
    process.exitCode = 0;
    console.error('Naukri Execution Error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message ?? String(error),
    });
  }
}
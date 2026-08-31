import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Verify CRON_SECRET authorization header
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  process.exitCode = 0; // reset exit status

  try {
    // Set environment variable fallback for GitHub Action outputs
    process.env.GITHUB_OUTPUT = '/tmp/output.txt';

    // 2. Import main.ts dynamically (Vercel resolves this relative path at build time)
    const mainModule = await import('../src/main');

    if (typeof mainModule.run === 'function') {
      await mainModule.run();
    }

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
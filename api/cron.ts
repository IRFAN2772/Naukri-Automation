import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Verify Authorization Header
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Mock missing GitHub Action Environment Variables for Vercel
  process.env.GITHUB_OUTPUT = '/tmp/output.txt';

  try {
    // 3. Dynamically load runtime module
    const { run } = await import('../src/main');
    await run();

    return res.status(200).json({
      success: true,
      message: 'Naukri profile updated successfully from Mumbai (bom1)',
    });
  } catch (error: any) {
    console.error('Naukri Execution Error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message ?? String(error),
    });
  }
}
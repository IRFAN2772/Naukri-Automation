import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Check CRON_SECRET authorization
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 2. Mock GitHub Actions env vars if required by main.ts
    process.env.GITHUB_OUTPUT = '/tmp/output.txt';

    // 3. Register ts-node on-the-fly for src/ TypeScript files
    try {
      require('ts-node/register');
    } catch (e) {
      // Ignore if already registered
    }

    // 4. Require the main script relative to the current file
    const path = require('path');
    const mainPath = path.resolve(process.cwd(), 'src/main.ts');
    const mainModule = require(mainPath);

    if (typeof mainModule.run === 'function') {
      await mainModule.run();
    }

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
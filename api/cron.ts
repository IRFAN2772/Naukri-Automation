import type { VercelRequest, VercelResponse } from '@vercel/node';
import { run } from '../src/main';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  process.exitCode = 0; // reset in case this function instance is reused

  try {
    await run();

    const failed = process.exitCode === 1;
    process.exitCode = 0; // don't let it leak into the next invocation

    return res.status(failed ? 500 : 200).json({
      success: !failed,
      message: failed
        ? 'Naukri update reported a failure — check function logs'
        : 'Naukri profile updated successfully from Mumbai (bom1)',
    });
  } catch (error: any) {
    process.exitCode = 0;
    console.error('Naukri Update Failed:', error);
    return res.status(500).json({ success: false, error: error.message ?? String(error) });
  }
}
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Verify Authorization Header
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  process.exitCode = 0; // reset in case container instance is reused

  try {
    // Set fallback output path for GitHub actions compatibility
    process.env.GITHUB_OUTPUT = '/tmp/output.txt';

    // 2. Import main module dynamically
    // Importing src/main runs your execution script
    const mainModule = await import('../src/main');
    
    if (typeof mainModule.run === 'function') {
      await mainModule.run();
    }

    const failed = process.exitCode === 1;
    process.exitCode = 0; // clear after execution

    return res.status(failed ? 500 : 200).json({
      success: !failed,
      message: failed
        ? 'Naukri update reported a failure — check Vercel logs'
        : 'Naukri profile updated successfully from Mumbai (bom1)',
    });
  } catch (error: any) {
    process.exitCode = 0;
    console.error('Naukri Execution Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message ?? String(error) 
    });
  }
}
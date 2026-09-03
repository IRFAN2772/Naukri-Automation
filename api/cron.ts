import type { VercelRequest, VercelResponse } from '@vercel/node'
import { run } from '../src/main'

function applyEnvAliases(): void {
  const aliases: Record<string, string> = {
    NAUKRI_USERNAME: 'INPUT_USERNAME',
    NAUKRI_PASSWORD: 'INPUT_PASSWORD',
    NAUKRI_PROFILE_ID: 'INPUT_PROFILE_ID',
    NAUKRI_RESUME_PATH: 'INPUT_RESUME_PATH',
    NAUKRI_PROFILE_SUMMARY: 'INPUT_PROFILE_SUMMARY',
    NAUKRI_RESUME_HEADLINE: 'INPUT_RESUME_HEADLINE'
  }

  for (const [from, to] of Object.entries(aliases)) {
    if (process.env[from] && !process.env[to]) {
      process.env[to] = process.env[from]
    }
  }

  if (!process.env.INPUT_RESUME_PATH) {
    process.env.INPUT_RESUME_PATH =
      './resumes/Mohammad_Irfanuddin_FullStack_Developer_v3.pdf'
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  applyEnvAliases()
  process.env.GITHUB_OUTPUT ??= '/tmp/github-output.txt'
  process.exitCode = 0

  try {
    console.log('Starting Naukri update from Vercel region bom1...')
    await run()

    const failed = process.exitCode === 1
    process.exitCode = 0

    return res.status(failed ? 500 : 200).json({
      success: !failed,
      region: 'bom1',
      message: failed
        ? 'Naukri update failed — check Vercel function logs'
        : 'Naukri profile updated successfully from Mumbai (bom1)'
    })
  } catch (error: unknown) {
    process.exitCode = 0
    const message = error instanceof Error ? error.message : String(error)
    console.error('Naukri Execution Error:', error)
    return res.status(500).json({
      success: false,
      region: 'bom1',
      error: message
    })
  }
}
import fs from 'fs'
import path from 'path'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { login } from '../src/api/login'
import { updateProfileSummary } from '../src/api/updateProfile'
import { updateResumeHeadline } from '../src/api/updateResumeHeadline'
import { uploadResume } from '../src/api/uploadResume'

function env(name: string, fallback?: string): string {
  return (
    process.env[name] ||
    process.env[`INPUT_${name.replace(/^NAUKRI_/, '')}`] ||
    fallback ||
    ''
  ).trim()
}

function resolveResumePath(inputPath: string): string {
  const candidates = [
    inputPath,
    path.resolve(process.cwd(), inputPath),
    path.resolve(process.cwd(), 'resumes', path.basename(inputPath)),
    path.resolve(__dirname, '..', inputPath),
    path.resolve(__dirname, '../resumes', path.basename(inputPath))
  ]

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(`Resume file not found. Tried: ${candidates.join(' | ')}`)
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const username = env('INPUT_USERNAME') || env('NAUKRI_USERNAME')
  const password = env('INPUT_PASSWORD') || env('NAUKRI_PASSWORD')
  const profileId = env('INPUT_PROFILE_ID') || env('NAUKRI_PROFILE_ID')
  const resumePathInput =
    env('INPUT_RESUME_PATH') ||
    env('NAUKRI_RESUME_PATH') ||
    './resumes/Mohammad_Irfanuddin_FullStack_Developer_v3.pdf'
  let profileSummary =
    env('INPUT_PROFILE_SUMMARY') || env('NAUKRI_PROFILE_SUMMARY')
  const resumeHeadline =
    env('INPUT_RESUME_HEADLINE') || env('NAUKRI_RESUME_HEADLINE')

  try {
    if (!username || !password || !profileId) {
      throw new Error(
        'Missing required env: INPUT_USERNAME, INPUT_PASSWORD, INPUT_PROFILE_ID'
      )
    }

    const resumePath = resolveResumePath(resumePathInput)
    console.log(`Starting Naukri update from bom1 using ${resumePath}`)

    const cookies = await login(username, password)
    if (!cookies) {
      throw new Error('Login failed: no cookies returned')
    }

    const result = {
      login: true,
      profileSummary: 'skipped',
      resumeHeadline: 'skipped',
      resumeUpload: false,
      resumePath
    }

    if (profileSummary) {
      if (profileSummary.length < 50) {
        result.profileSummary = 'skipped-too-short'
      } else {
        const timestamp = ` ${Date.now()}`
        if (profileSummary.length + timestamp.length > 1000) {
          profileSummary =
            profileSummary.slice(0, 1000 - timestamp.length) + timestamp
        } else {
          profileSummary += timestamp
        }
        result.profileSummary = (await updateProfileSummary(
          cookies,
          profileId,
          profileSummary
        ))
          ? 'updated'
          : 'failed'
      }
    }

    if (resumeHeadline) {
      if (resumeHeadline.length > 250) {
        result.resumeHeadline = 'skipped-too-long'
      } else {
        result.resumeHeadline = (await updateResumeHeadline(
          cookies,
          profileId,
          resumeHeadline
        ))
          ? 'updated'
          : 'failed'
      }
    }

    result.resumeUpload = await uploadResume(cookies, resumePath, profileId)
    if (!result.resumeUpload) {
      throw new Error('Resume upload failed')
    }

    return res.status(200).json({
      success: true,
      region: 'bom1',
      message: 'Naukri profile updated successfully from Mumbai (bom1)',
      result
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Naukri Execution Error:', error)
    return res.status(500).json({
      success: false,
      region: 'bom1',
      error: message
    })
  }
}
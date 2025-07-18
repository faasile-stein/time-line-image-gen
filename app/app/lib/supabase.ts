import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Job {
  jobId: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  inputData: any;
  outputData?: any;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export const supabaseFunctions = {
  // Job management functions
  async createJob(jobType: 'get-styles' | 'get-track-info' | 'generate-image' | 'generate-video', inputData: any) {
    const { data, error } = await supabase.functions.invoke('manage-jobs', {
      body: { action: 'create', jobType, inputData }
    })
    
    if (error) throw error
    return data as { jobId: string; status: string }
  },

  async getJobStatus(jobId: string) {
    const { data, error } = await supabase.functions.invoke('manage-jobs', {
      body: { action: 'get', jobId }
    })
    
    if (error) throw error
    return data as Job
  },

  async processJob(jobId: string) {
    const { data, error } = await supabase.functions.invoke('process-jobs', {
      body: { jobId }
    })
    
    if (error) throw error
    return data
  },

  // Polling utility
  async pollJobStatus(jobId: string, onUpdate?: (job: Job) => void): Promise<Job> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const job = await this.getJobStatus(jobId)
          onUpdate?.(job)
          
          if (job.status === 'completed') {
            resolve(job)
          } else if (job.status === 'failed') {
            reject(new Error(job.errorMessage || 'Job failed'))
          } else {
            // Continue polling
            setTimeout(poll, 2000) // Poll every 2 seconds
          }
        } catch (error) {
          reject(error)
        }
      }
      
      poll()
    })
  },

  // Special polling for video generation with Runway ML
  async pollVideoStatus(jobId: string, taskId: string, onUpdate?: (job: Job) => void): Promise<Job> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          // First check if the job is already completed in our database
          const job = await this.getJobStatus(jobId)
          onUpdate?.(job)
          
          if (job.status === 'completed') {
            resolve(job)
            return
          } else if (job.status === 'failed') {
            reject(new Error(job.errorMessage || 'Job failed'))
            return
          }
          
          // Poll Runway ML for status
          const { data, error } = await supabase.functions.invoke('poll-runway-status', {
            body: { taskId, jobId }
          })
          
          if (error) {
            console.error('Error polling Runway status:', error)
            setTimeout(poll, 5000) // Try again in 5 seconds
            return
          }
          
          if (data.status === 'completed') {
            // Job should be updated, poll our database once more
            const updatedJob = await this.getJobStatus(jobId)
            onUpdate?.(updatedJob)
            resolve(updatedJob)
          } else if (data.status === 'failed') {
            reject(new Error(data.error || 'Video generation failed'))
          } else {
            // Still processing, continue polling
            setTimeout(poll, 5000) // Poll every 5 seconds for video
          }
        } catch (error) {
          reject(error)
        }
      }
      
      poll()
    })
  },

  // High-level async functions
  async getStyles(trackArtist: string, trackName: string) {
    // Create job
    const { jobId } = await this.createJob('get-styles', { trackArtist, trackName })
    
    // Start processing (fire and forget)
    this.processJob(jobId).catch(console.error)
    
    // Poll for completion
    const job = await this.pollJobStatus(jobId)
    return job.outputData.styles as string[]
  },

  async getTrackInfo(trackName: string, style: string) {
    const { jobId } = await this.createJob('get-track-info', { trackName, style })
    this.processJob(jobId).catch(console.error)
    const job = await this.pollJobStatus(jobId)
    return job.outputData as { bpm: number; phases: string[] }
  },

  async generateImage(prompt: string, regenerate: boolean = false, onUpdate?: (job: Job) => void) {
    const { jobId } = await this.createJob('generate-image', { prompt, regenerate })
    this.processJob(jobId).catch(console.error)
    const job = await this.pollJobStatus(jobId, onUpdate)
    return job.outputData as { imageUrl: string; enhancedPrompt: string; revisedPrompt: string }
  },

  async generateVideo(
    imageUrl: string, 
    prompt: string, 
    trackName: string, 
    bpm: number, 
    phase: string, 
    style: string,
    onUpdate?: (job: Job) => void
  ) {
    const { jobId } = await this.createJob('generate-video', { imageUrl, prompt, trackName, bpm, phase, style })
    this.processJob(jobId).catch(console.error)
    
    // First, wait for the job to start processing and get the task ID
    const initialJob = await this.pollJobStatus(jobId, onUpdate)
    const taskId = initialJob.outputData.taskId
    
    // Then use special video polling that checks Runway ML directly
    const job = await this.pollVideoStatus(jobId, taskId, onUpdate)
    return job.outputData as { taskId: string; videoUrl: string; status: string; videoPrompt: string }
  }
}
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { taskId, jobId } = await req.json()
    
    console.log('🎬 Poll Runway Status called with:', { taskId, jobId })
    
    const RUNWAY_API_KEY = Deno.env.get('RUNWAY_API_KEY')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Check Runway ML status
    const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06'
      }
    })
    
    if (!statusResponse.ok) {
      throw new Error(`Runway API error: ${statusResponse.statusText}`)
    }

    const statusData = await statusResponse.json()
    
    console.log('Runway ML status response:', statusData)
    
    if (statusData.status === 'SUCCEEDED') {
      // Update the job with the completed video URL
      const videoUrl = statusData.output?.[0]?.url
      
      await supabaseClient
        .from('jobs')
        .update({
          status: 'completed',
          output_data: {
            taskId,
            videoUrl,
            status: 'completed',
            videoPrompt: statusData.videoPrompt || 'Video generation completed'
          },
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)

      return new Response(
        JSON.stringify({ 
          status: 'completed', 
          videoUrl,
          taskId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else if (statusData.status === 'FAILED') {
      // Update job with failure
      await supabaseClient
        .from('jobs')
        .update({
          status: 'failed',
          error_message: `Runway task failed: ${statusData.failure?.message || 'Unknown error'}`,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)

      return new Response(
        JSON.stringify({ 
          status: 'failed', 
          error: statusData.failure?.message || 'Video generation failed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Still processing
      return new Response(
        JSON.stringify({ 
          status: 'processing',
          runwayStatus: statusData.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in poll-runway-status:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JobRequest {
  action: 'create' | 'get' | 'update';
  jobType?: 'generate-image' | 'generate-video' | 'get-styles' | 'get-track-info';
  jobId?: string;
  inputData?: any;
  outputData?: any;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { action, jobType, jobId, inputData, outputData, status, errorMessage }: JobRequest = await req.json()

    switch (action) {
      case 'create': {
        if (!jobType || !inputData) {
          return new Response(
            JSON.stringify({ error: 'jobType and inputData are required for create action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data, error } = await supabaseClient
          .from('jobs')
          .insert({
            type: jobType,
            input_data: inputData,
            status: 'pending'
          })
          .select()
          .single()

        if (error) {
          throw new Error(`Failed to create job: ${error.message}`)
        }

        return new Response(
          JSON.stringify({ jobId: data.id, status: data.status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'get': {
        if (!jobId) {
          return new Response(
            JSON.stringify({ error: 'jobId is required for get action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data, error } = await supabaseClient
          .from('jobs')
          .select('*')
          .eq('id', jobId)
          .single()

        if (error) {
          throw new Error(`Failed to get job: ${error.message}`)
        }

        return new Response(
          JSON.stringify({
            jobId: data.id,
            type: data.type,
            status: data.status,
            inputData: data.input_data,
            outputData: data.output_data,
            errorMessage: data.error_message,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            completedAt: data.completed_at
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update': {
        if (!jobId) {
          return new Response(
            JSON.stringify({ error: 'jobId is required for update action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const updateData: any = {}
        if (status) updateData.status = status
        if (outputData) updateData.output_data = outputData
        if (errorMessage) updateData.error_message = errorMessage
        if (status === 'completed' || status === 'failed') {
          updateData.completed_at = new Date().toISOString()
        }

        const { data, error } = await supabaseClient
          .from('jobs')
          .update(updateData)
          .eq('id', jobId)
          .select()
          .single()

        if (error) {
          throw new Error(`Failed to update job: ${error.message}`)
        }

        return new Response(
          JSON.stringify({
            jobId: data.id,
            status: data.status,
            outputData: data.output_data,
            errorMessage: data.error_message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Must be create, get, or update.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error in manage-jobs:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
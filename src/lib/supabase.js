import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://oslbsnwccchdxmbjhhcg.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zbGJzbndjY2NoZHhtYmpoaGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNzIxNjQsImV4cCI6MjA4OTY0ODE2NH0.99eHfVMfJTqbx0k1bcs-hfG8jPqRcTlR_rii8fSqnrQ"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

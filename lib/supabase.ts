import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nkhomvyrlkxhuafikyuu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5raG9tdnlybGt4aHVhZmlreXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NjYxOTIsImV4cCI6MjA2NzQ0MjE5Mn0.8mse6qzWK7Q0XfGXyNcP8jRjQPRmZTg_K9jymo2dydA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
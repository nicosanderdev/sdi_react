-- PostgreSQL Trigger to automatically create Member records when users sign up
-- Run this in your Supabase SQL Editor

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.members (user_id, first_name, last_name, avatar_url, created, last_modified)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'firstName',
    NEW.raw_user_meta_data->>'lastName',
    'https://placehold.co/150x150',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Optional: Enable Row Level Security on members table
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Optional: Create RLS policy (adjust based on your security requirements)
CREATE POLICY "Users can view their own member record" ON public.members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own member record" ON public.members
  FOR UPDATE USING (auth.uid() = user_id);

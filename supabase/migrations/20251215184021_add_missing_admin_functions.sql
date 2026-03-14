-- Function to get active users based on last sign-in
CREATE OR REPLACE FUNCTION public.get_active_users_count(days_back INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  cutoff_date TIMESTAMP WITH TIME ZONE;
  active_count INTEGER;
BEGIN
  cutoff_date := NOW() - INTERVAL '1 day' * days_back;

  SELECT COUNT(DISTINCT m."Id") INTO active_count
  FROM "Members" m
  JOIN auth.users au ON m."UserId" = au.id
  WHERE m."IsDeleted" = false
  AND au.last_sign_in_at >= cutoff_date;

  RETURN COALESCE(active_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

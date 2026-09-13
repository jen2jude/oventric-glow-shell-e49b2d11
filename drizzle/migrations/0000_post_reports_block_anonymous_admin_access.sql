DROP POLICY IF EXISTS "Admins can read reports" ON public.post_reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.post_reports;

CREATE POLICY "Admins can read reports"
ON public.post_reports
FOR SELECT
TO authenticated
USING (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update reports"
ON public.post_reports
FOR UPDATE
TO authenticated
USING (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND has_role(auth.uid(), 'admin'::app_role)
);
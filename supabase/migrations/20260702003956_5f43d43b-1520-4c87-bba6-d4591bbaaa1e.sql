
CREATE POLICY "media public read" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "media admins write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media' AND public.is_admin(auth.uid()));
CREATE POLICY "media admins update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'media' AND public.is_admin(auth.uid())) WITH CHECK (bucket_id = 'media' AND public.is_admin(auth.uid()));
CREATE POLICY "media admins delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media' AND public.is_admin(auth.uid()));

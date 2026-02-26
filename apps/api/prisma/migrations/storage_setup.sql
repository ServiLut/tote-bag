-- 1. Crear buckets si no existen
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-assets', 'product-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Política: Cualquiera puede ver las imágenes y assets (Público)
CREATE POLICY "Public Access Images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

CREATE POLICY "Public Access Assets"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-assets' );

-- 3. Política: Solo usuarios autenticados pueden subir
CREATE POLICY "Authenticated Upload Images"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'product-images' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated Upload Assets"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'product-assets' AND auth.role() = 'authenticated' );

-- 4. Política: Solo usuarios autenticados pueden borrar
CREATE POLICY "Authenticated Delete Images"
ON storage.objects FOR DELETE
USING ( bucket_id = 'product-images' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated Delete Assets"
ON storage.objects FOR DELETE
USING ( bucket_id = 'product-assets' AND auth.role() = 'authenticated' );

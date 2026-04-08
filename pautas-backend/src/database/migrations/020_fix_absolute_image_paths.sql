-- Migration 020: Fix absolute filesystem paths in image columns
-- Converts paths like "C:/Users/.../uploads/soporte/..." to "uploads/soporte/..."

-- Fix entry_images.image_path
UPDATE entry_images
SET image_path = SUBSTRING(image_path FROM POSITION('uploads/' IN image_path))
WHERE image_path LIKE '%:%uploads/%';

-- Fix entry_images.thumb_path
UPDATE entry_images
SET thumb_path = SUBSTRING(thumb_path FROM POSITION('uploads/' IN thumb_path))
WHERE thumb_path IS NOT NULL AND thumb_path LIKE '%:%uploads/%';

-- Fix daily_entries.soporte_image_path (legacy column)
UPDATE daily_entries
SET soporte_image_path = SUBSTRING(soporte_image_path FROM POSITION('uploads/' IN soporte_image_path))
WHERE soporte_image_path IS NOT NULL AND soporte_image_path LIKE '%:%uploads/%';

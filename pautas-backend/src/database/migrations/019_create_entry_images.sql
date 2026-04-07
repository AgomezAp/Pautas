-- Create entry_images table for multiple images per daily entry
CREATE TABLE IF NOT EXISTS entry_images (
    id              SERIAL PRIMARY KEY,
    entry_id        INTEGER NOT NULL REFERENCES daily_entries(id) ON DELETE CASCADE,
    image_path      VARCHAR(500) NOT NULL,
    original_name   VARCHAR(255),
    thumb_path      VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entry_images_entry_id ON entry_images(entry_id);

-- Migrate existing images from daily_entries to entry_images
INSERT INTO entry_images (entry_id, image_path, original_name)
SELECT id, soporte_image_path, soporte_original_name
FROM daily_entries
WHERE soporte_image_path IS NOT NULL;

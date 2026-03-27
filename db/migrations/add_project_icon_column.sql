-- Migration: Add icon column to kb_project for user-selectable project icons
ALTER TABLE kb_project ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT NULL;

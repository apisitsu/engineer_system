-- Rollback: SDS V2 template config + images
-- WARNING: drops all image data permanently

DROP TABLE IF EXISTS sds_v2_grinding_image;
DROP TABLE IF EXISTS sds_v2_tooling_image;
DROP TABLE IF EXISTS sds_v2_template_config;

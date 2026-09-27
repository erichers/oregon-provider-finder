CREATE ROLE opf_owner LOGIN PASSWORD 'local-docker';
CREATE ROLE opf_app LOGIN PASSWORD 'local-docker';
CREATE DATABASE oregon_providers OWNER opf_owner;
CREATE DATABASE oregon_providers_test OWNER opf_owner;
\connect oregon_providers
CREATE EXTENSION IF NOT EXISTS pg_trgm;
\connect oregon_providers_test
CREATE EXTENSION IF NOT EXISTS pg_trgm;

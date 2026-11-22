-- Idempotent. Needs the psql variable `password`; deploy/setup-server.sh asks for it.
\set ON_ERROR_STOP on
SELECT 'CREATE ROLE revou LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'revou') \gexec
ALTER ROLE revou WITH LOGIN NOSUPERUSER PASSWORD :'password';
SELECT 'CREATE DATABASE revoboard_db OWNER revou' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'revoboard_db') \gexec

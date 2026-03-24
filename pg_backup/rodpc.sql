--
-- PostgreSQL database dump
--

\restrict lvcTTNtuOJ8t96e69olw6CKzTIfkvXjSaih3rvMcFmjuABRsDRvQGXlUZiCy8If

-- Dumped from database version 17.9
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: m_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.m_user (
    u_code character varying(20) NOT NULL,
    u_pass character varying(255) NOT NULL,
    u_name character varying(100) NOT NULL,
    u_authority integer DEFAULT 0,
    u_role character varying(10) DEFAULT 'ENG'::character varying,
    permission_set character varying(100)
);


ALTER TABLE public.m_user OWNER TO postgres;

--
-- Data for Name: m_user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.m_user (u_code, u_pass, u_name, u_authority, u_role, permission_set) FROM stdin;
admin	$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi	Administrator	1	AD	\N
eng001	$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi	Engineer Test	1	ENG	\N
thapanon.p	$2a$10$i27OIQafwEOFxbCxWNWeGOxxzYjLK6Q7wDqA78eY94ZvYPEs/5Zpy	Thapanon P	4	ENG	\N
chairat.s	$2a$10$i27OIQafwEOFxbCxWNWeGOxxzYjLK6Q7wDqA78eY94ZvYPEs/5Zpy	Chairat S	4	ENG	\N
apisit.su	$2a$10$i27OIQafwEOFxbCxWNWeGOxxzYjLK6Q7wDqA78eY94ZvYPEs/5Zpy	Apisit Su	4	ENG	\N
pattanapong.p	$2a$10$i27OIQafwEOFxbCxWNWeGOxxzYjLK6Q7wDqA78eY94ZvYPEs/5Zpy	Pattanapong P	4	ENG	\N
suranat.n	$2a$10$i27OIQafwEOFxbCxWNWeGOxxzYjLK6Q7wDqA78eY94ZvYPEs/5Zpy	Suranat N	4	ENG	\N
teerapol.k	$2a$10$i27OIQafwEOFxbCxWNWeGOxxzYjLK6Q7wDqA78eY94ZvYPEs/5Zpy	Teerapol K	4	ENG	\N
nathaporn.y	$2a$10$i27OIQafwEOFxbCxWNWeGOxxzYjLK6Q7wDqA78eY94ZvYPEs/5Zpy	Nathaporn Y	4	ENG	\N
\.


--
-- Name: m_user m_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.m_user
    ADD CONSTRAINT m_user_pkey PRIMARY KEY (u_code);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO rodpc;


--
-- Name: TABLE m_user; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.m_user TO rodpc;


--
-- PostgreSQL database dump complete
--

\unrestrict lvcTTNtuOJ8t96e69olw6CKzTIfkvXjSaih3rvMcFmjuABRsDRvQGXlUZiCy8If


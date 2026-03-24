--
-- PostgreSQL database dump
--

--- \restrict pX0AoaKDzri5splz2QOZfUcUq3yDSaJiZ0B51IgHodTTROU5YjNfI7oDnpNfPYD

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

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: engreq
--

CREATE TYPE public."UserRole" AS ENUM (
    'admin',
    'requester',
    'engineer',
    'draftman',
    'reviewer',
    'approver'
);


ALTER TYPE public."UserRole" OWNER TO engreq;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: departments; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.departments OWNER TO engreq;

--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.departments_id_seq OWNER TO engreq;

--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: draft_man; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.draft_man (
    id integer NOT NULL,
    "requestId" integer NOT NULL,
    "draftmanName" text NOT NULL,
    "draftmanEmail" text NOT NULL,
    "dwgFiles" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.draft_man OWNER TO engreq;

--
-- Name: draft_man_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.draft_man_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.draft_man_id_seq OWNER TO engreq;

--
-- Name: draft_man_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.draft_man_id_seq OWNED BY public.draft_man.id;


--
-- Name: due_days_config; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.due_days_config (
    id integer NOT NULL,
    "requestType" text NOT NULL,
    days integer NOT NULL
);


ALTER TABLE public.due_days_config OWNER TO engreq;

--
-- Name: due_days_config_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.due_days_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.due_days_config_id_seq OWNER TO engreq;

--
-- Name: due_days_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.due_days_config_id_seq OWNED BY public.due_days_config.id;


--
-- Name: dwg_check; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.dwg_check (
    id integer NOT NULL,
    "requestId" integer NOT NULL,
    "checkerName" text NOT NULL,
    "checkerEmail" text NOT NULL,
    status text NOT NULL,
    comment text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.dwg_check OWNER TO engreq;

--
-- Name: dwg_check_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.dwg_check_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dwg_check_id_seq OWNER TO engreq;

--
-- Name: dwg_check_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.dwg_check_id_seq OWNED BY public.dwg_check.id;


--
-- Name: email_config; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.email_config (
    id integer NOT NULL,
    stage text NOT NULL,
    emails text NOT NULL
);


ALTER TABLE public.email_config OWNER TO engreq;

--
-- Name: email_config_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.email_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_config_id_seq OWNER TO engreq;

--
-- Name: email_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.email_config_id_seq OWNED BY public.email_config.id;


--
-- Name: eng_approve; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.eng_approve (
    id integer NOT NULL,
    "requestId" integer NOT NULL,
    "approverName" text NOT NULL,
    "approverEmail" text NOT NULL,
    judgement text NOT NULL,
    comment text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.eng_approve OWNER TO engreq;

--
-- Name: eng_approve_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.eng_approve_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.eng_approve_id_seq OWNER TO engreq;

--
-- Name: eng_approve_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.eng_approve_id_seq OWNED BY public.eng_approve.id;


--
-- Name: eng_check; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.eng_check (
    id integer NOT NULL,
    "requestId" integer NOT NULL,
    "checkerName" text NOT NULL,
    "checkerEmail" text NOT NULL,
    status text NOT NULL,
    comment text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.eng_check OWNER TO engreq;

--
-- Name: eng_check_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.eng_check_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.eng_check_id_seq OWNER TO engreq;

--
-- Name: eng_check_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.eng_check_id_seq OWNED BY public.eng_check.id;


--
-- Name: eng_inform; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.eng_inform (
    id integer NOT NULL,
    "requestId" integer NOT NULL,
    cost text,
    evidence text,
    "attachFiles" text,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.eng_inform OWNER TO engreq;

--
-- Name: eng_inform_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.eng_inform_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.eng_inform_id_seq OWNER TO engreq;

--
-- Name: eng_inform_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.eng_inform_id_seq OWNED BY public.eng_inform.id;


--
-- Name: eng_review; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.eng_review (
    id integer NOT NULL,
    "requestId" integer NOT NULL,
    "reviewerName" text NOT NULL,
    "reviewerEmail" text NOT NULL,
    section text NOT NULL,
    "sparePartType" text,
    general text,
    "machinePart" text,
    "gaugeType" text,
    "noOfDwg" text NOT NULL,
    "drawingNo" text NOT NULL,
    "attachFiles" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.eng_review OWNER TO engreq;

--
-- Name: eng_review_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.eng_review_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.eng_review_id_seq OWNER TO engreq;

--
-- Name: eng_review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.eng_review_id_seq OWNED BY public.eng_review.id;


--
-- Name: holidays; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.holidays (
    id integer NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    name text
);


ALTER TABLE public.holidays OWNER TO engreq;

--
-- Name: holidays_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.holidays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.holidays_id_seq OWNER TO engreq;

--
-- Name: holidays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.holidays_id_seq OWNED BY public.holidays.id;


--
-- Name: machines; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.machines (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.machines OWNER TO engreq;

--
-- Name: machines_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.machines_id_seq OWNER TO engreq;

--
-- Name: machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.machines_id_seq OWNED BY public.machines.id;


--
-- Name: requests; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.requests (
    id integer NOT NULL,
    "requestItem" text NOT NULL,
    "requestNo" text,
    status text DEFAULT 'Pending Eng Check'::text NOT NULL,
    "currentStage" text DEFAULT 'Eng Check'::text NOT NULL,
    department text NOT NULL,
    "workCenter" text NOT NULL,
    "workCenterName" text,
    requester text NOT NULL,
    "requesterEmail" text NOT NULL,
    "typeOfRequest" text NOT NULL,
    category text NOT NULL,
    "drawingRequired" text,
    "typeOfDrawing" text,
    title text NOT NULL,
    detail text NOT NULL,
    "machineNo" text,
    "machineName" text,
    "reqDueDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    attachments text
);


ALTER TABLE public.requests OWNER TO engreq;

--
-- Name: requests_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.requests_id_seq OWNER TO engreq;

--
-- Name: requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.requests_id_seq OWNED BY public.requests.id;


--
-- Name: tracking; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.tracking (
    id integer NOT NULL,
    "requestId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "engCheckAt" timestamp(3) without time zone,
    "draftManAt" timestamp(3) without time zone,
    "dwgCheckAt" timestamp(3) without time zone,
    "engReviewAt" timestamp(3) without time zone,
    "engApproveAt" timestamp(3) without time zone,
    "engInformAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "engCheckDays" integer,
    "draftManDays" integer,
    "dwgCheckDays" integer,
    "engReviewDays" integer,
    "engApproveDays" integer,
    "totalDays" integer,
    status text DEFAULT 'In Progress'::text NOT NULL,
    "onTime" boolean
);


ALTER TABLE public.tracking OWNER TO engreq;

--
-- Name: tracking_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tracking_id_seq OWNER TO engreq;

--
-- Name: tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.tracking_id_seq OWNED BY public.tracking.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text,
    password text,
    name text NOT NULL,
    role public."UserRole" DEFAULT 'requester'::public."UserRole" NOT NULL,
    department text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    empno character varying(10),
    auth character varying(10) DEFAULT '4'::character varying,
    section character varying(50)
);


ALTER TABLE public.users OWNER TO engreq;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO engreq;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: work_centers; Type: TABLE; Schema: public; Owner: engreq
--

CREATE TABLE public.work_centers (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    department text
);


ALTER TABLE public.work_centers OWNER TO engreq;

--
-- Name: work_centers_id_seq; Type: SEQUENCE; Schema: public; Owner: engreq
--

CREATE SEQUENCE public.work_centers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_centers_id_seq OWNER TO engreq;

--
-- Name: work_centers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: engreq
--

ALTER SEQUENCE public.work_centers_id_seq OWNED BY public.work_centers.id;


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: draft_man id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.draft_man ALTER COLUMN id SET DEFAULT nextval('public.draft_man_id_seq'::regclass);


--
-- Name: due_days_config id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.due_days_config ALTER COLUMN id SET DEFAULT nextval('public.due_days_config_id_seq'::regclass);


--
-- Name: dwg_check id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.dwg_check ALTER COLUMN id SET DEFAULT nextval('public.dwg_check_id_seq'::regclass);


--
-- Name: email_config id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.email_config ALTER COLUMN id SET DEFAULT nextval('public.email_config_id_seq'::regclass);


--
-- Name: eng_approve id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.eng_approve ALTER COLUMN id SET DEFAULT nextval('public.eng_approve_id_seq'::regclass);


--
-- Name: eng_check id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.eng_check ALTER COLUMN id SET DEFAULT nextval('public.eng_check_id_seq'::regclass);


--
-- Name: eng_inform id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.eng_inform ALTER COLUMN id SET DEFAULT nextval('public.eng_inform_id_seq'::regclass);


--
-- Name: eng_review id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.eng_review ALTER COLUMN id SET DEFAULT nextval('public.eng_review_id_seq'::regclass);


--
-- Name: holidays id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.holidays ALTER COLUMN id SET DEFAULT nextval('public.holidays_id_seq'::regclass);


--
-- Name: machines id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.machines ALTER COLUMN id SET DEFAULT nextval('public.machines_id_seq'::regclass);


--
-- Name: requests id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.requests ALTER COLUMN id SET DEFAULT nextval('public.requests_id_seq'::regclass);


--
-- Name: tracking id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.tracking ALTER COLUMN id SET DEFAULT nextval('public.tracking_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: work_centers id; Type: DEFAULT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.work_centers ALTER COLUMN id SET DEFAULT nextval('public.work_centers_id_seq'::regclass);


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.departments (id, name) FROM stdin;
1	ROD
2	SPG
3	IDG
4	VSG
5	Maintenance
6	Quality
7	Engineer
8	Cost Management (MC & Purchase)
9	Production Control
10	Production#1
11	Production#2
12	Machine Maintenance & Improvement
13	Quality Control
14	Quality Assurance
\.


--
-- Data for Name: draft_man; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.draft_man (id, "requestId", "draftmanName", "draftmanEmail", "dwgFiles", "createdAt", "updatedAt") FROM stdin;
1	1	suranat.n	suranat.n@minebea.co.th	https://drive.google.com/file/d/1mP-cLfH7X7W5l1whhARqFcuudmV8sNMK/view?usp=drivesdk	2026-01-19 21:11:30.945	2026-01-19 21:11:30.945
2	2	apisit.su	apisit.su@minebea.co.th	https://drive.google.com/file/d/1zTXNWC4oG2z1FpVOo900OB8F9INItozY/view?usp=drivesdk	2026-01-20 18:27:00.869	2026-01-20 18:27:00.869
3	3	apisit.su	apisit.su@minebea.co.th	https://drive.google.com/file/d/1mcEDO4N5NuMNNk-JkTb3j_6uL7EsQ8EB/view?usp=drivesdk	2026-01-20 21:30:48.653	2026-01-20 21:30:48.653
4	4	apisit.su	apisit.su@minebea.co.th	https://drive.google.com/file/d/1rnuA8v6ieYa9dbwrofJd-fLgDmjOSIzR/view?usp=drivesdk	2026-01-20 21:54:04.648	2026-01-20 21:54:04.648
5	5	apisit.su	apisit.su@minebea.co.th	https://drive.google.com/file/d/1v2mEui2LTeuS4amHmJQSEzn-YNI452VE/view?usp=drivesdk	2026-01-21 02:04:44.275	2026-01-21 02:04:44.275
6	6	apisit.su	apisit.su@minebea.co.th	https://drive.google.com/file/d/1uqojhJG0mPWOLxJvuRfzk1doJxIEI7X3/view?usp=drivesdk	2026-01-21 14:53:58.098	2026-01-21 14:53:58.098
7	7	apisit.su	apisit.su@minebea.co.th	https://drive.google.com/file/d/1O3y4zV4bpAybTVfytDu6-3Q1XlZ8zIjY/view?usp=drivesdk	2026-01-21 17:55:42.653	2026-01-21 17:55:42.653
8	8	apisit.su	apisit.su@minebea.co.th	https://drive.google.com/file/d/1nBa771YP1UpVP5_C2p5Q5oy5L5rYlPUZ/view?usp=drivesdk	2026-01-21 18:16:38.252	2026-01-21 18:16:38.252
9	9	apisit.su	apisit.su@minebea.co.th	https://drive.google.com/file/d/1jvISr_vxqcUzqhnIoQO7MCbaJJYnxG1R/view?usp=drivesdk	2026-01-21 23:16:35.671	2026-01-21 23:16:35.671
10	10	apisit.su	apisit.su@minebea.co.th	https://drive.google.com/file/d/1Tf5ySvEyDrS73j00VFlDPfuGB34lGdo8/view?usp=drivesdk	2026-01-21 23:41:02.776	2026-01-21 23:41:02.776
\.


--
-- Data for Name: due_days_config; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.due_days_config (id, "requestType", days) FROM stdin;
1	Regist Drawing	5
2	Draft Drawing	7
3	3D Print	10
\.


--
-- Data for Name: dwg_check; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.dwg_check (id, "requestId", "checkerName", "checkerEmail", status, comment, "createdAt") FROM stdin;
1	1	chairat.s	chairat.s@minebea.co.th	Approve	\N	2026-01-19 21:18:09.454
2	2	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-20 18:30:46.448
3	3	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-20 21:31:31.818
4	4	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-20 21:55:33.688
5	5	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 02:05:09.462
6	6	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 14:55:01.122
7	7	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 17:56:45.478
8	8	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 18:17:31.766
9	9	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 23:17:36.359
10	10	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 23:41:23.783
\.


--
-- Data for Name: email_config; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.email_config (id, stage, emails) FROM stdin;
1	ENG_CHECK	chairat.s@minebea.co.th, apisit.su@minebea.co.th, pattanapong.p@minebea.co.th
2	CC_ENG_CHECK	suranat.n@minebea.co.th, thapanon.p@minebea.co.th, phanuwach.t@minebea.co.th, nathaporn.y@minebea.co.th, teerapol.k@minebea.co.th, skaniwa@minebea.co.th
3	DRAFTMAN	suranat.n@minebea.co.th
4	CC_DRAFTMAN	apisit.su@minebea.co.th, pattanapong.p@minebea.co.th
5	DWG_CHECK	chairat.s@minebea.co.th, apisit.su@minebea.co.th
6	CC_DWG_CHECK	pattanapong.p@minebea.co.th
7	ENG_REVIEW	chairat.s@minebea.co.th, apisit.su@minebea.co.th
8	CC_ENG_REVIEW	pattanapong.p@minebea.co.th
9	ENG_APPROVE	teerapol.k@minebea.co.th
10	CC_ENG_APPROVE	suranat.n@minebea.co.th, chairat.s@minebea.co.th, apisit.su@minebea.co.th, pattanapong.p@minebea.co.th
11	ENG_INFORM	chairat.s@minebea.co.th, apisit.su@minebea.co.th
12	CC_ENG_INFORM	pattanapong.p@minebea.co.th
25	ADMIN	chairat.s@minebea.co.th, pattanapong.p@minebea.co.th
\.


--
-- Data for Name: eng_approve; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.eng_approve (id, "requestId", "approverName", "approverEmail", judgement, comment, "createdAt") FROM stdin;
1	1	pattanapong.p	pattanapong.p@minebea.co.th	Approve	\N	2026-01-19 21:25:46.492
2	2	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-20 18:42:26.278
3	3	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-20 21:36:02.032
4	4	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-20 21:58:50.775
5	5	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 02:06:51.831
6	6	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 15:02:52.42
7	7	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 18:03:01.243
8	8	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 18:20:33.826
9	9	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 23:19:49.417
10	10	apisit.su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 23:43:15.833
\.


--
-- Data for Name: eng_check; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.eng_check (id, "requestId", "checkerName", "checkerEmail", status, comment, "createdAt") FROM stdin;
1	1	chairat s	chairat.s@minebea.co.th	Approve	\N	2026-01-19 21:03:49.994
2	2	apisit su	apisit.su@minebea.co.th	Approve	\N	2026-01-20 18:25:51.035
3	3	apisit su	apisit.su@minebea.co.th	Approve	\N	2026-01-20 21:29:40.622
4	4	apisit su	apisit.su@minebea.co.th	Approve	\N	2026-01-20 21:53:12.582
5	5	apisit su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 02:04:04.481
6	6	apisit su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 14:52:51.873
7	7	apisit su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 17:55:02.221
8	8	apisit su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 18:15:51.18
9	9	apisit su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 23:15:40.251
10	10	apisit su	apisit.su@minebea.co.th	Approve	\N	2026-01-21 23:40:14.804
\.


--
-- Data for Name: eng_inform; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.eng_inform (id, "requestId", cost, evidence, "attachFiles", "sentAt") FROM stdin;
1	1	N/A	\N	https://drive.google.com/file/d/1Uh3M0a2BqOt9Dr1lYae-AiD6dJ3Gg85f/view?usp=drivesdk	2026-01-19 21:28:22.789
2	2	N/A	\N	https://drive.google.com/file/d/1jkEW_o51KYSbgt2zBYVEa_cxv1M3TC--/view?usp=drivesdk	2026-01-20 19:56:03.484
3	3	N/A	Reference from attach file	https://drive.google.com/file/d/1_EqqE36jvJ6ozWTeHDS_jNRrtAIFqqcX/view?usp=drivesdk	2026-01-20 21:37:14.699
4	4	N/A	remain form Eng. approve to show attach file from Eng. review	https://drive.google.com/file/d/1UTppKZOMCswgWCkNzAaPWSEdDM_6mGOx/view?usp=drivesdk	2026-01-20 22:00:57.965
5	5	N/A	Eng review to Eng approve OK	https://drive.google.com/file/d/1zWmecPM4VfLm82IhLqozvLrk_4Mier1j/view?usp=drivesdk	2026-01-21 02:46:08.953
6	6	N/A	\N	https://drive.google.com/file/d/1PVtGxCdo3i4x-kF6-nEPciKoj66a8LUW/view?usp=drivesdk	2026-01-21 15:04:24.13
7	7	N/A	\N	https://drive.google.com/file/d/1IVfaee-uU7iarJ6PUjt2x_mzLXZh0b8b/view?usp=drivesdk	2026-01-21 18:06:14.988
8	8	N/A	\N	https://drive.google.com/file/d/1ymGpNviaBBg7JK2G2OfA6ocojvTWrbka/view?usp=drivesdk	2026-01-21 22:03:44.448
9	9	N/A	\N	https://drive.google.com/file/d/1gkEKaSvfGxVc4-AIf5k2wiJ5zAr3UJQq/view?usp=drivesdk	2026-01-21 23:28:51.729
10	10	N/A	\N	https://drive.google.com/file/d/1MNEn3E99CwmVR5w-XYGhPiG5kUmvri9r/view?usp=drivesdk	2026-01-21 23:43:51.278
\.


--
-- Data for Name: eng_review; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.eng_review (id, "requestId", "reviewerName", "reviewerEmail", section, "sparePartType", general, "machinePart", "gaugeType", "noOfDwg", "drawingNo", "attachFiles", "createdAt") FROM stdin;
1	1	chairat.s	chairat.s@minebea.co.th	1	\N	\N	\N	\N	1	g	https://drive.google.com/file/d/1Uh3M0a2BqOt9Dr1lYae-AiD6dJ3Gg85f/view?usp=drivesdk	2026-01-19 21:22:01.492
2	2	apisit.su	apisit.su@minebea.co.th	1	\N	\N	\N	\N	1	9999-99-999	https://drive.google.com/file/d/1jkEW_o51KYSbgt2zBYVEa_cxv1M3TC--/view?usp=drivesdk	2026-01-20 18:39:53.925
3	3	apisit.su	apisit.su@minebea.co.th	1	Improvement	\N	\N	\N	1	9999-9999-9999	https://drive.google.com/file/d/1_EqqE36jvJ6ozWTeHDS_jNRrtAIFqqcX/view?usp=drivesdk	2026-01-20 21:34:15.201
4	4	apisit.su	apisit.su@minebea.co.th	1	\N	Single part	Improvement	Inspection	1	0000-00-0000	https://drive.google.com/file/d/1UTppKZOMCswgWCkNzAaPWSEdDM_6mGOx/view?usp=drivesdk	2026-01-20 21:58:20.232
5	5	apisit.su	apisit.su@minebea.co.th	2	Inspection	\N	\N	\N	2	8888-88-888	https://drive.google.com/file/d/1zWmecPM4VfLm82IhLqozvLrk_4Mier1j/view?usp=drivesdk	2026-01-21 02:06:07.997
6	6	apisit.su	apisit.su@minebea.co.th	1	\N	\N	\N	\N	1	C31-00842_1_NC (6)	https://drive.google.com/file/d/1PVtGxCdo3i4x-kF6-nEPciKoj66a8LUW/view?usp=drivesdk	2026-01-21 14:59:09.266
7	7	apisit.su	apisit.su@minebea.co.th	2	Other	\N	\N	\N	2	C31-00842_1_NC (7)	https://drive.google.com/file/d/1IVfaee-uU7iarJ6PUjt2x_mzLXZh0b8b/view?usp=drivesdk	2026-01-21 18:01:52.256
8	8	apisit.su	apisit.su@minebea.co.th	3	\N	Assembly part	Improvement	Inspection	3	C31-00842_1_NC (8)	https://drive.google.com/file/d/1ymGpNviaBBg7JK2G2OfA6ocojvTWrbka/view?usp=drivesdk	2026-01-21 18:19:44.411
9	9	apisit.su	apisit.su@minebea.co.th	4	\N	Other	Maintenance	Inspection	4	C31-00842_1_NC (9)	https://drive.google.com/file/d/1gkEKaSvfGxVc4-AIf5k2wiJ5zAr3UJQq/view?usp=drivesdk	2026-01-21 23:18:49.982
10	10	apisit.su	apisit.su@minebea.co.th	5	Improvement	\N	\N	\N	5	4036-01-0004_1_NC	https://drive.google.com/file/d/1MNEn3E99CwmVR5w-XYGhPiG5kUmvri9r/view?usp=drivesdk	2026-01-21 23:42:42.115
\.


--
-- Data for Name: holidays; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.holidays (id, date, name) FROM stdin;
1	2025-01-01 07:00:00	\N
2	2025-01-02 07:00:00	\N
3	2025-01-05 07:00:00	\N
4	2025-01-11 07:00:00	\N
5	2025-01-12 07:00:00	\N
6	2025-01-18 07:00:00	\N
7	2025-01-19 07:00:00	\N
8	2025-01-25 07:00:00	\N
9	2025-01-26 07:00:00	\N
10	2025-02-01 07:00:00	\N
11	2025-02-02 07:00:00	\N
12	2025-02-08 07:00:00	\N
13	2025-02-09 07:00:00	\N
14	2025-02-12 07:00:00	\N
15	2025-02-16 07:00:00	\N
16	2025-02-23 07:00:00	\N
17	2025-03-01 07:00:00	\N
18	2025-03-02 07:00:00	\N
19	2025-03-08 07:00:00	\N
20	2025-03-09 07:00:00	\N
21	2025-03-15 07:00:00	\N
22	2025-03-16 07:00:00	\N
23	2025-03-23 07:00:00	\N
24	2025-03-29 07:00:00	\N
25	2025-03-30 07:00:00	\N
26	2025-04-05 07:00:00	\N
27	2025-04-06 07:00:00	\N
28	2025-04-12 07:00:00	\N
29	2025-04-13 07:00:00	\N
30	2025-04-14 07:00:00	\N
31	2025-04-15 07:00:00	\N
32	2025-04-16 07:00:00	\N
33	2025-04-20 07:00:00	\N
34	2025-04-26 07:00:00	\N
35	2025-04-27 07:00:00	\N
36	2025-05-01 07:00:00	\N
37	2025-05-04 07:00:00	\N
38	2025-05-10 07:00:00	\N
39	2025-05-11 07:00:00	\N
40	2025-05-12 07:00:00	\N
41	2025-05-18 07:00:00	\N
42	2025-05-24 07:00:00	\N
43	2025-05-25 07:00:00	\N
44	2025-06-01 07:00:00	\N
45	2025-06-02 07:00:00	\N
46	2025-06-03 07:00:00	\N
47	2025-06-08 07:00:00	\N
48	2025-06-14 07:00:00	\N
49	2025-06-15 07:00:00	\N
50	2025-06-22 07:00:00	\N
51	2025-06-28 07:00:00	\N
52	2025-06-29 07:00:00	\N
53	2025-07-05 07:00:00	\N
55	2025-07-10 07:00:00	\N
56	2025-07-13 07:00:00	\N
57	2025-07-19 07:00:00	\N
58	2025-07-20 07:00:00	\N
59	2025-07-26 07:00:00	\N
60	2025-07-27 07:00:00	\N
61	2025-07-28 07:00:00	\N
62	2025-08-03 07:00:00	\N
63	2025-08-10 07:00:00	\N
64	2025-08-11 07:00:00	\N
65	2025-08-12 07:00:00	\N
66	2025-08-17 07:00:00	\N
67	2025-08-23 07:00:00	\N
68	2025-08-24 07:00:00	\N
69	2025-08-30 07:00:00	\N
70	2025-08-31 07:00:00	\N
71	2025-09-06 07:00:00	\N
72	2025-09-07 07:00:00	\N
73	2025-09-13 07:00:00	\N
74	2025-09-14 07:00:00	\N
75	2025-09-20 07:00:00	\N
76	2025-09-21 07:00:00	\N
77	2025-09-27 07:00:00	\N
78	2025-09-28 07:00:00	\N
79	2025-10-04 07:00:00	\N
80	2025-10-05 07:00:00	\N
81	2025-10-11 07:00:00	\N
82	2025-10-12 07:00:00	\N
83	2025-10-13 07:00:00	\N
84	2025-10-19 07:00:00	\N
85	2025-10-23 07:00:00	\N
86	2025-10-26 07:00:00	\N
87	2025-11-01 07:00:00	\N
88	2025-11-02 07:00:00	\N
89	2025-11-08 07:00:00	\N
90	2025-11-09 07:00:00	\N
91	2025-11-15 07:00:00	\N
92	2025-11-16 07:00:00	\N
93	2025-11-23 07:00:00	\N
94	2025-11-29 07:00:00	\N
95	2025-11-30 07:00:00	\N
96	2025-12-05 07:00:00	\N
97	2025-12-06 07:00:00	\N
98	2025-12-07 07:00:00	\N
99	2025-12-13 07:00:00	\N
100	2025-12-14 07:00:00	\N
101	2025-12-20 07:00:00	\N
102	2025-12-21 07:00:00	\N
103	2025-12-28 07:00:00	\N
104	2025-12-31 07:00:00	\N
105	2026-01-01 07:00:00	\N
106	2026-01-02 07:00:00	\N
107	2026-01-03 07:00:00	\N
108	2026-01-04 07:00:00	\N
109	2026-01-10 07:00:00	\N
110	2026-01-11 07:00:00	\N
111	2026-01-18 07:00:00	\N
112	2026-01-24 07:00:00	\N
113	2026-01-25 07:00:00	\N
114	2026-02-01 07:00:00	\N
115	2026-02-07 07:00:00	\N
116	2026-02-08 07:00:00	\N
117	2026-02-15 07:00:00	\N
118	2026-02-21 07:00:00	\N
119	2026-02-22 07:00:00	\N
120	2026-03-01 07:00:00	\N
121	2026-03-02 07:00:00	\N
122	2026-03-03 07:00:00	\N
123	2026-03-08 07:00:00	\N
124	2026-03-14 07:00:00	\N
125	2026-03-15 07:00:00	\N
126	2026-03-22 07:00:00	\N
127	2026-03-28 07:00:00	\N
128	2026-03-29 07:00:00	\N
129	2026-04-04 07:00:00	\N
130	2026-04-05 07:00:00	\N
131	2026-04-12 07:00:00	\N
132	2026-04-13 07:00:00	\N
133	2026-04-14 07:00:00	\N
134	2026-04-15 07:00:00	\N
135	2026-04-16 07:00:00	\N
136	2026-04-19 07:00:00	\N
137	2026-04-25 07:00:00	\N
138	2026-04-26 07:00:00	\N
139	2026-05-01 07:00:00	\N
140	2026-05-02 07:00:00	\N
141	2026-05-03 07:00:00	\N
142	2026-05-10 07:00:00	\N
143	2026-05-16 07:00:00	\N
144	2026-05-17 07:00:00	\N
145	2026-05-23 07:00:00	\N
146	2026-05-24 07:00:00	\N
147	2026-05-31 07:00:00	\N
148	2026-06-01 07:00:00	\N
149	2026-06-02 07:00:00	\N
150	2026-06-03 07:00:00	\N
151	2026-06-07 07:00:00	\N
152	2026-06-14 07:00:00	\N
153	2026-06-20 07:00:00	\N
154	2026-06-21 07:00:00	\N
155	2026-06-27 07:00:00	\N
156	2026-06-28 07:00:00	\N
157	2026-07-05 07:00:00	\N
158	2026-07-11 07:00:00	\N
159	2026-07-12 07:00:00	\N
160	2026-07-18 07:00:00	\N
161	2026-07-19 07:00:00	\N
162	2026-07-26 07:00:00	\N
163	2026-07-27 07:00:00	\N
164	2026-07-28 07:00:00	\N
165	2026-07-29 07:00:00	\N
166	2026-08-02 07:00:00	\N
167	2026-08-08 07:00:00	\N
168	2026-08-09 07:00:00	\N
169	2026-08-12 07:00:00	\N
170	2026-08-16 07:00:00	\N
171	2026-08-22 07:00:00	\N
172	2026-08-23 07:00:00	\N
173	2026-08-29 07:00:00	\N
174	2026-08-30 07:00:00	\N
175	2026-09-05 07:00:00	\N
176	2026-09-06 07:00:00	\N
177	2026-09-12 07:00:00	\N
178	2026-09-13 07:00:00	\N
179	2026-09-19 07:00:00	\N
180	2026-09-20 07:00:00	\N
181	2026-09-26 07:00:00	\N
182	2026-09-27 07:00:00	\N
183	2026-10-03 07:00:00	\N
184	2026-10-04 07:00:00	\N
185	2026-10-11 07:00:00	\N
186	2026-10-12 07:00:00	\N
187	2026-10-13 07:00:00	\N
188	2026-10-18 07:00:00	\N
189	2026-10-23 07:00:00	\N
190	2026-10-24 07:00:00	\N
191	2026-10-25 07:00:00	\N
192	2026-10-31 07:00:00	\N
193	2026-11-01 07:00:00	\N
194	2026-11-08 07:00:00	\N
195	2026-11-14 07:00:00	\N
196	2026-11-15 07:00:00	\N
197	2026-11-22 07:00:00	\N
198	2026-11-28 07:00:00	\N
199	2026-11-29 07:00:00	\N
200	2026-12-05 07:00:00	\N
201	2026-12-06 07:00:00	\N
202	2026-12-13 07:00:00	\N
203	2026-12-19 07:00:00	\N
204	2026-12-20 07:00:00	\N
205	2026-12-26 07:00:00	\N
206	2026-12-27 07:00:00	\N
207	2026-12-30 07:00:00	\N
208	2026-12-31 07:00:00	\N
\.


--
-- Data for Name: machines; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.machines (id, code, name) FROM stdin;
1	M001	Machine 001
2	M002	Machine 002
3	M003	Machine 003
4	M004	Machine 004
5	APC-01	-
6	APC-02	TM-20NM
7	APC-03	AP-15
8	APC-04	AP-16
9	BCF-01	DC-45
10	BCF-02	LPS PB-80
11	BFD-01	QSM200
12	BFD-02	QSM200
13	BFD-03	QSM250M
14	BFD-04	QSM200M
15	BFD-05	QSM200M
16	BFD-06	QSM200M
17	BFD-07	QSM200M
18	BFD-08	QSM200M
19	BFD-09	LB12
20	BFD-10	QSM150MS
21	BFD-11	LB12
22	BFD-12	QSM150MS
23	BFD-13	LB12
24	BFD-14	LB12
25	BFD-15	LB12
26	BFD-16	LB12
27	BFD-17	LB12
28	BFD-18	LB12
29	BFD-19	LB15
30	BFD-20	LB12
31	BFD-21	LB15
32	BFD-22	LB12
33	BFD-23	QSM150MS(400U)
34	BFD-24	QSM150MS(400U)
35	BFD-25	QSM150MS(400U)
36	BFD-26	QT200MM(500U)
37	BFD-27	QTN200MSY
38	BFD-28	QTN200(500U)
39	BFD-29	QTN200(500U)
40	BFD-30	QTN250-MSY
41	BFD-31	QT200MM(500U)
42	BFD-32	QT200MM(500U)
43	BFD-33	QT200MM(500U)
44	BFD-34	QUICK TURN 200 (500U)
45	BFG-01	FB-10TH
46	BFG-02	LM5P
47	BFG-03	LM5P
48	BFG-04	FG-305T
49	BFG-05	-
50	BLK-01	QSM150S
51	BLK-02	NK20
52	BLK-03	QSM150S
53	BLK-04	QSM150S
54	BLK-05	QSM150S(300U)
55	BLK-06	QTN150-2
56	BLK-07	QTN150-2
57	BLK-08	QSM150S
58	BLK-09	QT150SG(300U)
59	BLK-10	QT150SG(300U)
60	BLK-11	QT150SG(300U)
61	BRL-01	EFF-105SA
62	BRL-02	LZG200
63	BRL-03	HS-R80
64	BRL-04	CCL-200SB
65	BRL-05	120A
66	BRL-06	VF-1423W
67	BRL-07	RS-120
68	BRL-08	120A
69	BRL-09	VF-1423W-022
70	BRL-10	150A
71	BRL-11	KED-100
72	BRL-12	CCL-200SB
73	BRL-13	LZG-200
74	BRL-14	120H
75	BRL-15	120A
76	BRL-16	EFF-105SA
77	BRL-17	LXG100B
78	BSM-01	25MRA-6
79	BSM-02	25MRA-6
80	BSM-03	25MRA-6
81	BSM-04	25MRA-6
82	BSM-05	25MRA-6
83	BSM-06	25MRA-6
84	BSM-07	25MRA-6
85	BSM-08	25MRA-6
86	BSM-09	25MRA-6
87	BSM-10	RAN-6
88	BSM-11	RB-6
89	BSM-12	RB-6
90	BTM-01	NSV-1555FE
91	BTM-02	ROBODRILL α-D14MiA
92	CFC-01	CF2-0907T
93	CFC-02	CF2-0907T
94	CFC-03	NC-810
95	CGM-01	OC-18BR-150
96	CGM-03	OC-18BR-150
97	CGM-04	OC-16A
98	CGM-05	OC-18BR-150
99	CGM-06	OC-18BR-150
100	CGM-07	OC-18BR-150
101	CGM-08	OC-20BR-200
102	CGM-09	MD-450-RDP
103	CGM-10	KS-450C
104	CGM-11	SIGMA-18
105	CGM-12	KS-450C
106	CGM-14	NISSIN_HIGRIND-1-D
107	CHK-01	QTN300-2MY
108	CHK-02	QTN300-2MY
109	CHK-03	QTN200
110	CHK-04	QTN200
111	CHK-05	QTN200
112	CHK-06	NK20
113	CHK-07	LB12
114	CHK-10	QSM200M
115	CHK-11	QTN200-2MY(500U)
116	CHK-12	QTN200-2MY(500U)
117	CHK-13	LB12
118	CHK-14	QT200(U500)
119	CMM-01	BND-CC776
120	CMM-02	Crysta-Apex S
121	CNT-01	COUNTER 2600E
122	CNT-02	COUNTER 2600G
123	CNT-03	COUNTER 260G-12
124	CNT-04	COUNTER 260G-14
125	CPT-01	CCP-103H
126	CPT-02	RUF4/3700/60X40
127	CPT-02(1)	RUF4
128	CPT-02(2)	SCP-103H
129	CPT-03	RUF4/3700/60X40
130	CPT-04	SCP-103H
131	CTG-01	HA-250
132	CTG-02	HA-250
133	CTG-03	CMB75CNC
134	CTG-04	P-65A
135	CTG-05	RCA-234
136	CTG-07	HA-250W
137	CTG-08	RCA-236
138	CTG-09	SK-4S
139	CWM-01	96F-4937
140	CWM-02	VONOVO M1
141	CWM-03	SK-96F-4937
142	CWM-04	SK-13Y6329-1
143	CWM-05	CONCEPT-VN2
144	DFB-01	PSB-B501B
145	DFB-02	-
146	DFB-03	TOK-02
147	DMG-01	LO-30
148	DMG-02	D20A-02G7E
149	DMG-03	LO-30
150	DMG-04	LO-30
151	DMG-05	LO-30
152	EGM-01	KN-312A
153	EGM-02	KN-312A
154	EGM-03	KN-312A
155	EGM-04	KN-312A
156	FGM-02	FGM-02
157	FPI-01	DU-010
158	FRL-01	AE07-187
159	FRL-02	639TWIN SPINDLE
160	GPL-01	ECOMET30-TWIN AUTO WHEEL
161	HDP-01	C-3
162	HDP-02	C-3
163	HDP-03	C-3
164	HON-01	-
165	HON-02	MBB-1600
166	HSG-01	KVD-300CRII
167	HSG-02	KVD350C
168	HTM-01	810-208E
169	HTM-02	810-208E
170	HTM-03	810-981E
171	HTM-04	FM-700
172	HTM-05	FR-3el
173	HTM-06	LC200R
174	HTM-07	LC200R
175	IDG-01	KS-B22RD
176	IDG-02	KS-B22RD
177	IDG-03	KS-03A
178	IDG-04	KS-03A
179	IDG-05	KS-03A
180	IDG-06	KS-03A
181	IDG-07	KS-03A
182	IDG-08	KS-B80
183	IDG-09	KS-B22G
184	IDG-10	KS-B22RD
185	IDG-11	KS-B80
186	IDG-12	KS-B22G
187	IDG-13	KS-B22
188	IDG-14	KS-R22S2
189	IDG-15	KS-R80D
190	IDG-16	KS-B80PB
191	IDM-01	IM-Series
192	IDM-02	IM-6125
193	IDM-03	IM-6125
194	IDT-01	QTN150-2
195	IDT-02	QTN150-2
196	IDT-03	QSM150S
197	IDT-04	QSM150S
198	IDT-05	QT150SG(U300)
199	IDT-06	QT150SG(U300)
200	IFT-01	MS-50A
201	IFT-02	MS-50A
202	IGM-01	KN-113A
203	IGM-02	KN-113A
204	IGM-03	KN-113A
205	IGM-04	KN-113A
206	ISM-01	KS-BS-02
207	KWY-01	IB-1V
208	KWY-02	IB-1V
209	MKM-01	NE-101
210	MKM-02	NE-101
211	MKM-03	MD-V9910WA
212	MLG-01	1MP-H
213	MLG-02	TM-330
214	MLG-03	MH3NCP
215	MLG-04	MH3NCP
216	MLG-05	MH3NCP
217	MLG-06	MH3NCP
218	MNT-01	MPA-520
219	MPA-01	HX400iα
220	MPA-02	HX400iF
221	MPA-03	HX400iα
222	MPA-04	HX400iF
223	MPA-05	HX400iα
224	MPA-06	HX400iF
225	MPA-07	HX400iα
226	MPA-08	HX400iF
227	MPA-09	NSV-1555FE
228	MPA-10	ROBODRILLα-D14MiA
229	MPA-11	VCS530C
230	MPA-12	ROBODRILLα-D14MiA
231	MPA-13	VCS530C
232	MPA-14	HCN4000-Ⅱ
233	MPA-15	ROBODRILLα-D14MiA
234	MPA-16	HCN4000-Ⅲ
235	MPA-17	VT-3A
236	MPA-18	ROBODRILL α-D14MiB
237	MPA-19	HCN4000-Ⅲ
238	MPA-20	HCN4000-Ⅲ
239	MPI-01	JH2614-44-A
240	MT46	LB15
241	MT47	LB15
242	OGM-01	KN-113A
243	OGM-02	KN-113A
244	OGM-03	KN-113A
245	OGM-04	KN-113A
246	OGM-05	KN-113A
247	OVN-01	PH-301
248	OVN-02	PH-2KT
249	OVN-03	PH-201
250	OVN-04	PVH-331
251	OVN-05	PVH-231
252	OVN-06	PVH-331
253	OVN-07	PVH-332
254	OVN-08	PVH-332
255	OVN-09	PVH-332
256	OVN-10	PVH-402
257	OVN-11	PVH-332
258	OVN-12	PVH-332
259	OVN-13	PR-4J
260	OVN-14	PVC-331M
261	OVN-15	PVHC-331
262	PJT-01	302-701E
263	PJT-02	V-24B
264	PJT-03	PJ-A3000
265	PJT-04	PJ-H30
266	PJT-05	V-24B
267	PRS-01	HYP505S
268	PRS-02	TP45EX
269	PRS-03	HYP1000N
270	PRS-04	K1-2500E
271	PST-01	OZT-2
272	PVD-01	N/A
273	PVD-02	N/A
274	RIV-01	FRE-10
275	RLP-01	B12V
276	RLP-02	B12V
277	RLP-03	B12V
278	RLP-04	JD-1
279	RLP-05	JD-1
280	RLP-06	JD-1
281	RLP-07	JD-1
282	RLP-08	MB-38SY
283	RLP-09	JD-1
284	RLP-10	JD-1
285	RLP-11	JD-1
286	RLP-12	JD-1
287	RLP-13	B20V
288	RLP-B1	B0385L
289	RLS-01	TP-SW-03
290	RLS-02	AUTO RELEASE
291	RLS-03	G10-1-BR
292	RLS-04	AUTO RELEASE
293	RLS-05	CPRS-3
294	RLS-06	CPRS-6
295	RLS-07	SKTBR-1
296	RMH-01	HWBV-2V
297	RMH-02	VOB-121830
298	RMH-03	VMH-T-121830
299	RMH-04	LN-650-R/T
300	RMH-05	TF-121830
301	RMH-06	-
302	RMH-07	NVPT-180PT
303	RMH-08	LN-650-DH-ROD
304	RMH-09	RPOS-650-DH-ROD No.1
305	RMH-10	VOB-161624
306	RMH-11	HWBV-2V
307	RMH-12	VOB-121830
308	RMH-13	VMH-T-121830
309	RMH-14	RPOS-650-DH-ROD　No.2
310	RMH-15	VMH-T-121830
311	RMH-16	GQ-52/43/83
312	RNM-02	-
313	RNM-03	Surtronic S100
314	RNM-04	RA-10
315	RNM-05	Surtronic R80
316	RPC-01	Type D
317	RPC-02	RP011
318	RPC-03	Type D
319	RPC-05	RP MINI No.1
320	RPC-06	MRP-01
321	RPC-07	RP MINI No.2
322	RSM-01	C00
323	SBM-01	SGK-4LDS-401
324	SBM-02	SGK-4S
325	SBM-03	SGK-4LD-401
326	SBM-04	SGK-4LD-401
327	SBM-05	SGK-3LDS-301
328	SBM-06	SBM-06
329	SBM-07	SFK-1S
330	SBT-01	FTL-10I
331	SBT-03	FTL-10I
332	SBT-04	FTL-10I
333	SBT-05	FTL-10I
334	SBT-06	FTL-10I
335	SBT-07	XD-8
336	SBT-08	X-100
337	SBT-09	X-100
338	SBT-10	XC-100
339	SBT-11	XC-100
340	SBT-12	XD-8
341	SBT-13	J-WAVE
342	SBT-14	M08SY
343	SBT-15	M08SY
344	SBT-16	XD-8T
345	SBT-17	J-WAVE
346	SBT-18	M08SJ-Ⅱ
347	SGM-01	PSG-52AN
348	SGM-02	GS-64PF
349	SGM-03	GS-64PF
350	SGM-04	PSG-64DX
351	SPF-01	P01291
352	SPF-02	KS-H70
353	SPF-03	KS-H70
354	SPF-04	MS-50SPF
355	SPF-05	KS-SPN01
356	SPF-06	KS-H22
357	SPF-07	KS-H150
358	SPG-01	KS-400B1
359	SPG-02	KS-400B1
360	SPG-03	KS-400B1
361	SPG-04	KS-400B1
362	SPG-05	KS-400B1
363	SPG-06	KS-400B1
364	SPG-07	KS-400B1
365	SPG-08	HIGRIND-1-D
366	SPG-09	KS-400B1
367	SPG-10	KS-400B1
368	SPG-11	KS-400B5
369	SPG-12	KN-312A
370	SPG-13	KS-400B6
371	SPG-14	KS-400B2
372	SPG-15	KS-400B2
373	SPG-16	KS-500RD
374	SPG-17	KS-400B7
375	SPG-18	KS-400B7
376	SPG-19	KS-350R2
377	SPG-20	KS-500RF
378	STN-01	PAX2
379	STN-02	PAX2
380	STN-03	PAX2
381	STN-04	PAX2
382	STN-05	TNC-L03-SP
383	STN-06	TNC-L03-SP
384	STN-07	TNC-L03-SP
385	STN-08	RL20
386	SWG-01	PRS-30
387	SWG-02	PRS-30
388	SWG-03	PLD-30
389	SWG-04	TP-SW-03
390	SWG-05	PH-150
391	SWG-06	PLD-30
392	SWG-07	PH-2500
393	TDR-01	R16A-Ⅱ
394	TDR-02	R16A-Ⅱ
395	TDR-03	R6A
396	TDR-04	THI-10R
397	TDR-05	R16A
398	TEF-01	-
399	TEF-02	SM200SX-3A-EXT50
400	THB-01	XL-150
401	THB-02	XL-150
402	THB-03	XL-100
403	THB-04	XL-100
404	THB-05	J-WAVE
405	THB-06	J-WAVE
406	THB-07	J-WAVE
407	THB-08	J-WAVE
408	THB-09	XL-150
409	THB-10	ROBODRILL α-D14MiA
410	THB-11	ROBODRILL α-D14MiA
411	THB-12	J-WAVE
412	THB-13	XC-100
413	THB-15	J-WAVE
414	THB-16	J-WAVE
415	THB-17	XL-100
416	THB-18	XL-150
417	TLS-01	Talysurf series 2
418	TLS-02	SJ-210
419	TLS-03	Talysurf series 5
420	TLS-04	SMT-0006
421	TLS-05	Talysurf series 2
422	TLS-06	Surfcom 1400G-14
423	TMM-01	TM-505R
424	TMM-02	MT5513
425	TMM-03	MT5513
426	TNG-01	CN-660-CW
427	TNG-03	LNC-45 C200
428	TNG-04	LNC-45 C200
429	TNG-06	XC-100
430	TNG-07	XC-100
431	TNG-08	XC-100
432	TNG-09	2SI-8
433	TNG-10	2SI-8
434	TNG-11	TF20
435	TNG-11L	TF20
436	TNG-11R	TF20
437	TNG-12	MT-20YMC
438	TNG-15	2SI-8
439	TNG-16	2SI-8
440	TNG-17	2SI-8
441	TNG-21	2SI-6
442	TPG-01	KRT-420
443	TPG-02	KRT-420
444	TPG-03	KTV-1
445	TPG-04	ASD-360
446	TRM-01	KL-20B
447	TRM-02	KL-20B
448	TRM-03	KL-20B
449	TRM-04	KL-20M
450	TRM-05	KL-20
451	TRM-06	KL-20
452	TRM-07	RL20
453	TRM-08	RL20
454	TRM-09	KL-20B
455	TRM-10	KL-20B
456	TRM-11	KL-20B
457	TRQ-01	TM-20NM
458	TRQ-02	TM-20NM
459	TRQ-03	TM-20NM
460	TTM-01	TG-250KN
461	UGM-01	GA-25T
462	UNK001	PS125 ONE STEP
463	UNK003	N/A
464	UNK004	CFMT-01
465	UNK005	N/A
466	UNK006	60-1990
467	UNK007	FSR-10US/RP
468	UNK008	LTS-200N-S100
469	UNK011	FO-1
470	USC-01	ASU-3 (1-2160-02)
471	VSG-01	TSG-300ZNC
472	VSG-02	TSG300W
473	VSG-03	TSG-300ZNC
474	VSG-04	HD3C
475	WCM-01	VL400Q LN2W
476	WSM-01	KS-LW400
477	XRF-01	-
478	XRF-02	VCR-CCC-A3-U
479	XRF-03	VCR-CCC-A3-U
\.


--
-- Data for Name: requests; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.requests (id, "requestItem", "requestNo", status, "currentStage", department, "workCenter", "workCenterName", requester, "requesterEmail", "typeOfRequest", category, "drawingRequired", "typeOfDrawing", title, detail, "machineNo", "machineName", "reqDueDate", "createdAt", "updatedAt", attachments) FROM stdin;
1	ITEM-20260119-001	12222	Completed & Informed	Done	Quality Control	WC-13	WC-13	Thapanon	thapanon.p@minebea.co.th	3D Print	Machine part	Without Drawing	N/A	Test01 3D print without drawing	Check system	Office	PLBMP118	2026-02-02 21:00:24.253	2026-01-19 21:00:24.253	2026-03-22 15:33:50.109	https://drive.google.com/file/d/1g-R_wI75_0bsQK8AoPuy5w8NrwVCiyTw/view?usp=drivesdk
2	ITEM-20260120-001	25G9999	Completed & Informed	Done	Engineer	WC-96	WC-96	Thapanon	thapanon.p@minebea.co.th	3D Print	Machine part	Without Drawing	N/A	Test2	Recheck1	PLBMP118	Office	2026-02-03 18:24:37.12	2026-01-20 18:24:37.12	2026-03-22 15:33:50.129	https://drive.google.com/file/d/1GzLtTjNPsrnM_F18RoEA0QBDOfHtsTUu/view?usp=drivesdk
3	ITEM-20260120-002	25G99999	Completed & Informed	Done	Engineer	WC-00	WC-00	Thapanon	thapanon.p@minebea.co.th	Draft Drawing	Machine part	N/A	Copy Drawing	Test3	Check form	PLBMP118	Office	2026-01-29 21:28:32.238	2026-01-20 21:28:32.238	2026-03-22 15:33:50.137	https://drive.google.com/file/d/13BpT4fRgg1gn-bDh6WlvNDqEpeG2Zlos/view?usp=drivesdk
4	ITEM-20260120-003	25G000	Completed & Informed	Done	Engineer	WC-00	WC-00	Thapanon	thapanon.p@minebea.co.th	Regist Drawing	Gauge	N/A	N/A	Test4	Check folder to keep file	PLBMP118	Office	2026-01-27 21:52:34.177	2026-01-20 21:52:34.177	2026-03-22 15:33:50.142	https://drive.google.com/file/d/1UKyDh8EcDzVJ8eisy5f_667unmapPq8o/view?usp=drivesdk
5	ITEM-20260120-004	25G111	Completed & Informed	Done	Engineer	WC-00	WC-00	Thapanon	thapanon.p@minebea.co.th	Draft Drawing	Gauge	N/A	New Design	Test5	Check form approve	PLBMP118	Office	2026-01-30 02:03:21.733	2026-01-21 02:03:21.733	2026-03-22 15:33:50.147	https://drive.google.com/file/d/18uNhvvVVYB97O1KU-4cGDajbNfJ6ne13/view?usp=drivesdk
6	ITEM-20260121-001	25G0401	Completed & Informed	Done	Engineer	WC-30	WC-30	Thapanon	thapanon.p@minebea.co.th	3D Print	Machine part	Without Drawing	N/A	Chute part feeder	Use for support stocker feeder size OD 16.662 Width 10.31	IDG-01	KS-B22RD	2026-02-04 14:49:31.295	2026-01-21 14:49:31.295	2026-03-22 15:33:50.152	https://drive.google.com/file/d/1jqOkrWLcFvnovvHr8lJVrUsCp3f2G5Hc/view?usp=drivesdk
7	ITEM-20260121-002	25G0402	Completed & Informed	Done	Engineer	WC-00	WC-00	Thapanon	thapanon.p@minebea.co.th	Draft Drawing	Machine part	N/A	Copy Drawing	Test draftsman	Check form	PLBMP118	Office	2026-01-30 17:54:34.61	2026-01-21 17:54:34.61	2026-03-22 15:33:50.158	https://drive.google.com/file/d/1mQhO_F3HaDDB_kQP4rUFLa0MmhadJcaW/view?usp=drivesdk
8	ITEM-20260121-003	25G0403	Completed & Informed	Done	Engineer	WC-00	WC-00	Thapanon	thapanon.p@minebea.co.th	Regist Drawing	Machine part	N/A	N/A	Final	Test	PLBMP118	Office	2026-01-28 18:15:26.116	2026-01-21 18:15:26.116	2026-03-22 15:33:50.162	https://drive.google.com/file/d/15ZnZdwnv2zlXaVQpyKH_DGi_-ksVRJeu/view?usp=drivesdk
9	ITEM-20260121-004	25G0404	Completed & Informed	Done	Engineer	WC-00	WC-00	Thapanon	thapanon.p@minebea.co.th	Regist Drawing	Machine part	N/A	N/A	Last	Review	PLBMP118	Office	2026-01-28 23:14:22.975	2026-01-21 23:14:22.975	2026-03-22 15:33:50.167	https://drive.google.com/file/d/1F6Nha1B6TwVSVWDVr4xv7tHU0_vQjevh/view?usp=drivesdk
10	ITEM-20260121-005	25G0406	Completed & Informed	Done	Engineer	WC-00	WC-00	Thapanon	thapanon.p@minebea.co.th	3D Print	Machine part	With Drawing	Copy Drawing	Test of last	End of day	PLBMP118	Office	2026-02-04 23:39:29.354	2026-01-21 23:39:29.354	2026-03-22 15:33:50.172	https://drive.google.com/file/d/1CpJ8Jd_-anAVU84TnxHZyKpkdcVMHt4A/view?usp=drivesdk
\.


--
-- Data for Name: tracking; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.tracking (id, "requestId", "createdAt", "engCheckAt", "draftManAt", "dwgCheckAt", "engReviewAt", "engApproveAt", "engInformAt", "completedAt", "engCheckDays", "draftManDays", "dwgCheckDays", "engReviewDays", "engApproveDays", "totalDays", status, "onTime") FROM stdin;
1	1	2026-01-19 21:00:24.253	2026-01-19 21:03:49.994	2026-01-19 21:11:30.945	2026-01-19 21:18:09.454	2026-01-19 21:22:01.492	2026-01-19 21:25:46.492	2026-01-19 21:28:22.789	2026-01-19 21:28:22.789	1	1	1	1	1	1	Completed	t
2	2	2026-01-20 18:24:37.12	2026-01-20 18:25:51.035	2026-01-20 18:27:00.869	2026-01-20 18:30:46.448	2026-01-20 18:39:53.925	2026-01-20 18:42:26.278	2026-01-20 19:56:03.484	2026-01-20 19:56:03.484	1	1	1	1	1	1	Completed	t
3	3	2026-01-20 21:28:32.238	2026-01-20 21:29:40.622	2026-01-20 21:30:48.653	2026-01-20 21:31:31.818	2026-01-20 21:34:15.201	2026-01-20 21:36:02.032	2026-01-20 21:37:14.699	2026-01-20 21:37:14.699	1	1	1	1	1	1	Completed	t
4	4	2026-01-20 21:52:34.177	2026-01-20 21:53:12.582	2026-01-20 21:54:04.648	2026-01-20 21:55:33.688	2026-01-20 21:58:20.232	2026-01-20 21:58:50.775	2026-01-20 22:00:57.965	2026-01-20 22:00:57.965	1	1	1	1	1	1	Completed	t
5	5	2026-01-21 02:03:21.733	2026-01-21 02:04:04.481	2026-01-21 02:04:44.275	2026-01-21 02:05:09.462	2026-01-21 02:06:07.997	2026-01-21 02:06:51.831	2026-01-21 02:46:08.953	2026-01-21 02:46:08.953	1	1	1	1	1	1	Completed	t
6	6	2026-01-21 14:49:31.295	2026-01-21 14:52:51.873	2026-01-21 14:53:58.098	2026-01-21 14:55:01.122	2026-01-21 14:59:09.266	2026-01-21 15:02:52.42	2026-01-21 15:04:24.13	2026-01-21 15:04:24.13	1	1	1	1	1	1	Completed	t
7	7	2026-01-21 17:54:34.61	2026-01-21 17:55:02.221	2026-01-21 17:55:42.653	2026-01-21 17:56:45.478	2026-01-21 18:01:52.256	2026-01-21 18:03:01.243	2026-01-21 18:06:14.988	2026-01-21 18:06:14.988	1	1	1	1	1	1	Completed	t
8	8	2026-01-21 18:15:26.116	2026-01-21 18:15:51.18	2026-01-21 18:16:38.252	2026-01-21 18:17:31.766	2026-01-21 18:19:44.411	2026-01-21 18:20:33.826	2026-01-21 22:03:44.448	2026-01-21 22:03:44.448	1	1	1	1	1	1	Completed	t
9	9	2026-01-21 23:14:22.975	2026-01-21 23:15:40.251	2026-01-21 23:16:35.671	2026-01-21 23:17:36.359	2026-01-21 23:18:49.982	2026-01-21 23:19:49.417	2026-01-21 23:28:51.729	2026-01-21 23:28:51.729	1	1	1	1	1	1	Completed	t
10	10	2026-01-21 23:39:29.354	2026-01-21 23:40:14.804	2026-01-21 23:41:02.776	2026-01-21 23:41:23.783	2026-01-21 23:42:42.115	2026-01-21 23:43:15.833	2026-01-21 23:43:51.278	2026-01-21 23:43:51.278	1	1	1	1	1	1	Completed	t
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.users (id, email, password, name, role, department, "isActive", "createdAt", "updatedAt", empno, auth, section) FROM stdin;
2	admin@example.com	$2a$10$d/Dmw9fZWG2dcuoTT00aceR.0z2Fv4eK2o2No/FwcOGfQlt/ITt0q	Admin User	admin	\N	t	2026-03-22 14:39:26.016	2026-03-22 14:39:26.016	ADMIN	1	\N
3	engineer@example.com	$2a$10$d/Dmw9fZWG2dcuoTT00aceR.0z2Fv4eK2o2No/FwcOGfQlt/ITt0q	Engineer User	engineer	\N	t	2026-03-22 14:39:26.025	2026-03-22 14:39:26.025	ENGINEER	4	\N
4	draftman@example.com	$2a$10$d/Dmw9fZWG2dcuoTT00aceR.0z2Fv4eK2o2No/FwcOGfQlt/ITt0q	Draftman User	draftman	\N	t	2026-03-22 14:39:26.026	2026-03-22 14:39:26.026	DRAFTMAN	4	\N
5	reviewer@example.com	$2a$10$d/Dmw9fZWG2dcuoTT00aceR.0z2Fv4eK2o2No/FwcOGfQlt/ITt0q	Reviewer User	reviewer	\N	t	2026-03-22 14:39:26.027	2026-03-22 14:39:26.027	REVIEWER	4	\N
6	approver@example.com	$2a$10$d/Dmw9fZWG2dcuoTT00aceR.0z2Fv4eK2o2No/FwcOGfQlt/ITt0q	Approver User	approver	\N	t	2026-03-22 14:39:26.028	2026-03-22 14:39:26.028	APPROVER	4	\N
7	requester@example.com	$2a$10$d/Dmw9fZWG2dcuoTT00aceR.0z2Fv4eK2o2No/FwcOGfQlt/ITt0q	Requester User	requester	\N	t	2026-03-22 14:39:26.029	2026-03-22 14:39:26.029	REQUESTE	4	\N
9	\N	\N	Engineer Test	requester	\N	t	2026-03-22 14:41:36.768	2026-03-22 14:41:36.768	ENG001	1	\N
\.


--
-- Data for Name: work_centers; Type: TABLE DATA; Schema: public; Owner: engreq
--

COPY public.work_centers (id, code, name, department) FROM stdin;
1	WC001	Work Center 001	ROD
2	WC002	Work Center 002	ROD
3	WC003	Work Center 003	SPG
4	WC004	Work Center 004	IDG
5	WC-00	WC-00	Thai Staff / Clerk / Office /Common
6	WC-01	WC-01	Machining Center
7	WC-02	WC-02	Recipro Turning
8	WC-03	WC-03	Header, Press
9	WC-04	WC-04	Bolt Turning
10	WC-05	WC-05	Barfeeder
11	WC-06	WC-06	Six Spindle
12	WC-07	WC-07	Heat Treatment, Stress Relief , Carburizing
13	WC-08	WC-08	Recipro Grinding
14	WC-09	WC-09	Face Grinding
15	WC-10	WC-10	Bolt Burnishing, Grinding, Thread Roll
16	WC-11	WC-11	Dry Film
17	WC-12	WC-12	Passivation
18	WC-13	WC-13	Quality Control
19	WC-14	WC-14	Quality Assurance
20	WC-15	WC-15	Oil & Chemical
21	WC-16	WC-16	Tumble
22	WC-17	WC-17	Packing
23	WC-18	WC-18	Chucker
24	WC-19	WC-19	Teflon Bonding
25	WC-20	WC-20	Sand Blast
26	WC-21	WC-21	2nd Turning
27	WC-22	WC-22	Roller Pin
28	WC-23	WC-23	Cutting
29	WC-24	WC-24	Blank-Blank Head
30	WC-25	WC-25	Milling
31	WC-26	WC-26	X-Hole
32	WC-27	WC-27	Shank Grind / Thread Roll / Key Way /Screw Check
33	WC-28	WC-28	Recipro Assembly
34	WC-29	WC-29	SPH Grinding
35	WC-30	WC-30	ID Grinding
36	WC-31	WC-31	Super Finish
37	WC-32	WC-32	Surface Grinding
38	WC-33	WC-33	Trim
39	WC-34	WC-34	Swage
40	WC-35	WC-35	SPH BRG Turn
41	WC-36	WC-36	Release
42	WC-37	WC-37	Centerless
43	WC-38	WC-38	TRQ Select
44	WC-39	WC-39	3-pcs Assy
45	WC-40	WC-40	Marking
46	WC-41	WC-41	Roller Grinding
47	WC-42	WC-42	S.T.E. (Surface Temper Etch)
48	WC-96	WC-96	Engineer
49	WC-97	WC-97	FIX ASSET(M/C,QC EQUIPMENT)
50	WC-98	WC-98	Outside Process
51	WC-99	WC-99	Special Order
\.


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.departments_id_seq', 14, true);


--
-- Name: draft_man_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.draft_man_id_seq', 10, true);


--
-- Name: due_days_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.due_days_config_id_seq', 6, true);


--
-- Name: dwg_check_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.dwg_check_id_seq', 10, true);


--
-- Name: email_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.email_config_id_seq', 25, true);


--
-- Name: eng_approve_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.eng_approve_id_seq', 10, true);


--
-- Name: eng_check_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.eng_check_id_seq', 10, true);


--
-- Name: eng_inform_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.eng_inform_id_seq', 10, true);


--
-- Name: eng_review_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.eng_review_id_seq', 10, true);


--
-- Name: holidays_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.holidays_id_seq', 208, true);


--
-- Name: machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.machines_id_seq', 479, true);


--
-- Name: requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.requests_id_seq', 10, true);


--
-- Name: tracking_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.tracking_id_seq', 10, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.users_id_seq', 9, true);


--
-- Name: work_centers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: engreq
--

SELECT pg_catalog.setval('public.work_centers_id_seq', 51, true);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: draft_man draft_man_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.draft_man
    ADD CONSTRAINT draft_man_pkey PRIMARY KEY (id);


--
-- Name: due_days_config due_days_config_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.due_days_config
    ADD CONSTRAINT due_days_config_pkey PRIMARY KEY (id);


--
-- Name: dwg_check dwg_check_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.dwg_check
    ADD CONSTRAINT dwg_check_pkey PRIMARY KEY (id);


--
-- Name: email_config email_config_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.email_config
    ADD CONSTRAINT email_config_pkey PRIMARY KEY (id);


--
-- Name: eng_approve eng_approve_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.eng_approve
    ADD CONSTRAINT eng_approve_pkey PRIMARY KEY (id);


--
-- Name: eng_check eng_check_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.eng_check
    ADD CONSTRAINT eng_check_pkey PRIMARY KEY (id);


--
-- Name: eng_inform eng_inform_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.eng_inform
    ADD CONSTRAINT eng_inform_pkey PRIMARY KEY (id);


--
-- Name: eng_review eng_review_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.eng_review
    ADD CONSTRAINT eng_review_pkey PRIMARY KEY (id);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);


--
-- Name: tracking tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.tracking
    ADD CONSTRAINT tracking_pkey PRIMARY KEY (id);


--
-- Name: users users_empno_unique; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_empno_unique UNIQUE (empno);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: work_centers work_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.work_centers
    ADD CONSTRAINT work_centers_pkey PRIMARY KEY (id);


--
-- Name: departments_name_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX departments_name_key ON public.departments USING btree (name);


--
-- Name: draft_man_requestId_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX "draft_man_requestId_key" ON public.draft_man USING btree ("requestId");


--
-- Name: due_days_config_requestType_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX "due_days_config_requestType_key" ON public.due_days_config USING btree ("requestType");


--
-- Name: dwg_check_requestId_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX "dwg_check_requestId_key" ON public.dwg_check USING btree ("requestId");


--
-- Name: email_config_stage_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX email_config_stage_key ON public.email_config USING btree (stage);


--
-- Name: eng_approve_requestId_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX "eng_approve_requestId_key" ON public.eng_approve USING btree ("requestId");


--
-- Name: eng_check_requestId_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX "eng_check_requestId_key" ON public.eng_check USING btree ("requestId");


--
-- Name: eng_inform_requestId_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX "eng_inform_requestId_key" ON public.eng_inform USING btree ("requestId");


--
-- Name: eng_review_requestId_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX "eng_review_requestId_key" ON public.eng_review USING btree ("requestId");


--
-- Name: holidays_date_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX holidays_date_key ON public.holidays USING btree (date);


--
-- Name: machines_code_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX machines_code_key ON public.machines USING btree (code);


--
-- Name: requests_createdAt_idx; Type: INDEX; Schema: public; Owner: engreq
--

CREATE INDEX "requests_createdAt_idx" ON public.requests USING btree ("createdAt");


--
-- Name: requests_currentStage_idx; Type: INDEX; Schema: public; Owner: engreq
--

CREATE INDEX "requests_currentStage_idx" ON public.requests USING btree ("currentStage");


--
-- Name: requests_requestItem_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX "requests_requestItem_key" ON public.requests USING btree ("requestItem");


--
-- Name: requests_status_idx; Type: INDEX; Schema: public; Owner: engreq
--

CREATE INDEX requests_status_idx ON public.requests USING btree (status);


--
-- Name: tracking_requestId_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX "tracking_requestId_key" ON public.tracking USING btree ("requestId");


--
-- Name: tracking_status_idx; Type: INDEX; Schema: public; Owner: engreq
--

CREATE INDEX tracking_status_idx ON public.tracking USING btree (status);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: work_centers_code_key; Type: INDEX; Schema: public; Owner: engreq
--

CREATE UNIQUE INDEX work_centers_code_key ON public.work_centers USING btree (code);


--
-- Name: draft_man draft_man_requestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.draft_man
    ADD CONSTRAINT "draft_man_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES public.requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: dwg_check dwg_check_requestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.dwg_check
    ADD CONSTRAINT "dwg_check_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES public.requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: eng_approve eng_approve_requestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.eng_approve
    ADD CONSTRAINT "eng_approve_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES public.requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: eng_check eng_check_requestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.eng_check
    ADD CONSTRAINT "eng_check_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES public.requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: eng_inform eng_inform_requestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.eng_inform
    ADD CONSTRAINT "eng_inform_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES public.requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: eng_review eng_review_requestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.eng_review
    ADD CONSTRAINT "eng_review_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES public.requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tracking tracking_requestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: engreq
--

ALTER TABLE ONLY public.tracking
    ADD CONSTRAINT "tracking_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES public.requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO engreq;


--
-- PostgreSQL database dump complete
--

\unrestrict pX0AoaKDzri5splz2QOZfUcUq3yDSaJiZ0B51IgHodTTROU5YjNfI7oDnpNfPYD


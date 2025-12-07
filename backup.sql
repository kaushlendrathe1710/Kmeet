--
-- PostgreSQL database dump
--

\restrict T2SRzf0tdy0xCQLblTcpvsccmAbLYM8N9tmHqKADVLvOz7Z74jKFItpRH3kXtUE

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
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
-- Name: meeting_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_history (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    room_id text NOT NULL,
    room_name text,
    was_host boolean DEFAULT false NOT NULL,
    joined_at timestamp without time zone DEFAULT now() NOT NULL,
    left_at timestamp without time zone,
    duration integer
);


--
-- Name: otp_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_tokens (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    otp text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: recordings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recordings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    room_id text NOT NULL,
    room_name text,
    file_name text NOT NULL,
    s3_key text NOT NULL,
    s3_url text NOT NULL,
    file_size integer NOT NULL,
    duration integer NOT NULL,
    format text DEFAULT 'webm'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_agent text,
    ip_address text
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    price integer NOT NULL,
    duration_days integer NOT NULL,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    max_recording_minutes integer DEFAULT 0 NOT NULL,
    max_participants integer DEFAULT 10 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    plan_id character varying NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    start_date timestamp without time zone DEFAULT now() NOT NULL,
    end_date timestamp without time zone NOT NULL,
    recording_minutes_used integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    full_name text,
    mobile text,
    role text DEFAULT 'user'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    last_login_at timestamp without time zone
);


--
-- Data for Name: meeting_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.meeting_history (id, user_id, room_id, room_name, was_host, joined_at, left_at, duration) FROM stdin;
\.


--
-- Data for Name: otp_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.otp_tokens (id, email, otp, expires_at, is_used, created_at) FROM stdin;
cddba823-094e-4b07-b7d0-12b387ff8d53	kumaracheles1@gmail.com	757506	2025-12-07 07:21:57.567	t	2025-12-07 07:11:57.586765
3380f1de-d841-4ea0-8bea-acef32271ff3	kaushlendra.k12@fms.edu	319443	2025-12-07 07:23:06.86	t	2025-12-07 07:13:06.870719
\.


--
-- Data for Name: recordings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recordings (id, user_id, room_id, room_name, file_name, s3_key, s3_url, file_size, duration, format, created_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, token, expires_at, created_at, user_agent, ip_address) FROM stdin;
0d7eecef-d5be-4c81-b48f-e0378952d8a8	1306defd-0419-4afb-be1e-e32156e43715	4c35f02774d297b2f596631e96ca054eb8932819879e842070434ce45f2e41f9	2026-01-06 07:13:27.643	2025-12-07 07:13:27.644273	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	172.31.98.34
\.


--
-- Data for Name: subscription_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscription_plans (id, name, description, price, duration_days, features, max_recording_minutes, max_participants, is_active, created_at) FROM stdin;
c4463af2-4f22-4e40-af3b-c8df224e8369	Basic	Free plan with limited features	0	30	["limitedAnimatedBackgrounds"]	0	10	t	2025-12-07 07:58:29.39791
2fa814a0-3934-47f4-8633-da097850b903	Pro	Professional plan with full features	2100	30	["animatedBackgrounds", "videoBackgrounds", "premiumBackgrounds", "recording", "cloudStorage", "noWatermark", "prioritySupport"]	600	50	t	2025-12-07 07:58:29.39791
729cd78f-9578-444a-8681-b86860e67573	Enterprise	Enterprise plan with maximum features	9900	30	["animatedBackgrounds", "videoBackgrounds", "premiumBackgrounds", "recording", "cloudStorage", "noWatermark", "prioritySupport", "customBranding", "analytics", "apiAccess", "dedicatedSupport"]	6000	100	t	2025-12-07 07:58:29.39791
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscriptions (id, user_id, plan_id, status, start_date, end_date, recording_minutes_used, created_at) FROM stdin;
721aab13-327b-4f47-939c-cbe28ff93512	1306defd-0419-4afb-be1e-e32156e43715	2fa814a0-3934-47f4-8633-da097850b903	active	2025-12-07 08:40:20.67656	2026-01-06 08:40:20.67656	0	2025-12-07 08:40:20.67656
f4bc9b9a-b0ed-443b-a62e-ffaed137159a	6899dee1-43eb-4480-9fb8-89d37ee56ba4	2fa814a0-3934-47f4-8633-da097850b903	active	2025-12-07 08:45:24.379498	2026-01-06 08:45:24.379498	0	2025-12-07 08:45:24.379498
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, full_name, mobile, role, is_active, created_at, last_login_at) FROM stdin;
6899dee1-43eb-4480-9fb8-89d37ee56ba4	kumaracheles1@gmail.com	\N	\N	user	t	2025-12-07 07:12:13.715171	2025-12-07 07:12:13.72
1306defd-0419-4afb-be1e-e32156e43715	kaushlendra.k12@fms.edu	\N	\N	superadmin	t	2025-12-07 07:13:27.638996	2025-12-07 07:13:27.641
\.


--
-- Name: meeting_history meeting_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_history
    ADD CONSTRAINT meeting_history_pkey PRIMARY KEY (id);


--
-- Name: otp_tokens otp_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_tokens
    ADD CONSTRAINT otp_tokens_pkey PRIMARY KEY (id);


--
-- Name: recordings recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_unique UNIQUE (token);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: meeting_history meeting_history_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_history
    ADD CONSTRAINT meeting_history_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recordings recordings_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_subscription_plans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_subscription_plans_id_fk FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: subscriptions subscriptions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict T2SRzf0tdy0xCQLblTcpvsccmAbLYM8N9tmHqKADVLvOz7Z74jKFItpRH3kXtUE


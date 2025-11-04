# PodcastMeet - Professional Video Conferencing Platform

## Overview

PodcastMeet is a professional video conferencing platform designed for podcast recording, offering high-quality audio and video, advanced features like noise suppression, screen sharing, and local recording. It aims to provide a broadcast-quality interface optimized for long-form podcast sessions, drawing inspiration from Google Meet, Zoom, and Riverside.fm. The project seeks to create a leading platform for professional podcast production.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend uses React with TypeScript, Vite for building, and Wouter for routing. UI components are built with Shadcn UI on Radix UI primitives, styled with Tailwind CSS, following a "New York" aesthetic with a neutral color scheme and Inter/JetBrains Mono fonts. State management uses local React state, TanStack Query for server data, and WebSocket for real-time communication. The design prioritizes full viewport layout, a responsive grid, and persistent critical controls for a professional broadcast-quality experience.

### Backend Architecture

The backend is built with Express.js and native Node.js for WebSocket support, all in TypeScript. Real-time communication uses a WebSocket server (`ws` library) for signaling and WebRTC peer-to-peer connections via SimplePeer, leveraging Google STUN servers for NAT traversal. Data is primarily stored in-memory using a `MemStorage` class, though an `IStorage` interface supports future PostgreSQL integration with Drizzle ORM. Session management is session-based, with client-side participant ID generation and LocalStorage for persisting participant names.

### Real-Time Features

PodcastMeet implements WebRTC for peer-to-peer video/audio streaming and screen sharing. It includes an audio processing pipeline with Web Audio API for gain control, dynamic compression, and noise suppression, alongside video enhancements via CSS filters. WebSocket message types handle room joining, participant status, WebRTC signaling, chat, and media state updates. Client-side recording uses RecordRTC for WebM (VP9 codec) at high bitrates, with local download.

### Core Features & Implementations

Key features include host controls (remove participant, mute all, transfer host, lock room), comprehensive keyboard shortcuts, hand raising, emoji reactions, recording countdown, hide self-view, individual track recording, audio level meters, active speaker detection, network quality indicators, grid/speaker view toggle, pin participant, recording pause/resume, reconnection handling with exponential backoff, packet loss display, bandwidth adaptation, quality presets (Podcast, Interview, Quick Call), auto-save/recovery, background blur (TensorFlow.js BodyPix), virtual backgrounds, beauty filters, and file upload/download.

## External Dependencies

### Third-Party Services
- Google Fonts CDN (Inter, JetBrains Mono)
- Google STUN servers

### Key Libraries
- **WebRTC**: `simple-peer`, `recordrtc`
- **Real-time**: `ws` (WebSocket server)
- **UI Framework**: React, Radix UI, Shadcn UI
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Form Handling**: React Hook Form, Zod
- **Build Tools**: Vite, esbuild, TypeScript
- **Database**: Drizzle ORM, `@neondatabase/serverless` (PostgreSQL support)
- **AI/ML**: TensorFlow.js (for background blur)
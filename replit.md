# PodcastMeet - Professional Video Conferencing Platform

## Overview

PodcastMeet is a professional video conferencing platform designed for high-quality, broadcast-level podcast recording. It offers advanced audio/video features like noise suppression, screen sharing, and individual local track recording, inspired by leading platforms such as Google Meet, Zoom, and Riverside.fm. The project aims to be a premier tool for professional podcast production.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React, TypeScript, Vite, and Wouter for routing. It uses Shadcn UI on Radix UI primitives, styled with Tailwind CSS, following a "New York" aesthetic with a neutral color scheme and Inter/JetBrains Mono fonts. State management is handled by local React state, TanStack Query for server data, and WebSockets for real-time communication. The design emphasizes a full viewport layout, responsive grid, and persistent critical controls for a professional user experience.

### Backend Architecture

The backend utilizes Express.js and native Node.js for WebSocket support, all written in TypeScript. Real-time communication is managed by a WebSocket server for signaling and WebRTC peer-to-peer connections via SimplePeer, leveraging Google STUN servers and Cloudflare/self-hosted TURN servers for NAT traversal. Data is primarily stored in-memory using `MemStorage`, with an `IStorage` interface for future PostgreSQL integration via Drizzle ORM. Session management is session-based, using client-side participant ID generation and LocalStorage for name persistence.

### Real-Time Features

PodcastMeet implements WebRTC for peer-to-peer video/audio streaming and screen sharing. It includes an audio processing pipeline (Web Audio API for gain, compression, noise suppression) and video enhancements (CSS filters, background blur via TensorFlow.js BodyPix). WebSocket message types handle room events, WebRTC signaling, chat, and media state updates. Client-side recording uses RecordRTC for high-bitrate WebM (VP9) with local download.

### Core Features

Key features include: Host controls (remove, mute all, transfer host, lock room), Individual track recording (WebM/WAV, 48kHz, auto-naming), communication tools (hand raising, emojis, chat, file sharing), media controls (audio/video toggle, screen sharing with dual modes: "screen-only" and "screen-and-camera"), network quality adaptation (reconnection handling, packet loss display, bandwidth adaptation, quality presets), visual enhancements (background blur, virtual backgrounds, beauty filters), and UX features (hide self-view, audio meters, active speaker detection, grid/speaker view, pin participant, auto-save/recovery).

## External Dependencies

### Third-Party Services

- Google Fonts CDN (Inter, JetBrains Mono)
- Google STUN servers (stun.l.google.com:19302, stun1.l.google.com:19302)
- Cloudflare TURN servers (speed.cloudflare.com/turn-creds)
- Self-hosted Coturn TURN server on AWS EC2

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
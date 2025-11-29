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

Key features include:
- **Host Controls**: Remove participant, mute all, transfer host, lock room
- **Recording Features**: Individual track recording, pause/resume, countdown, WebM/WAV format selection
- **Communication**: Hand raising, emoji reactions, chat messaging, file sharing (5MB limit)
- **Media Controls**: Audio/video toggle, screen sharing with ref-based reentrancy prevention
- **Network & Quality**: Reconnection handling (exponential backoff), packet loss display, bandwidth adaptation, quality presets (Podcast, Interview, Quick Call)
- **Visual Enhancements**: Background blur (TensorFlow.js BodyPix), virtual backgrounds, beauty filters
- **UX Features**: Hide self-view, audio level meters, active speaker detection, network quality indicators, grid/speaker view toggle, pin participant, auto-save/recovery

## Recording System

### Individual Track Recording
- Records each participant's audio separately for professional podcast editing
- Supports WebM (default) and WAV formats
- 48kHz audio sample rate for broadcast quality
- Automatic file naming with timestamps and participant names

### Recording Controls
- **Start/Stop**: Record button with 3-second countdown
- **Pause/Resume**: Pause recording without losing progress
- **Cancel Countdown**: Press 'Escape' to abort countdown
- **Format Selection**: Switch between WebM and WAV

### Recording Workflow
1. Click record button → 3-second countdown begins
2. Recording starts → all participants recorded on separate tracks
3. Optional: Pause/resume during session
4. Click stop → all tracks automatically download
5. Files named: `YYYY-MM-DD_HH-MM_ParticipantName.webm`

### Dynamic Participant Handling
- Participants joining mid-recording are automatically included
- Departing participants' tracks saved up to their leave time
- No data loss when participants come and go

## Screen Sharing Implementation

### Features
- High-quality screen capture (1920x1080, 30fps)
- System audio capture included
- Real-time broadcasting to all participants
- Keyboard shortcut: 's' key

### State Management
- Ref-based state tracking prevents duplicate notifications
- Proper cleanup order prevents reentrancy issues
- Handles both manual and browser-initiated stops

### Notifications
- "Screen Sharing Started" when beginning
- Context-aware stop messages (manual vs browser-initiated)
- Toast notifications for all state changes

## External Dependencies

### Third-Party Services
- Google Fonts CDN (Inter, JetBrains Mono)
- Google STUN servers (ice.google.com:19302, ice1.google.com:19302)

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

## Environment Configuration

### Required Variables
- `SESSION_SECRET`: Secure random string for session cookie signing
  - Generate with: `openssl rand -base64 32`
  - **IMPORTANT**: Use a strong, unique value in production

### Automatic Variables (Do Not Modify)
- `PORT`: Automatically set by Replit (default: 5000)
- `NODE_ENV`: Set to 'development' by npm run dev

## Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set Environment Variables**:
   - Copy `.env.example` to `.env`
   - Generate and set `SESSION_SECRET`

3. **Run Development Server**:
   ```bash
   npm run dev
   ```
   - Frontend: Vite dev server
   - Backend: Express server with WebSocket support
   - Both run on port 5000

## Project Structure

```
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/            # Page components (Home, Room)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utility libraries
│   │   └── App.tsx           # Main app component
├── server/                    # Backend Express application
│   ├── index.ts              # Server entry point
│   ├── routes.ts             # WebSocket handlers & API routes
│   ├── storage.ts            # In-memory storage implementation
│   └── vite.ts               # Vite integration
├── shared/                    # Shared types between client/server
│   └── schema.ts             # TypeScript types & Zod schemas
└── .env.example              # Environment variable template
```

## Media Controls Implementation

### Camera Toggle (toggleVideo) - Google Meet/Zoom Style
- **Turn OFF**: Uses `track.stop()` to completely release camera hardware (LED turns OFF)
  - Removes tracks from all streams: `localStream`, `processedStream`, `backgroundProcessedStream`
  - Clears background processed stream
- **Turn ON**: Uses `getUserMedia()` to request fresh camera access
  - Creates new MediaStream objects to trigger React re-render
  - Replaces tracks in all peer connections via `sender.replaceTrack()`
  - Camera LED turns back ON
- Broadcasts "toggle-video" WebSocket message to all participants
### Microphone Toggle (toggleAudio) - Google Meet/Zoom Style
- **Turn OFF**: Uses `track.stop()` to completely release microphone hardware
  - Removes tracks from: `localStream`, `processedStream`
- **Turn ON**: Uses `getUserMedia()` to request fresh microphone access
  - Processes audio through MediaProcessor for noise suppression/enhancement
  - Creates new MediaStream objects to trigger React re-render
  - Replaces tracks in all peer connections via `sender.replaceTrack()`
- Broadcasts "toggle-audio" WebSocket message to all participants

### Multi-Participant Sync
- WebSocket broadcasts ensure all participants see media state changes
- Peer connection senders are updated via `sender.replaceTrack()` for immediate effect on remote views
- New MediaStream objects trigger React re-renders for proper video element updates
- State sync typically completes within 1-2 seconds

## Recent Changes

### November 29, 2025 (Latest)
- **Camera/Mic Toggle Rewrite**: Now works exactly like Google Meet and Zoom
  - OFF: `track.stop()` releases hardware (camera LED turns off)
  - ON: `getUserMedia()` requests fresh access (camera LED turns on)
  - New MediaStream objects ensure React re-renders properly
  - Peer connection track replacement for multi-participant sync
- **Host Auto-Promotion**: First person to join an empty room becomes host automatically
- **Stale Participant Cleanup**: Removes disconnected participants when no active host exists

### November 4, 2025
- **Screen Sharing**: Implemented ref-based state tracking to prevent duplicate notifications
- **Reentrancy Guard**: Fixed issue where manual stops triggered both manual and browser handlers
- **State Management**: Proper operation order (ref → state → tracks) ensures clean cleanup
- **Documentation**: Updated environment configuration and API documentation

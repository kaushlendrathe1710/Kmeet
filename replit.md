# PodcastMeet - Professional Video Conferencing Platform

## Overview

PodcastMeet is a professional video conferencing platform specifically designed for podcast recording. The application provides high-quality audio and video capabilities with advanced features like noise suppression, audio enhancement, screen sharing, and local recording. It draws inspiration from Google Meet, Zoom, and Riverside.fm to create a broadcast-quality interface optimized for long-form podcast recording sessions.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (November 4, 2025)

**Fifteen Professional Features Implemented and Verified:**

1. **Remove Active Participant** - Host can remove participants already in the room with server-side authorization
2. **Comprehensive Keyboard Shortcuts** - Full keyboard control (M/V/S/R/C/P/H/F/ESC keys)
3. **Hand Raise Feature** - Participants can signal they want to speak with visual indicators
4. **Emoji Reactions** - Floating emoji animations using CSS keyframes (👍 ❤️ 😂 👏 🎉)
5. **Recording Countdown** - 3-2-1 countdown with full-screen overlay, ESC to cancel
6. **Hide Self-View** - Option to hide local participant from video grid
7. **Mute All Participants** - Host can mute everyone using recoverable track.enabled method
8. **Individual Track Recording** - Each participant's audio recorded as separate downloadable files with dynamic tracking
9. **Audio Level Meters** - Real-time visual bars showing speaking volume using Web Audio API with shared AudioContext
10. **Active Speaker Detection** - Automatic visual highlighting (primary border + shadow) of loudest participant with debouncing
11. **Network Quality Indicators** - Real-time connection strength badges (Excellent/Good/Fair/Poor) based on ping latency
12. **Grid View vs Speaker View** - Toggle between equal-sized grid and active-speaker-focused layout modes
13. **Pin Participant** - Keep specific participant always visible and prioritized in speaker view
14. **Lock Room** - Host can prevent new join requests with server-side enforcement and visual badge
15. **Recording Pause/Resume** - Pause multi-track recording without stopping, sync state to late joiners
16. **Transfer Host** - Host can reassign control to another approved participant with server-side validation

**Critical Security Fixes Applied:**
- Lock Room: Message guard blocks all non-join messages from unregistered clients (prevents race conditions)
- Recording Pause/Resume: isPausedRef updated immediately before async operations (prevents late-joiner desync)
- Transfer Host: Server validates same-room membership preventing cross-room privilege escalation
- Mute-all uses `track.enabled = false` instead of stopping tracks (participants can unmute themselves)

**Critical Performance Fixes Applied:**
- Recording countdown integrates with keyboard shortcuts via forwardRef
- Countdown cancellation uses guard flag to abort async recording start
- Emoji reactions use performant CSS animations instead of 60fps React re-renders
- Keyboard event handler includes `recordingCountdown` in dependencies (fixes stale closure)
- Audio level hook uses shared AudioContext to avoid browser's 6-context limit
- Active speaker callback memoized with useCallback (prevents infinite render loop)
- State updates only occur when values actually change (performance optimization)

**New Components:**
- `emoji-reaction.tsx` - CSS-based floating emoji animation component
- `audio-level-meter.tsx` - Visual bar displaying real-time audio levels
- Updated `RecordingControls` to forwardRef with `toggleRecording` and `cancelCountdown` methods

**New Hooks:**
- `use-audio-level.ts` - Web Audio API integration with shared AudioContext for real-time volume analysis
- `use-active-speaker.ts` - Detects loudest participant with threshold and debouncing logic

**Architecture Patterns:**
- Centralized state management with ref-based coordination between keyboard shortcuts and UI controls
- Host authorization validation on all privileged operations (remove, mute-all)
- WebSocket message handlers for real-time state synchronization (hand raise, emoji reactions, mute-all)
- Shared AudioContext singleton pattern to avoid browser limitations (max 6 contexts)
- Callback-based audio level reporting from children to parent with memoization
- Multi-track recording with dynamic participant tracking (handles late joiners and departures)

## Documentation

**Project Documentation Files:**
- `.env.example` - Environment variable configuration template
- `FEATURES.md` - Comprehensive feature documentation (22 major features)
- `API.md` - Complete API reference for HTTP and WebSocket endpoints
- `MISSING_FEATURES.md` - Analysis of features needed to make this a perfect podcast/meeting platform
- `replit.md` - Technical architecture and system overview (this file)

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management

**UI Components**
- Shadcn UI component library built on Radix UI primitives
- Tailwind CSS for styling with custom design tokens
- "New York" style variant with custom neutral color scheme
- Typography: Inter font family for UI, JetBrains Mono for technical information
- Consistent spacing system using Tailwind units (2, 4, 6, 8, 12, 16)

**State Management**
- Local React state for component-level UI state
- TanStack Query for caching and synchronizing server data
- WebSocket connection for real-time room communication
- In-memory storage for participants, messages, and room state

**Design Principles**
- Full viewport layout with no scrolling during active calls
- Responsive grid system that adapts based on participant count
- Persistent visibility of critical controls without interface clutter
- Professional broadcast-quality aesthetic with clarity over decoration

### Backend Architecture

**Server Framework**
- Express.js HTTP server
- Native Node.js HTTP server for WebSocket support
- TypeScript for type safety across the stack

**Real-Time Communication**
- WebSocket server (ws library) for signaling and chat
- WebRTC peer-to-peer connections using SimplePeer
- STUN servers (Google's public STUN servers) for NAT traversal
- Custom signaling protocol for room management and peer connection establishment

**Data Storage Strategy**
- In-memory storage (MemStorage class) as the default implementation
- Storage interface (IStorage) allows for future database integration
- User management with unique usernames and passwords
- Room-based participant tracking and chat message history

**Session Management**
- Session-based architecture with connect-pg-simple for PostgreSQL session storage
- Participant IDs generated client-side for WebSocket identification
- LocalStorage for persisting participant names across sessions

### Real-Time Features

**WebRTC Implementation**
- Peer-to-peer video and audio streaming
- Screen sharing capabilities
- Audio processing pipeline with Web Audio API:
  - Gain control for volume normalization
  - Dynamic compression for audio quality
  - Configurable noise suppression
- Video enhancement with CSS filters (brightness, contrast, saturation)

**WebSocket Message Types**
- `join-room`: Participant joins a room
- `participant-joined`: Broadcast new participant to existing members
- `participant-left`: Handle participant disconnection
- `signal`: WebRTC signaling (offer/answer/ICE candidates)
- `chat-message`: Real-time chat messages
- `toggle-audio`, `toggle-video`, `toggle-screen`: Media state updates

**Recording System**
- Client-side recording using RecordRTC library
- WebM format with VP9 video codec
- High bitrate settings (2.5 Mbps video, 128 kbps audio)
- Local download of recorded sessions

### External Dependencies

**Third-Party Services**
- Google Fonts CDN (Inter and JetBrains Mono fonts)
- Google STUN servers for WebRTC NAT traversal

**Key Libraries**
- **Database & ORM**: Drizzle ORM with PostgreSQL support via @neondatabase/serverless
- **WebRTC**: simple-peer for WebRTC abstraction, recordrtc for media recording
- **Real-time**: ws (WebSocket server)
- **UI Framework**: React, Radix UI primitives, Shadcn UI components
- **Styling**: Tailwind CSS with custom configuration
- **State Management**: TanStack Query for server state
- **Routing**: Wouter (lightweight React router)
- **Form Handling**: React Hook Form with Zod validation
- **Build Tools**: Vite, esbuild, TypeScript

**Development Tools**
- Replit-specific plugins for development experience (cartographer, dev-banner, runtime-error-modal)
- Drizzle Kit for database schema management and migrations

### Database Schema

**Users Table**
- Primary user authentication storage
- Fields: id (UUID), username (unique), password

**In-Memory Structures**
- Rooms: id, name, createdAt, hostId, participants array
- Participants: id, name, roomId, audio/video/screen sharing states, joinedAt timestamp
- Chat Messages: id, roomId, participantId, participantName, message, timestamp

The application uses an in-memory storage implementation by default but has database schema definitions for PostgreSQL through Drizzle ORM, allowing for future persistence of user data, rooms, and messages.

### Audio/Video Processing

**Media Pipeline**
- MediaProcessor class manages Web Audio API processing chain
- Audio context with source, gain, compressor, and destination nodes
- Configurable audio settings: noise suppression intensity, gain control, normalization
- Video filter application via CSS transforms for brightness, contrast, and saturation adjustments
- Support for multiple media devices (audio input/output, video input selection)

### Architecture Trade-offs

**In-Memory vs Persistent Storage**
- Current: In-memory storage provides simplicity and eliminates database setup complexity
- Trade-off: Room and chat data lost on server restart, not suitable for production at scale
- Future: IStorage interface allows seamless migration to PostgreSQL implementation

**Client-Side Recording**
- Current: Recording happens in the browser using RecordRTC
- Pros: No server storage costs, immediate download, privacy-focused
- Cons: Quality depends on client resources, no server-side mixing of multiple tracks

**WebSocket Signaling**
- Current: Custom WebSocket signaling server for WebRTC coordination
- Alternative considered: Third-party signaling services
- Rationale: Full control over signaling logic, no external dependencies for core functionality

**P2P vs Server-Mediated Streaming**
- Current: Peer-to-peer WebRTC connections
- Pros: Lower server bandwidth costs, better latency for small groups
- Cons: Scalability challenges with larger groups (mesh topology), client bandwidth limitations
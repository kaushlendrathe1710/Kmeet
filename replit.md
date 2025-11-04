# PodcastMeet - Professional Video Conferencing Platform

## Overview

PodcastMeet is a professional video conferencing platform specifically designed for podcast recording. The application provides high-quality audio and video capabilities with advanced features like noise suppression, audio enhancement, screen sharing, and local recording. It draws inspiration from Google Meet, Zoom, and Riverside.fm to create a broadcast-quality interface optimized for long-form podcast recording sessions.

## User Preferences

Preferred communication style: Simple, everyday language.

## Documentation

**Project Documentation Files:**
- `.env.example` - Environment variable configuration template
- `FEATURES.md` - Comprehensive feature documentation (22 major features)
- `API.md` - Complete API reference for HTTP and WebSocket endpoints
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
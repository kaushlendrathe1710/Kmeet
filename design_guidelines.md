# Design Guidelines: Professional Video Conferencing Platform for Podcasting

## Design Approach

**Reference-Based**: Drawing inspiration from Google Meet, Zoom, and Riverside.fm (podcast-specific platform), creating a professional, distraction-free interface optimized for long-form podcast recording sessions with emphasis on audio/video quality controls.

**Core Design Principles**:
- Clarity over decoration: Every element serves a functional purpose
- Persistent visibility of critical controls without cluttering the interface
- Professional broadcast-quality aesthetic
- Immediate access to recording and enhancement features

---

## Typography System

**Font Family**: 
- Primary: Inter (via Google Fonts CDN) - clean, highly legible at all sizes
- Monospace: JetBrains Mono - for room codes and technical information

**Type Scale**:
- Hero/Room Titles: text-4xl font-bold (36px)
- Section Headers: text-2xl font-semibold (24px)
- Participant Names: text-base font-medium (16px)
- Body Text: text-sm font-normal (14px)
- Captions/Labels: text-xs font-medium (12px)
- Room Codes: text-lg font-mono (18px monospace)

**Hierarchy Rules**:
- All interactive elements use font-medium or font-semibold for scannability
- Technical information (bitrate, quality indicators) uses monospace
- Participant names overlay video feeds with semi-transparent backgrounds

---

## Layout System

**Spacing Primitives**: Consistently use Tailwind units of **2, 4, 6, 8, 12, 16** for all spacing
- Component padding: p-4 to p-6
- Section margins: my-8 to my-12
- Button spacing: px-6 py-3
- Grid gaps: gap-4 for video grid, gap-2 for control groups

**Container Structure**:
- Full viewport layout: h-screen with fixed positioning
- No scrolling during active calls
- Responsive breakpoints: sm, md, lg, xl for video grid adaptation

---

## Core Layout Patterns

### Pre-Call Experience
**Join/Create Room Page**:
- Centered vertical layout (max-w-2xl mx-auto)
- Preview window showing user's video feed (aspect-ratio-video, rounded-lg)
- Device selection dropdowns below preview
- Large "Join Room" CTA button (full width or prominent centered)
- Room code input with copy functionality
- Audio/video test indicators with visual feedback

### In-Call Interface
**Primary Layout Structure**:
- **Top Bar** (h-16): Room name, participant count, duration timer, recording status indicator
- **Main Video Area** (flex-1): Dynamic grid of participant video feeds
- **Bottom Control Bar** (h-20): Fixed position, persistent controls
- **Side Panel** (w-80, collapsible): Chat, participant list, settings

**Video Grid System**:
- 2 participants: 2-column grid (grid-cols-2)
- 3-4 participants: 2x2 grid (grid-cols-2)
- 5-6 participants: 3x2 grid (grid-cols-3)
- 7-9 participants: 3x3 grid (grid-cols-3)
- 10+ participants: 4-column grid with vertical scroll (grid-cols-4)
- Active speaker highlight: Subtle border emphasis
- Self-view: Picture-in-picture overlay (bottom-right, w-48)

---

## Component Library

### Navigation & Controls

**Top Bar Components**:
- Room title with edit icon (left-aligned)
- Live recording indicator with red dot animation (pulsing)
- Timer showing session duration (font-mono)
- Participant count badge
- Settings gear icon (right-aligned)

**Bottom Control Bar** (backdrop-blur with semi-transparency):
- Icon-based controls in horizontal layout (gap-4)
- Control groups separated by vertical dividers
- Primary controls (center): Mic toggle, Camera toggle, Screen share, Record
- Secondary controls (left): Participants, Chat, Reactions
- Danger zone (right): Leave call button with distinct styling

**Control Button Specifications**:
- Circular buttons (w-12 h-12, rounded-full)
- Icons from Heroicons (solid variants, size 6)
- Toggle states: Active state shows filled background
- Muted/Off state: Red accent with slash-through icon
- Tooltips on hover showing keyboard shortcuts

### Video Feed Components

**Participant Video Card**:
- Aspect ratio 16:9 maintained
- Rounded corners (rounded-lg)
- Name overlay at bottom (absolute positioning)
- Network quality indicator (top-right corner)
- Speaking indicator: Animated border when active
- Video disabled state: Initials avatar with gradient background
- Pin/Spotlight action on hover

**Self-View Picture-in-Picture**:
- Fixed bottom-right with margin (bottom-4 right-4)
- Draggable positioning
- Minimize button
- Mirror effect for natural presentation

### Recording Interface

**Recording Control Panel** (appears when recording active):
- Visual recording indicator (pulsing red circle)
- Timer showing recording duration
- Pause/Resume toggle
- Stop recording with confirmation modal
- Quality indicator showing resolution and bitrate
- Storage space indicator

**Download Interface** (post-recording):
- Preview thumbnail of recording
- File size and duration information
- Format selection (MP4, WebM)
- Quality selection (1080p, 720p, 480p)
- Separate audio-only download option
- Download progress bar

### Audio/Video Enhancement Controls

**Enhancement Panel** (accessible via settings icon):
- **Noise Suppression**: Toggle switch with intensity slider (Low/Medium/High)
- **Audio Enhancement**: Gain control slider, normalization toggle
- **Video Enhancement**: Brightness slider, Contrast slider, Sharpness toggle
- **Preview Section**: Before/after comparison view
- Real-time visualization: Audio waveform showing noise reduction effect

**Quality Indicators**:
- Audio level meter (vertical bar graph)
- Video bitrate display (font-mono)
- Network quality icon (Excellent/Good/Poor)
- CPU usage indicator for enhancement features

### Chat & Messaging

**Chat Panel** (slide-in from right):
- Message list with timestamps (text-xs)
- Sender names in font-medium
- Input field at bottom with send button
- File sharing capability with preview thumbnails
- Emoji picker integration
- "Save chat log" download option

### Modals & Overlays

**Settings Modal**:
- Tabbed interface (Audio, Video, Recording, Advanced)
- Device selection dropdowns with preview
- Quality presets (Podcast Quality, Standard, Low Bandwidth)
- Keyboard shortcuts reference
- Close button (top-right)

**Confirmation Dialogs**:
- Centered overlay with backdrop blur
- Clear action buttons (Cancel, Confirm)
- Warning icons for destructive actions
- Checkbox for "Don't show again" options

---

## Responsive Behavior

**Desktop (lg and above)**:
- Full feature set visible
- Multi-column video grid
- Side panels accessible without overlay

**Tablet (md)**:
- Collapsible side panels as overlays
- 2-column maximum video grid
- Compact control bar with grouped actions

**Mobile (sm and below)**:
- Single column video grid
- Bottom sheet for controls
- Swipe gestures for panel access
- Simplified control set with overflow menu

---

## Animations & Interactions

**Minimal Animation Strategy**:
- Recording indicator: Subtle pulsing animation (pulse class)
- Speaker highlight: Smooth border transition (transition-all duration-200)
- Panel slide-ins: Transform with ease-in-out (transition-transform)
- Button feedback: Scale on active state (active:scale-95)
- No distracting animations during active calls

**Loading States**:
- Skeleton screens for video feed loading
- Spinner for processing recordings
- Progress bars for downloads

---

## Accessibility Features

**WCAG AA Compliance**:
- Minimum contrast ratios maintained throughout
- Focus indicators on all interactive elements (ring-2 ring-offset-2)
- Keyboard navigation with visible focus states
- Screen reader labels for all icon-only buttons
- Captions/transcription toggle for accessibility
- High contrast mode option in settings

**Keyboard Shortcuts**:
- M: Mute/unmute
- V: Video on/off
- S: Screen share
- R: Start/stop recording
- C: Toggle chat
- P: Toggle participants
- Space: Push-to-talk mode

---

## Images

**Hero Image**: No large hero image required - this is a web application, not a marketing site

**Avatar System**: 
- Default avatar when video is off: Generated gradient backgrounds with user initials
- Support for custom profile pictures (rounded-full)

**Empty States**:
- Waiting room: Illustration showing "Waiting for others to join"
- No recordings: Illustration with "No recordings yet" message
- Settings placeholder: Device icons when no camera/mic detected

---

## Production-Ready Details

**Status Indicators**:
- Network quality: Bars icon with Poor/Fair/Good/Excellent states
- Recording: Red dot with "REC" label
- Muted: Microphone slash icon in participant view
- Presenting: Monitor icon for screen sharing participant

**Professional Polish**:
- Subtle shadows on elevated elements (shadow-lg)
- Smooth state transitions throughout
- Consistent border radius (rounded-lg for cards, rounded-full for avatars/buttons)
- Blur effects for overlays (backdrop-blur-sm)
- Professional spacing ensuring no cramped interfaces
# Skrible - AI-Powered Idea Capture

Transform your thoughts into structured insights with our beautiful, production-ready idea capture interface.

## Features

- **Multi-Modal Input**: Text, voice, and image capture capabilities
- **AI-Powered Analysis**: Transform raw ideas into structured insights
- **Beautiful Design**: Modern, responsive interface with smooth animations
- **Real-time Feedback**: Loading states and interactive elements
- **Keyboard Shortcuts**: ⌘+Enter to quickly capture ideas

## Tech Stack

- **Next.js 13+** with TypeScript
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Custom animations** and micro-interactions

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd skrible-capture
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Development

### Project Structure

```
skrible-capture/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles and animations
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── CaptureScreen.tsx  # Main capture interface
│   ├── MicIcon.tsx        # Voice input icon
│   └── ImageIcon.tsx      # Image input icon
├── tailwind.config.ts     # Tailwind configuration
└── README.md
```

### Color System

- **Primary**: `#6366F1` (Royal Blue)
- **Primary Dark**: `#4F46E5`
- **Secondary**: `#FF7A59` (Coral Orange)
- **Secondary Light**: `#FFF1EE`
- **Background**: `#FFFFFF`
- **Background Alt**: `#F7FAFC`
- **Text**: `#374151`
- **Text Muted**: `#9CA3AF`

### Key Components

#### CaptureScreen
The main interface component featuring:
- Large textarea for idea input
- Voice and image input buttons
- Animated submit button with loading states
- Results display with color-coded insights
- Action buttons for refining and sharing

#### Animations
- **Fade-in**: Results panel slides up smoothly
- **Hover effects**: Buttons scale and change shadows
- **Loading spinner**: Custom animated loading state
- **Micro-interactions**: Icon buttons respond to hover

## Building for Production

```bash
npm run build
```

## Environment Variables

Currently no environment variables are required for the basic interface. When integrating with AI services, add:

```env
# Add your API keys here
OPENAI_API_KEY=your_key_here
NEXT_PUBLIC_API_URL=your_api_url
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
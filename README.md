# Antique Hunter - Professional Dealer Tool

Antique Hunter is a high-end field tool for antique dealers and collectors. It uses AI to provide instant commercial analysis, risk detection, and negotiation strategies for antiques and collectibles.

## Features

- **Expert Analysis**: Instant identification of period, style, and provenance.
- **Risk Detection**: Identifies "Red Flags" and construction issues.
- **Negotiation Strategy**: Provides "First Bid" and "Closing Target" prices based on market data.
- **Dealer Insights**: Professional "Trade View" on liquidity and resale potential.
- **Hunting Log**: Save and track your finds in a personal collection.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4.
- **Backend**: Express (Vite Middleware), Firebase (Auth & Firestore).
- **AI**: Google Gemini API via `@google/genai`.
- **Animations**: Motion (formerly Framer Motion).
- **Icons**: Lucide React.

## Getting Started

### Prerequisites

- Node.js (v18+)
- A Google Cloud Project with Gemini API enabled.
- A Firebase Project.

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd antique-hunter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the following (see `.env.example` for reference):
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   # Add other Firebase config variables as needed
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Deployment

This app is designed to run on Cloud Run or Vercel.

- **Build**: `npm run build`
- **Start**: `npm start`

## License

MIT

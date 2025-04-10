# Tech Stack Mastery Backend

Backend service for the Tech Stack Mastery learning assistant using the Gemini API.

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/)
5. Update the `.env` file with your actual API key

## Running the Server

Development mode with auto-reload:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## API Endpoints

- `POST /chat` - Chat with the learning assistant
- `POST /explain-step` - Get detailed explanation for a learning step

## Environment Variables

- `GEMINI_API_KEY` - Your Google Gemini API key
- `PORT` - Port number for the server (default: 5000)

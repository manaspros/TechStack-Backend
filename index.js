import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import middleware
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';

// Import routes
import diagnosticsRoutes from './routes/diagnostics.js';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Configure CORS with expanded allowed headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID', 'X-User-Email']
}));

// Get API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("⚠️ GEMINI_API_KEY is not set in the environment variables!");
}

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("⚠️ MONGODB_URI is not set in the environment variables!");
  console.error("Please set MONGODB_URI in your .env file");
  process.exit(1);
}

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Define schemas
// Chat schema
const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  contextId: String,
});

const chatSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  title: {
    type: String,
    default: "New Chat",
  },
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  contextSummary: String,
  lastMessageIndex: {
    type: Number,
    default: 0,
  },
});

// Learning progress schema
const learningStepSchema = new mongoose.Schema({
  stepId: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: Date,
});

const learningProgressSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chat",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  steps: [learningStepSchema],
  totalSteps: {
    type: Number,
    required: true,
  },
  completedSteps: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
});

// Create models
const Chat = mongoose.model("Chat", chatSchema);
const LearningProgress = mongoose.model(
  "LearningProgress",
  learningProgressSchema
);

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Enhanced system message with instruction to ask useful follow-up questions
const SYSTEM_MESSAGE = `You are a specialized tech learning assistant designed to help users learn any programming language, framework, or technology stack.
When users ask about a technology:
1. Provide accurate, up-to-date information about the technology
2. Be ready to create structured learning paths with clear steps
3. Focus on practical advice that helps users build skills progressively
4. Include specific resources, documentation links, and hands-on project recommendations
5. Break complex topics into manageable pieces for effective learning
Occasionally (about 30% of the time), include 1-2 thoughtful follow-up questions at the end of your responses.
These questions should help the user think more deeply about what they're learning or prompt them to consider
related concepts that would be useful for them to explore next. Format these as clear questions with question marks.`;

// Helper functions
const MAX_CONTEXT_MESSAGES = 10;
const MAX_CONTEXT_TOKENS = 4000;

function estimateTokenCount(text) {
  if (!text) return 0;
  // Simple token estimation based on words (approximation)
  const words = text.trim().split(/\s+/);
  return Math.ceil(words.length * 1.5); // Rough estimate that 1 word ≈ 1.5 tokens
}

function buildChatContext(messages, newMessage) {
  if (!messages || messages.length === 0) {
    return [
      {
        role: "user",
        parts: [{ text: newMessage }],
      },
    ];
  }

  // Add system message at the beginning
  const contextMessages = [
    {
      role: "model",
      parts: [{ text: SYSTEM_MESSAGE }],
    },
  ];

  // Get recent messages, limiting to MAX_CONTEXT_MESSAGES
  const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES).map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  // Add recent messages to context
  contextMessages.push(...recentMessages);

  // Trim context to fit token limits
  let totalTokens = estimateTokenCount(SYSTEM_MESSAGE);
  const trimmedMessages = [contextMessages[0]]; // Always keep system message

  for (let i = 1; i < contextMessages.length; i++) {
    const message = contextMessages[i];
    const messageText = message.parts[0].text;
    const messageTokens = estimateTokenCount(messageText);

    if (totalTokens + messageTokens <= MAX_CONTEXT_TOKENS) {
      trimmedMessages.push(message);
      totalTokens += messageTokens;
    } else {
      console.log(
        `Skipping message due to token limit (${totalTokens}/${MAX_CONTEXT_TOKENS})`
      );
    }
  }

  // Add the new message if it's not included yet
  if (newMessage) {
    trimmedMessages.push({
      role: "user",
      parts: [{ text: newMessage }],
    });
  }

  return trimmedMessages;
}

// Mount diagnostics route directly
app.use('/api/diagnostics', diagnosticsRoutes);

// Main chat endpoint - Enhanced with context awareness
app.post("/api/chat", async (req, res) => {
  const { newChat, oldChats, generateLearningPath, userId, chatId } = req.body;

  if (!newChat) {
    return res.status(400).json({ error: "newChat field is required." });
  }

  if (!userId) {
    return res.status(400).json({ error: "userId field is required." });
  }

  try {
    // Get conversation context
    let messages = [];
    let chat = null;

    // If chatId is provided, fetch existing chat
    if (chatId) {
      try {
        chat = await Chat.findOne({ _id: chatId, userId });
        if (chat) {
          messages = chat.messages;
          console.log(`Found existing chat with ${messages.length} messages`);
        }
      } catch (error) {
        console.error("Error fetching chat:", error);
      }
    }
    // If no chatId or chat not found, use oldChats from request
    else if (Array.isArray(oldChats) && oldChats.length > 0) {
      messages = oldChats.map((chat) => ({
        role: chat.role === "user" ? "user" : "assistant",
        content: chat.parts,
      }));
    }

    // Build context-aware conversation for Gemini API
    const contextMessages = buildChatContext(messages, null);

    // If requesting a learning path, modify the user query
    let userQuery = newChat;
    if (generateLearningPath) {
      userQuery = `Please create a detailed step-by-step learning path for ${newChat}. Include the following:
      1. Prerequisites I should know first
      2. Core concepts to master with clear progression
      3. Recommended resources for each step (documentation, tutorials, courses)
      4. Practice projects that build in complexity
      5. Advanced topics to explore after mastering the basics
      Format this as a clear, numbered learning path that I can follow over time.
      
      At the end, include 1-2 follow-up questions about how I plan to use this knowledge or what specific aspects I'm most interested in.`;
    }

    // Add the new message to context
    contextMessages.push({
      role: "user",
      parts: [{ text: userQuery }],
    });

    // Call the Gemini API with properly formatted request
    const response = await axios.post(GEMINI_API_URL, {
      contents: contextMessages,
    });

    // Extract the response from the Gemini API
    const generatedContent = response.data.candidates?.[0]?.content;

    if (!generatedContent) {
      throw new Error("No content generated by Gemini API");
    }

    const answer = generatedContent.parts?.[0]?.text || "No response text";

    // Save the conversation to the database
    if (userId) {
      try {
        let savedChat;
        const newUserMessage = {
          role: "user",
          content: userQuery,
          timestamp: new Date(),
        };

        const newAssistantMessage = {
          role: "assistant",
          content: answer,
          timestamp: new Date(),
        };

        if (chat) {
          // Update existing chat
          chat.messages.push(newUserMessage, newAssistantMessage);
          chat.updatedAt = new Date();
          chat.lastMessageIndex = chat.messages.length;
          savedChat = await chat.save();
        } else {
          // Create new chat
          const title =
            newChat.length > 30 ? `${newChat.substring(0, 30)}...` : newChat;
          savedChat = await Chat.create({
            userId,
            title,
            messages: [newUserMessage, newAssistantMessage],
            createdAt: new Date(),
            updatedAt: new Date(),
            lastMessageIndex: 2,
          });
        }

        // Create learning path record if this is a learning path
        if (generateLearningPath) {
          // Extract the learning steps
          const steps = extractLearningSteps(answer);
          if (steps.length > 0) {
            // Check if learning progress already exists for this chat
            let learningProgress = await LearningProgress.findOne({
              userId,
              chatId: savedChat._id,
            });

            if (learningProgress) {
              // Update existing learning path
              learningProgress.title = `Learning Path: ${newChat.substring(
                0,
                50
              )}`;
              learningProgress.steps = steps.map((step) => ({
                stepId: step.id,
                title: step.title,
                completed: false,
              }));
              learningProgress.totalSteps = steps.length;
              learningProgress.completedSteps = 0;
              learningProgress.isCompleted = false;
              learningProgress.updatedAt = new Date();
              learningProgress.lastAccessedAt = new Date();
              await learningProgress.save();
            } else {
              // Create new learning path progress
              await LearningProgress.create({
                userId,
                chatId: savedChat._id,
                title: `Learning Path: ${newChat.substring(0, 50)}`,
                steps: steps.map((step) => ({
                  stepId: step.id,
                  title: step.title,
                  completed: false,
                })),
                totalSteps: steps.length,
                completedSteps: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                lastAccessedAt: new Date(),
              });
            }
          }
        }
      } catch (dbError) {
        console.error("Database error saving chat:", dbError);
        // Don't fail the request if DB save fails, but log the error
      }
    }

    // Return the formatted response
    return res.json({
      answer,
      role: generatedContent.role || "model",
      isLearningPath: !!generateLearningPath,
      chatId: chat?._id || null,
    });
  } catch (error) {
    console.error(
      "Error calling Gemini API:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      error: "Internal server error.",
      details: error.response?.data || error.message,
    });
  }
});

// Helper function to extract learning steps from text
function extractLearningSteps(text) {
  if (!text) return [];

  const steps = [];
  let stepCount = 0;

  // Match patterns like "1. Step title" or "Step 1: title"
  const stepPatterns = [
    /(?:^|\n)(?:Step|Phase|Part|Level|Stage)[\s:-]+(\d+|[A-Z])[\s:-]*([^\n]+)/gi,
    /(?:^|\n)(\d+)[\.:\)\-]\s+([^\n]+)/gi,
    /(?:^|\n)#{1,3}\s+(?:(?:Step|Phase|Part|Stage|Level)[\s:-]+)?([^\n]+)/gi,
  ];

  for (const pattern of stepPatterns) {
    const regex = new RegExp(pattern);
    let match;

    while ((match = regex.exec(text)) !== null) {
      stepCount++;
      const rawTitle = match[2] || match[1] || `Step ${stepCount}`;
      const title = rawTitle.trim().replace(/^\*+|\*+$/g, ""); // Remove asterisks

      steps.push({
        id: `step-${stepCount}`,
        title: title.length > 60 ? title.substring(0, 60) + "..." : title,
      });
    }

    // If we found steps with this pattern, stop trying others
    if (steps.length > 0) break;
  }

  // If no structured steps found, try simpler pattern
  if (steps.length === 0) {
    const numberedItems = text.match(/(?:^|\n)\d+\.\s+([^\n]+)/g);
    if (numberedItems && numberedItems.length >= 3) {
      numberedItems.forEach((item, idx) => {
        const title = item.replace(/^\d+\.\s+/, "").trim();
        steps.push({
          id: `item-${idx + 1}`,
          title: title.length > 60 ? title.substring(0, 60) + "..." : title,
        });
      });
    }
  }

  return steps;
}

// New endpoint to retrieve a user's learning progress
app.get("/api/learning-progress/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "userId parameter is required." });
    }

    const learningPaths = await LearningProgress.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(20);

    return res.json({ learningPaths });
  } catch (error) {
    console.error("Error fetching learning progress:", error);
    return res.status(500).json({ error: "Failed to fetch learning progress" });
  }
});

// New endpoint to update learning progress (mark steps as completed)
app.patch("/api/learning-progress/:progressId", async (req, res) => {
  try {
    const { progressId } = req.params;
    const { stepId, completed, userId } = req.body;

    if (!progressId || !stepId || typeof completed !== "boolean" || !userId) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const learningPath = await LearningProgress.findOne({
      _id: progressId,
      userId,
    });

    if (!learningPath) {
      return res.status(404).json({ error: "Learning path not found" });
    }

    // Find the step to update
    const stepIndex = learningPath.steps.findIndex((s) => s.stepId === stepId);

    if (stepIndex === -1) {
      return res.status(404).json({ error: "Step not found in learning path" });
    }

    // Update completion status
    const step = learningPath.steps[stepIndex];
    const wasCompleted = step.completed;
    step.completed = completed;

    // Update completion timestamp if newly completed
    if (completed && !wasCompleted) {
      step.completedAt = new Date();
      learningPath.completedSteps += 1;
    } else if (!completed && wasCompleted) {
      step.completedAt = undefined;
      learningPath.completedSteps = Math.max(
        0,
        learningPath.completedSteps - 1
      );
    }

    // Check if all steps are completed
    learningPath.isCompleted =
      learningPath.completedSteps === learningPath.totalSteps;

    // Update timestamps
    learningPath.updatedAt = new Date();
    learningPath.lastAccessedAt = new Date();

    await learningPath.save();

    return res.json({
      success: true,
      learningPath,
    });
  } catch (error) {
    console.error("Error updating learning progress:", error);
    return res
      .status(500)
      .json({ error: "Failed to update learning progress" });
  }
});

// Existing explain-step endpoint
app.post("/api/explain-step", async (req, res) => {
  const { stepId, stepTitle, stepType } = req.body;

  if (!stepTitle) {
    return res.status(400).json({ error: "stepTitle field is required." });
  }

  try {
    // Format a prompt for the explanation
    let prompt = "";

    switch (stepType) {
      case "prerequisite":
        prompt = `Explain this prerequisite step in a learning journey: "${stepTitle}". 
        Include why this foundational knowledge is important, how to acquire it, 
        and 2-3 specific resources (like documentation, tutorials or books) that would help.
        Keep the explanation under 150 words and format with bullet points for key concepts.`;
        break;

      case "core":
        prompt = `Explain this core concept in depth: "${stepTitle}". 
        Provide a clear explanation of what this involves, the key principles to understand, 
        common challenges learners face, and practical ways to master it.
        Include 1-2 example resources that provide the best explanations of this concept.
        Keep the explanation under 150 words and highlight important terms.`;
        break;

      case "practice":
        prompt = `Explain this practice/project step: "${stepTitle}".
        Describe what skills this practice will develop, how to approach it step by step,
        common pitfalls to avoid, and how to know when you've mastered it.
        Suggest 1-2 specific project ideas that would help implement this knowledge.
        Keep the explanation under 150 words and be practical.`;
        break;

      case "advanced":
        prompt = `Explain this advanced concept: "${stepTitle}".
        Detail why this is considered advanced, what prerequisites are needed,
        how it builds on earlier knowledge, and the specific benefits of mastering it.
        Mention 1-2 real-world applications where this is essential.
        Keep the explanation under 150 words and highlight what makes this topic powerful.`;
        break;

      default:
        prompt = `Explain this learning step in detail: "${stepTitle}".
        Include what it involves, why it's important, how to approach learning it,
        and 1-2 recommended resources.
        Keep the explanation under 150 words and be specific and practical.`;
    }

    // Call the Gemini API with the prompt
    const response = await axios.post(GEMINI_API_URL, {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    // Extract the response
    const generatedContent = response.data.candidates?.[0]?.content;

    if (!generatedContent) {
      throw new Error("No content generated by Gemini API");
    }

    // Return the explanation
    return res.json({
      explanation:
        generatedContent.parts?.[0]?.text || "No explanation available",
    });
  } catch (error) {
    console.error(
      "Error generating explanation:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      error: "Failed to generate explanation",
      details: error.response?.data || error.message,
    });
  }
});

// New endpoint to fetch chat history for a user
app.get("/api/chat-history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, page = 1 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId parameter is required." });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const chats = await Chat.find({ userId })
      .sort({ updatedAt: -1 })
      .select("title updatedAt createdAt")
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Chat.countDocuments({ userId });

    return res.json({
      chats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

// New endpoint to fetch a specific chat
app.get("/api/chat/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.query;

    if (!chatId) {
      return res.status(400).json({ error: "chatId parameter is required." });
    }

    if (!userId) {
      return res
        .status(400)
        .json({ error: "userId query parameter is required." });
    }

    const chat = await Chat.findOne({ _id: chatId, userId });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    return res.json({ chat });
  } catch (error) {
    console.error("Error fetching chat:", error);
    return res.status(500).json({ error: "Failed to fetch chat" });
  }
});

// Add 404 and error handlers at the end
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  console.log(`API key status: ${GEMINI_API_KEY ? "✅ Loaded" : "❌ Missing"}`);
  console.log(
    `MongoDB status: ${
      mongoose.connection.readyState ? "✅ Connected" : "❌ Not connected"
    }`
  );
});

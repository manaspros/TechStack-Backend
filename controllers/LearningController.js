import LearningService from '../services/LearningService.js';

/**
 * LearningController - Class for handling learning path HTTP requests
 */
class LearningController {
  /**
   * Get learning paths for a specific user
   */
  async getUserLearningPaths(req, res) {
    try {
      const { userId } = req.params;
      const { limit, page } = req.query;
      
      if (!userId) {
        return res.status(400).json({ error: "userId parameter is required." });
      }
      
      const result = await LearningService.getUserLearningPaths(
        userId, 
        limit,
        page
      );
      
      return res.json(result);
    } catch (error) {
      console.error("Error fetching learning progress:", error);
      return res.status(500).json({ error: "Failed to fetch learning progress" });
    }
  }

  /**
   * Get a specific learning path by ID
   */
  async getLearningPathById(req, res) {
    try {
      const { progressId } = req.params;
      
      // Look for userId in both the request body and query parameters
      const userId = req.body.userId || req.query.userId;
      
      if (!progressId || !userId) {
        return res.status(400).json({ error: "progressId and userId are required." });
      }
      
      const learningPath = await LearningService.getLearningPathById(progressId, userId);
      return res.json({ learningPath });
    } catch (error) {
      console.error("Error fetching learning path:", error);
      
      if (error.message === 'Learning path not found') {
        return res.status(404).json({ error: error.message });
      }
      
      return res.status(500).json({ error: "Failed to fetch learning path" });
    }
  }

  /**
   * Create a new learning path
   */
  async createLearningPath(req, res) {
    try {
      const pathData = req.body;
      
      // Validate required fields
      if (!pathData.userId || !pathData.chatId || !pathData.title) {
        return res.status(400).json({ 
          error: "Missing required fields: userId, chatId, and title are required."
        });
      }
      
      // Process text to extract steps if text is provided
      if (pathData.text && !pathData.steps) {
        pathData.steps = LearningService.extractLearningSteps(pathData.text);
        
        if (pathData.steps.length === 0) {
          return res.status(400).json({ 
            error: "Could not extract learning steps from provided text." 
          });
        }
      }
      
      // Make sure steps are provided
      if (!pathData.steps || !Array.isArray(pathData.steps) || pathData.steps.length === 0) {
        return res.status(400).json({ error: "Steps are required to create a learning path." });
      }
      
      const learningPath = await LearningService.createLearningPath(pathData);
      return res.status(201).json({ learningPath });
    } catch (error) {
      console.error("Error creating learning path:", error);
      return res.status(500).json({ error: "Failed to create learning path" });
    }
  }

  /**
   * Update step completion status
   */
  async updateStepCompletion(req, res) {
    try {
      const { progressId } = req.params;
      const { stepId, completed, userId } = req.body;
      
      if (!progressId || !stepId || typeof completed !== "boolean" || !userId) {
        return res.status(400).json({ error: "Missing required fields." });
      }
      
      const learningPath = await LearningService.updateStepCompletion(
        progressId, 
        stepId, 
        completed, 
        userId
      );
      
      return res.json({
        success: true,
        learningPath,
      });
    } catch (error) {
      console.error("Error updating learning progress:", error);
      
      if (error.message === 'Learning path not found' || 
          error.message === 'Step not found in learning path') {
        return res.status(404).json({ error: error.message });
      }
      
      return res.status(500).json({ error: "Failed to update learning progress" });
    }
  }
  
  /**
   * Add notes to a learning step
   */
  async addStepNotes(req, res) {
    try {
      const { progressId } = req.params;
      const { stepId, notes, userId } = req.body;
      
      if (!progressId || !stepId || !notes || !userId) {
        return res.status(400).json({ error: "Missing required fields." });
      }
      
      const learningPath = await LearningService.addStepNotes(
        progressId, 
        stepId, 
        notes, 
        userId
      );
      
      return res.json({
        success: true,
        learningPath,
      });
    } catch (error) {
      console.error("Error adding step notes:", error);
      
      if (error.message === 'Learning path not found' || 
          error.message === 'Step not found in learning path') {
        return res.status(404).json({ error: error.message });
      }
      
      return res.status(500).json({ error: "Failed to add step notes" });
    }
  }
}

export default new LearningController();
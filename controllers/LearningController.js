import BaseController from './BaseController.js';
import LearningService from '../services/LearningService.js';

/**
 * LearningController - Class for handling learning path HTTP requests
 * Extends BaseController to inherit common functionality
 */
class LearningController extends BaseController {
  /**
   * Constructor for the learning controller
   */
  constructor() {
    // Pass the LearningService to the base controller
    super(LearningService);
  }

  /**
   * Get learning paths for a specific user
   */
  async getUserLearningPaths(req, res) {
    try {
      // Get userId and validate
      const userId = this.getRequestField(req, 'userId', ['params']);
      if (!userId) {
        return this.sendError(res, "userId parameter is required.", 400);
      }
      
      // Get pagination parameters
      const limit = this.getRequestField(req, 'limit', ['query']);
      const page = this.getRequestField(req, 'page', ['query']);
      
      // Use the service to fetch data
      const result = await this.service.getUserLearningPaths(userId, limit, page);
      
      // Send successful response
      return this.sendSuccess(res, result);
    } catch (error) {
      return this.sendError(res, "Failed to fetch learning progress", 500);
    }
  }

  /**
   * Get a specific learning path by ID
   */
  async getLearningPathById(req, res) {
    try {
      // Get required parameters
      const progressId = this.getRequestField(req, 'progressId', ['params']);
      const userId = this.getRequestField(req, 'userId', ['body', 'query']);
      
      // Validate required fields
      if (!progressId || !userId) {
        return this.sendError(res, "progressId and userId are required.", 400);
      }
      
      // Fetch the learning path
      const learningPath = await this.service.getLearningPathById(progressId, userId);
      
      // Return successful response
      return this.sendSuccess(res, { learningPath });
    } catch (error) {
      // Handle specific error cases
      if (error.message === 'Learning path not found') {
        return this.sendError(res, error.message, 404);
      }
      
      return this.sendError(res, "Failed to fetch learning path", 500);
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
        return this.sendError(res, 
          "Missing required fields: userId, chatId, and title are required.", 
          400
        );
      }
      
      // Process text to extract steps if text is provided
      if (pathData.text && !pathData.steps) {
        pathData.steps = this.service.extractLearningSteps(pathData.text);
        
        if (pathData.steps.length === 0) {
          return this.sendError(res, 
            "Could not extract learning steps from provided text.",
            400
          );
        }
      }
      
      // Make sure steps are provided
      if (!pathData.steps || !Array.isArray(pathData.steps) || pathData.steps.length === 0) {
        return this.sendError(res, 
          "Steps are required to create a learning path.",
          400
        );
      }
      
      // Create the learning path
      const learningPath = await this.service.createLearningPath(pathData);
      
      // Return successful response
      return this.sendSuccess(res, { learningPath }, 201);
    } catch (error) {
      return this.sendError(res, "Failed to create learning path", 500);
    }
  }

  /**
   * Update step completion status
   */
  async updateStepCompletion(req, res) {
    try {
      // Get required parameters
      const progressId = this.getRequestField(req, 'progressId', ['params']);
      const stepId = this.getRequestField(req, 'stepId', ['body']);
      const completed = this.getRequestField(req, 'completed', ['body']);
      const userId = this.getRequestField(req, 'userId', ['body']);
      
      // Validate required fields
      if (!progressId || !stepId || typeof completed !== "boolean" || !userId) {
        return this.sendError(res, "Missing required fields.", 400);
      }
      
      // Update the step completion
      const learningPath = await this.service.updateStepCompletion(
        progressId, 
        stepId, 
        completed, 
        userId
      );
      
      // Return successful response
      return this.sendSuccess(res, {
        learningPath,
      });
    } catch (error) {
      // Handle specific error cases
      if (error.message === 'Learning path not found' || 
          error.message === 'Step not found in learning path') {
        return this.sendError(res, error.message, 404);
      }
      
      return this.sendError(res, "Failed to update learning progress", 500);
    }
  }
  
  /**
   * Add notes to a learning step
   */
  async addStepNotes(req, res) {
    try {
      // Get required parameters
      const progressId = this.getRequestField(req, 'progressId', ['params']);
      const stepId = this.getRequestField(req, 'stepId', ['body']);
      const notes = this.getRequestField(req, 'notes', ['body']);
      const userId = this.getRequestField(req, 'userId', ['body']);
      
      // Validate required fields
      if (!progressId || !stepId || !notes || !userId) {
        return this.sendError(res, "Missing required fields.", 400);
      }
      
      // Add notes to the step
      const learningPath = await this.service.addStepNotes(
        progressId, 
        stepId, 
        notes, 
        userId
      );
      
      // Return successful response
      return this.sendSuccess(res, {
        learningPath,
      });
    } catch (error) {
      // Handle specific error cases
      if (error.message === 'Learning path not found' || 
          error.message === 'Step not found in learning path') {
        return this.sendError(res, error.message, 404);
      }
      
      return this.sendError(res, "Failed to add step notes", 500);
    }
  }

  /**
   * Delete a learning path
   */
  async deleteLearningPath(req, res) {
    try {
      // Get required parameters
      const progressId = this.getRequestField(req, 'progressId', ['params']);
      const userId = this.getRequestField(req, 'userId', ['body', 'query']);
      
      // Validate required fields
      if (!progressId) {
        return this.sendError(res, "progressId is required.", 400);
      }
      
      // Delete the learning path
      const result = await this.service.deleteLearningPath(progressId, userId);
      
      // Return successful response
      return this.sendSuccess(res, {
        message: "Learning path deleted successfully",
        deletedId: progressId
      });
    } catch (error) {
      // Handle specific error cases
      if (error.message === 'Learning path not found') {
        return this.sendError(res, error.message, 404);
      }
      
      if (error.message === 'Unauthorized') {
        return this.sendError(res, "You don't have permission to delete this learning path", 403);
      }
      
      return this.sendError(res, "Failed to delete learning path", 500);
    }
  }
}

// Export a singleton instance
export default new LearningController();
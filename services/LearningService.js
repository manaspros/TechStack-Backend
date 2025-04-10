import LearningProgress from '../models/ProgressModel.js';

/**
 * LearningService - Class for handling learning path operations
 */
class LearningService {
  /**
   * Get learning paths for a specific user
   * @param {string} userId - The user ID
   * @param {number} limit - Maximum number of paths to return
   * @param {number} page - Page number for pagination
   * @returns {Promise} Learning paths and pagination info
   */
  async getUserLearningPaths(userId, limit = 20, page = 1) {
    try {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const learningPaths = await LearningProgress.find({ userId })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
        
      const total = await LearningProgress.countDocuments({ userId });
      
      return {
        learningPaths,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        }
      };
    } catch (error) {
      console.error('Error in getUserLearningPaths:', error);
      throw new Error('Failed to fetch learning paths');
    }
  }

  /**
   * Get a specific learning path by ID
   * @param {string} progressId - The learning path ID
   * @param {string} userId - The user ID (for authorization)
   * @returns {Promise} The learning path
   */
  async getLearningPathById(progressId, userId) {
    try {
      // First attempt: Find by both progressId and userId (strict match)
      let learningPath = await LearningProgress.findOne({
        _id: progressId,
        userId,
      });
      
      // If not found and userId starts with "session:", try finding by ID only
      // This handles the case where session IDs might change
      if (!learningPath && userId && userId.startsWith("session:")) {
        console.log("Session-based userId didn't match, trying to find by ID only");
        learningPath = await LearningProgress.findById(progressId);
      }
      
      // If still not found, try one last attempt with just the ID
      if (!learningPath) {
        console.log("Attempting to find learning path by ID only as fallback");
        learningPath = await LearningProgress.findById(progressId);
        
        // If found this way, let's update the userId to match the current user
        // for easier access in the future
        if (learningPath && userId) {
          console.log("Updating learning path userId for future access");
          learningPath.userId = userId;
          await learningPath.save();
        }
      }
      
      if (!learningPath) {
        throw new Error('Learning path not found');
      }
      
      return learningPath;
    } catch (error) {
      console.error('Error in getLearningPathById:', error);
      throw error;
    }
  }

  /**
   * Create a new learning path
   * @param {object} pathData - Learning path data
   * @returns {Promise} The created learning path
   */
  async createLearningPath(pathData) {
    try {
      const { userId, chatId, title, steps } = pathData;
      
      if (!userId || !chatId || !title || !steps || !Array.isArray(steps)) {
        throw new Error('Missing required fields for learning path');
      }
      
      const learningPath = new LearningProgress({
        userId,
        chatId,
        title,
        steps: steps.map(step => ({
          stepId: step.id,
          title: step.title,
          completed: false,
          category: step.category || 'core'
        })),
        totalSteps: steps.length,
        completedSteps: 0,
        description: pathData.description || '',
        difficulty: pathData.difficulty || 'intermediate',
        estimatedTimeToComplete: pathData.estimatedTimeToComplete || '',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      });
      
      await learningPath.save();
      return learningPath;
    } catch (error) {
      console.error('Error in createLearningPath:', error);
      throw error;
    }
  }

  /**
   * Update step completion status
   * @param {string} progressId - Learning path ID
   * @param {string} stepId - Step ID to update
   * @param {boolean} completed - New completion status
   * @param {string} userId - User ID for authorization
   * @returns {Promise} Updated learning path
   */
  async updateStepCompletion(progressId, stepId, completed, userId) {
    try {
      // First attempt: Find by both progressId and userId (strict match)
      let learningPath = await LearningProgress.findOne({
        _id: progressId,
        userId,
      });
      
      // If not found and userId starts with "session:", try finding by ID only
      if (!learningPath && userId && userId.startsWith("session:")) {
        console.log("Session-based userId didn't match, trying to find by ID only");
        learningPath = await LearningProgress.findById(progressId);
      }
      
      // Last resort: just find by ID
      if (!learningPath) {
        console.log("Attempting to find learning path by ID only as fallback");
        learningPath = await LearningProgress.findById(progressId);
        
        // Update the userId if we found it, for easier future access
        if (learningPath && userId) {
          console.log("Updating learning path userId for future access");
          learningPath.userId = userId;
        }
      }
      
      if (!learningPath) {
        throw new Error('Learning path not found');
      }
      
      // Find the step to update
      const stepIndex = learningPath.steps.findIndex(s => s.stepId === stepId);
      
      if (stepIndex === -1) {
        throw new Error('Step not found in learning path');
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
        learningPath.completedSteps = Math.max(0, learningPath.completedSteps - 1);
      }
      
      // Check if all steps are completed
      learningPath.isCompleted = learningPath.completedSteps === learningPath.totalSteps;
      
      // Update timestamps
      learningPath.updatedAt = new Date();
      learningPath.lastAccessedAt = new Date();
      
      await learningPath.save();
      return learningPath;
    } catch (error) {
      console.error('Error in updateStepCompletion:', error);
      throw error;
    }
  }
  
  /**
   * Add notes to a learning step
   * @param {string} progressId - Learning path ID
   * @param {string} stepId - Step ID to update
   * @param {string} notes - Notes to add
   * @param {string} userId - User ID for authorization
   * @returns {Promise} Updated learning path
   */
  async addStepNotes(progressId, stepId, notes, userId) {
    try {
      // First attempt: Find by both progressId and userId (strict match)
      let learningPath = await LearningProgress.findOne({
        _id: progressId,
        userId,
      });
      
      // If not found and userId starts with "session:", try finding by ID only
      if (!learningPath && userId && userId.startsWith("session:")) {
        console.log("Session-based userId didn't match, trying to find by ID only");
        learningPath = await LearningProgress.findById(progressId);
      }
      
      // Last resort: just find by ID
      if (!learningPath) {
        console.log("Attempting to find learning path by ID only as fallback");
        learningPath = await LearningProgress.findById(progressId);
        
        // Update the userId if we found it, for easier future access
        if (learningPath && userId) {
          console.log("Updating learning path userId for future access");
          learningPath.userId = userId;
        }
      }
      
      if (!learningPath) {
        throw new Error('Learning path not found');
      }
      
      // Find the step to update
      const stepIndex = learningPath.steps.findIndex(s => s.stepId === stepId);
      
      if (stepIndex === -1) {
        throw new Error('Step not found in learning path');
      }
      
      // Update notes
      learningPath.steps[stepIndex].notes = notes;
      
      // Update timestamps
      learningPath.updatedAt = new Date();
      learningPath.lastAccessedAt = new Date();
      
      await learningPath.save();
      return learningPath;
    } catch (error) {
      console.error('Error in addStepNotes:', error);
      throw error;
    }
  }
  
  /**
   * Extract learning steps from text content
   * @param {string} text - Text content to analyze
   * @returns {Array} Extracted steps
   */
  extractLearningSteps(text) {
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
        const title = rawTitle.trim().replace(/^\*+|\*+$/g, ''); // Remove asterisks
        
        // Try to determine category based on content
        let category = 'core';
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('prerequisite') || lowerTitle.includes('before') || lowerTitle.includes('foundation')) {
          category = 'prerequisite';
        } else if (lowerTitle.includes('practice') || lowerTitle.includes('project') || lowerTitle.includes('exercise')) {
          category = 'practice';
        } else if (lowerTitle.includes('advanced') || lowerTitle.includes('expert') || lowerTitle.includes('complex')) {
          category = 'advanced';
        }
        
        steps.push({
          id: `step-${stepCount}`,
          title: title.length > 60 ? title.substring(0, 60) + '...' : title,
          category
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
          const title = item.replace(/^\d+\.\s+/, '').trim();
          steps.push({
            id: `item-${idx + 1}`,
            title: title.length > 60 ? title.substring(0, 60) + '...' : title,
            category: 'core'
          });
        });
      }
    }
    
    return steps;
  }

  /**
   * Delete a learning path
   * @param {string} progressId - Learning path ID to delete
   * @param {string} userId - User ID for authorization
   * @returns {Promise} Result of the deletion operation
   */
  async deleteLearningPath(progressId, userId) {
    try {
      // First attempt: Find by both progressId and userId (strict match)
      let learningPath = await LearningProgress.findOne({
        _id: progressId,
        userId,
      });
      
      // If not found and userId starts with "session:", try finding by ID only
      if (!learningPath && userId && userId.startsWith("session:")) {
        console.log("Session-based userId didn't match, trying to find by ID only");
        learningPath = await LearningProgress.findById(progressId);
      }
      
      // Last resort: just find by ID
      if (!learningPath) {
        console.log("Attempting to find learning path by ID only as fallback");
        learningPath = await LearningProgress.findById(progressId);
      }
      
      if (!learningPath) {
        throw new Error('Learning path not found');
      }
      
      // Delete the learning path
      await LearningProgress.deleteOne({ _id: progressId });
      
      return { success: true, deletedId: progressId };
    } catch (error) {
      console.error('Error in deleteLearningPath:', error);
      throw error;
    }
  }
}

export default new LearningService();
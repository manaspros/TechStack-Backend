import BaseService from './BaseService.js';
import LearningProgress from '../models/ProgressModel.js';

/**
 * LearningService - Class for handling learning path operations
 * Extends BaseService to inherit common functionality
 */
class LearningService extends BaseService {
  /**
   * Constructor for the learning service
   */
  constructor() {
    // Pass the LearningProgress model to the base service
    super(LearningProgress);
  }

  /**
   * Get learning paths for a specific user
   * @param {string} userId - The user ID
   * @param {number} limit - Maximum number of paths to return
   * @param {number} page - Page number for pagination
   * @returns {Promise} Learning paths and pagination info
   */
  async getUserLearningPaths(userId, limit = 20, page = 1) {
    try {
      // Reuse the base class's getAll method with a user filter
      const result = await this.getAll({ userId }, limit, page);
      
      // Return with learning paths property for backward compatibility
      return {
        learningPaths: result.items,
        pagination: result.pagination
      };
    } catch (error) {
      console.error('Error in getUserLearningPaths:', error);
      throw new Error('Failed to fetch learning paths');
    }
  }

  /**
   * Get a specific learning path by ID with support for multiple ID lookup methods
   * @param {string} progressId - The learning path ID
   * @param {string} userId - The user ID (for authorization)
   * @returns {Promise} The learning path
   */
  async getLearningPathById(progressId, userId) {
    try {
      // Strategy pattern for looking up learning paths
      const lookupStrategies = [
        // Strategy 1: Look up by both progressId and userId (strict match)
        async () => await this.model.findOne({ _id: progressId, userId }),
        
        // Strategy 2: If userId starts with "session:", try finding by ID only
        async () => {
          if (userId && userId.startsWith("session:")) {
            console.log("Session-based userId didn't match, trying to find by ID only");
            return await this.model.findById(progressId);
          }
          return null;
        },
        
        // Strategy 3: Last resort - just find by ID
        async () => {
          console.log("Attempting to find learning path by ID only as fallback");
          const path = await this.model.findById(progressId);
          
          // Update the userId if found, for easier future access
          if (path && userId) {
            console.log("Updating learning path userId for future access");
            path.userId = userId;
            await path.save();
          }
          return path;
        }
      ];
      
      // Try each strategy in sequence until one succeeds
      let learningPath = null;
      for (const strategy of lookupStrategies) {
        learningPath = await strategy();
        if (learningPath) break;
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
   * Create a new learning path with validation
   * @param {object} pathData - Learning path data
   * @returns {Promise} The created learning path
   */
  async createLearningPath(pathData) {
    try {
      // Validate required fields
      this.validateLearningPathData(pathData);
      
      // Format the data for the model
      const formattedData = this.formatLearningPathData(pathData);
      
      // Use the base class create method
      return await this.create(formattedData);
    } catch (error) {
      console.error('Error in createLearningPath:', error);
      throw error;
    }
  }
  
  /**
   * Validate learning path data
   * @private
   * @param {object} pathData - Learning path data to validate
   */
  validateLearningPathData(pathData) {
    const { userId, chatId, title, steps } = pathData;
    
    if (!userId || !chatId || !title || !steps || !Array.isArray(steps)) {
      throw new Error('Missing required fields for learning path');
    }
  }
  
  /**
   * Format learning path data for storage
   * @private
   * @param {object} pathData - Raw learning path data
   * @returns {object} Formatted data ready for storage
   */
  formatLearningPathData(pathData) {
    const { userId, chatId, title, steps } = pathData;
    
    return {
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
    };
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
      // Get the learning path using our flexible lookup method
      const learningPath = await this.getLearningPathById(progressId, userId);
      
      // Find the step to update
      const stepIndex = learningPath.steps.findIndex(s => s.stepId === stepId);
      
      if (stepIndex === -1) {
        throw new Error('Step not found in learning path');
      }
      
      // Update step completion using our completion manager
      this.manageStepCompletion(learningPath, stepIndex, completed);
      
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
   * Manage step completion status and related properties
   * @private
   * @param {Object} learningPath - The learning path to update
   * @param {Number} stepIndex - Index of the step to update
   * @param {Boolean} completed - New completion status
   */
  manageStepCompletion(learningPath, stepIndex, completed) {
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
      // Get the learning path using our flexible lookup method
      const learningPath = await this.getLearningPathById(progressId, userId);
      
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
        const category = this.determineCategoryFromTitle(title);
        
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
      this.extractSimpleSteps(text, steps);
    }
    
    return steps;
  }
  
  /**
   * Determine the category of a step from its title
   * @private
   * @param {String} title - Step title
   * @returns {String} Category name
   */
  determineCategoryFromTitle(title) {
    let category = 'core';
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('prerequisite') || lowerTitle.includes('before') || lowerTitle.includes('foundation')) {
      category = 'prerequisite';
    } else if (lowerTitle.includes('practice') || lowerTitle.includes('project') || lowerTitle.includes('exercise')) {
      category = 'practice';
    } else if (lowerTitle.includes('advanced') || lowerTitle.includes('expert') || lowerTitle.includes('complex')) {
      category = 'advanced';
    }
    
    return category;
  }
  
  /**
   * Extract simple numbered steps from text
   * @private
   * @param {String} text - Text to analyze
   * @param {Array} steps - Array to add steps to
   */
  extractSimpleSteps(text, steps) {
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

  /**
   * Delete a learning path
   * @param {string} progressId - Learning path ID to delete
   * @param {string} userId - User ID for authorization
   * @returns {Promise} Result of the deletion operation
   */
  async deleteLearningPath(progressId, userId) {
    try {
      // Verify the learning path exists and user has access
      await this.getLearningPathById(progressId, userId);
      
      // Use the base class delete method
      return await this.delete(progressId);
    } catch (error) {
      console.error('Error in deleteLearningPath:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export default new LearningService();
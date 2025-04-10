import mongoose from 'mongoose';

/**
 * Base class for all database models
 */
class BaseModel {
  /**
   * Constructor for the base model
   * @param {string} modelName - The name of the model
   * @param {mongoose.Schema} schema - The mongoose schema
   */
  constructor(modelName, schema) {
    if (new.target === BaseModel) {
      throw new Error('BaseModel is an abstract class and cannot be instantiated directly.');
    }
    
    this.modelName = modelName;
    this.schema = schema;
    this.model = mongoose.model(this.modelName, this.schema);
  }
  
  /**
   * Get the mongoose model
   * @returns {mongoose.Model} The mongoose model
   */
  getModel() {
    return this.model;
  }
  
  /**
   * Get the mongoose schema
   * @returns {mongoose.Schema} The mongoose schema
   */
  getSchema() {
    return this.schema;
  }
}

/**
 * ProgressModel - Class representing the learning progress schema and model
 * Extends BaseModel to inherit common functionality
 */
class ProgressModel extends BaseModel {
  /**
   * Constructor for the learning progress model
   */
  constructor() {
    // Create schemas first
    const schemas = ProgressModel.createSchemas();
    
    // Pass the name and schema to the base model constructor
    super('LearningProgress', schemas.learningProgressSchema);
    
    // Store the learning step schema for potential use
    this.learningStepSchema = schemas.learningStepSchema;
  }
  
  /**
   * Create the MongoDB schemas for learning steps and progress
   * @static
   * @returns {Object} Object containing both schemas
   */
  static createSchemas() {
    // Create the learning step schema
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
      notes: String,
      category: {
        type: String,
        enum: ['prerequisite', 'core', 'practice', 'advanced'],
        default: 'core'
      }
    });
    
    // Create the learning progress schema
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
      description: String,
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
      estimatedTimeToComplete: String,
      difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'intermediate'
      }
    });
    
    return { learningStepSchema, learningProgressSchema };
  }
  
  /**
   * Create a new step for a learning path
   * @param {Object} stepData - Step data
   * @returns {Object} Created step object
   */
  createStep(stepData) {
    const { stepId, title, category = 'core' } = stepData;
    
    return {
      stepId,
      title,
      completed: false,
      category
    };
  }
  
  /**
   * Format step data for the database
   * @param {Array} steps - Array of raw step data
   * @returns {Array} Formatted steps
   */
  formatSteps(steps) {
    return steps.map(step => this.createStep({
      stepId: step.id,
      title: step.title,
      category: step.category || 'core'
    }));
  }
}

// Create and export an instance of the model
const progressModel = new ProgressModel();
export default progressModel.getModel();
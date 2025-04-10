import mongoose from 'mongoose';

/**
 * ProgressModel - Class representing the learning progress schema and model
 */
class ProgressModel {
  constructor() {
    this.createSchemas();
    this.createModel();
  }

  /**
   * Creates the MongoDB schemas for learning steps and progress
   */
  createSchemas() {
    this.learningStepSchema = new mongoose.Schema({
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

    this.learningProgressSchema = new mongoose.Schema({
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
      steps: [this.learningStepSchema],
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
  }

  /**
   * Creates the MongoDB model from the schema
   */
  createModel() {
    this.LearningProgress = mongoose.model("LearningProgress", this.learningProgressSchema);
  }

  /**
   * Returns the LearningProgress model
   */
  getModel() {
    return this.LearningProgress;
  }
}

// Create and export an instance of the model
const progressModel = new ProgressModel();
export default progressModel.getModel();
import express from 'express';
import LearningController from '../controllers/LearningController.js';

const router = express.Router();

// Get all learning paths for a user
router.get('/:userId', LearningController.getUserLearningPaths);

// Get a specific learning path
router.get('/path/:progressId', LearningController.getLearningPathById);

// Create a new learning path
router.post('/', LearningController.createLearningPath);

// Update step completion status
router.patch('/:progressId/step', LearningController.updateStepCompletion);

// Add notes to a learning step
router.patch('/:progressId/notes', LearningController.addStepNotes);

export default router;
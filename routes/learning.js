import express from 'express';
import LearningController from '../controllers/LearningController.js';

const router = express.Router();

// Get all learning paths for a user
router.get('/:userId', (req, res) => LearningController.getUserLearningPaths(req, res));

// Get a specific learning path
router.get('/path/:progressId', (req, res) => LearningController.getLearningPathById(req, res));

// Create a new learning path
router.post('/', (req, res) => LearningController.createLearningPath(req, res));

// Update step completion status
router.patch('/:progressId/step', (req, res) => LearningController.updateStepCompletion(req, res));

// Add notes to a learning step
router.patch('/:progressId/notes', (req, res) => LearningController.addStepNotes(req, res));

// Delete a learning path
router.delete('/:progressId', (req, res) => LearningController.deleteLearningPath(req, res));

export default router;
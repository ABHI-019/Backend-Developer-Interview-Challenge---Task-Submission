import { Router, Request, Response } from 'express';
import { TaskService } from '../services/taskService';
import { Database } from '../db/database';
import { validateTaskInput } from '../middleware/validateTask';

export function createTaskRouter(db: Database): Router {
  const router = Router();
  const taskService = new TaskService(db);

  // Get all tasks
  router.get('/', async (req: Request, res: Response) => {
    try {
      const tasks = await taskService.getAllTasks();
      return res.json(tasks);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      return res.status(500).json({ 
        error: 'Failed to fetch tasks', 
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  });

  // Get single task
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const task = await taskService.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ 
          error: 'Task not found', 
          timestamp: new Date().toISOString(),
          path: req.path
        });
      }
      return res.json(task);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      return res.status(500).json({ 
        error: 'Failed to fetch task', 
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  });

  // Create task
  router.post('/', validateTaskInput, async (req: Request, res: Response) => {
    try {
      // Extract task data from request body
      const { title, description } = req.body;
      
      // Create task using the service
      const newTask = await taskService.createTask({
        title,
        description
      });
      
      // Return created task with 201 status code
      res.status(201).json(newTask);
    } catch (error) {
      const e = error as Error;
      res.status(500).json({ 
        error: `Failed to create task: ${e.message}`,
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  });

  // Update task
  router.put('/:id', validateTaskInput, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { title, description, completed } = req.body;
      
      // Call service to update task
      const updatedTask = await taskService.updateTask(id, {
        title,
        description,
        completed
      });
      
      // Handle not found case
      if (!updatedTask) {
        return res.status(404).json({ 
          error: 'Task not found', 
          timestamp: new Date().toISOString(),
          path: req.path
        });
      }
      
      // Return updated task
      return res.json(updatedTask);
    } catch (error) {
      const e = error as Error;
      return res.status(500).json({ 
        error: `Failed to update task: ${e.message}`,
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  });

  // Delete task
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Call service to delete task
      const success = await taskService.deleteTask(id);
      
      // Handle not found case
      if (!success) {
        return res.status(404).json({ 
          error: 'Task not found', 
          timestamp: new Date().toISOString(),
          path: req.path
        });
      }
      
      // Return success with no content
      return res.status(204).send();
    } catch (error) {
      const e = error as Error;
      return res.status(500).json({ 
        error: `Failed to delete task: ${e.message}`,
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  });

  return router;
}
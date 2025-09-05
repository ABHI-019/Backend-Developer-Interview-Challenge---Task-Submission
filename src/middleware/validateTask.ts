import { Request, Response, NextFunction } from 'express';

export function validateTaskInput(req: Request, res: Response, next: NextFunction): void {
  const { title, description, completed } = req.body;

  const errors: string[] = [];

  // Required field validation
  if (!title) {
    errors.push('Title is required');
  } else if (typeof title !== 'string') {
    errors.push('Title must be a string');
  }

  // Optional field validation
  if (description !== undefined && typeof description !== 'string') {
    errors.push('Description must be a string if provided');
  }

  if (completed !== undefined && typeof completed !== 'boolean') {
    errors.push('Completed must be a boolean if provided');
  }

  // Return validation errors if any
  if (errors.length > 0) {
    res.status(400).json({
      error: 'Validation Error',
      details: errors,
      timestamp: new Date().toISOString(),
      path: req.path
    });
    return;
  }

  next();
}

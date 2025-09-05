import { v4 as uuidv4 } from 'uuid';
import { Task } from '../types';
import { Database } from '../db/database';

export class TaskService {
  constructor(private db: Database) {}

  async createTask(taskData: Partial<Task>): Promise<Task> {
    try {
      // 1. Validate required fields
      if (!taskData.title) {
        throw new Error('Title is required');
      }

      if (typeof taskData.title !== 'string') {
        throw new Error('Title must be a string');
      }

      // 2. Generate UUID for the task
      const taskId = uuidv4();

      // 3. Set default values (completed: false, is_deleted: false)
      const newTask: Task = {
        id: taskId,
        title: taskData.title,
        description: taskData.description || '',
        completed: false,  // Default value as per instructions
        created_at: new Date(),
        updated_at: new Date(),
        is_deleted: false, // Default value as per instructions
        // 4. Set sync_status to 'pending'
        sync_status: 'pending',
        server_id: undefined,
        last_synced_at: undefined
      };

      // 4. Insert into database
      const query = `
        INSERT INTO tasks (
          id, title, description, completed, created_at, 
          updated_at, is_deleted, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.run(query, [
        newTask.id,
        newTask.title,
        newTask.description,
        0,  // completed = false
        newTask.created_at.toISOString(),
        newTask.updated_at.toISOString(),
        0,  // is_deleted = false
        'pending'  // sync_status
      ]);

      // 5. Add to sync queue
      const syncQueueQuery = `
        INSERT INTO sync_queue (
          id, task_id, operation, data, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `;

      await this.db.run(syncQueueQuery, [
        uuidv4(),
        newTask.id,
        'create',
        JSON.stringify(newTask),
        new Date().toISOString()
      ]);

      return newTask;
    } catch (error) {
      const e = error as Error;
      console.error('Error creating task:', e);
      throw new Error(`Failed to create task: ${e.message}`);
    }
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    try {
      // 1. Check if task exists and not deleted
      const existingTask = await this.getTask(id);
      if (!existingTask || existingTask.is_deleted) {
        return null;
      }

      // 2. Validate updates
      if ('title' in updates) {
        if (!updates.title) {
          throw new Error('Title cannot be empty');
        }
        if (typeof updates.title !== 'string') {
          throw new Error('Title must be a string');
        }
      }

      if ('description' in updates && typeof updates.description !== 'string') {
        throw new Error('Description must be a string');
      }

      if ('completed' in updates && typeof updates.completed !== 'boolean') {
        throw new Error('Completed must be a boolean');
      }

      // 3. Update updated_at timestamp
      const now = new Date();
      const updateData = {
        ...existingTask,
        ...updates,
        updated_at: now,
        // 4. Set sync_status to 'pending'
        sync_status: 'pending' as const
      };

      // 2. Update task in database
      const query = `
        UPDATE tasks 
        SET title = ?,
            description = ?,
            completed = ?,
            updated_at = ?,
            sync_status = ?
        WHERE id = ?
      `;

      await this.db.run(query, [
        updateData.title,
        updateData.description,
        updateData.completed ? 1 : 0,
        now.toISOString(),
        'pending',
        id
      ]);

      // 5. Add to sync queue
      const syncQueueQuery = `
        INSERT INTO sync_queue (
          id, task_id, operation, data, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `;

      await this.db.run(syncQueueQuery, [
        uuidv4(),
        id,
        'update',
        JSON.stringify(updateData),
        now.toISOString()
      ]);

      return updateData;
    } catch (error) {
      const e = error as Error;
      console.error('Error updating task:', e);
      throw new Error(`Failed to update task: ${e.message}`);
    }
  }

  async deleteTask(id: string): Promise<boolean> {
    try {
      // 1. Check if task exists
      const existingTask = await this.getTask(id);
      if (!existingTask) {
        return false;
      }

      const now = new Date();

      // 2. Set is_deleted to true
      // 3. Update updated_at timestamp
      // 4. Set sync_status to 'pending'
      const query = `
        UPDATE tasks
        SET is_deleted = 1,
            updated_at = ?,
            sync_status = ?
        WHERE id = ?
      `;

      await this.db.run(query, [
        now.toISOString(),  // updated_at timestamp
        'pending',          // sync_status
        id
      ]);

      // 5. Add to sync queue
      const syncQueueQuery = `
        INSERT INTO sync_queue (
          id, task_id, operation, data, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `;

      const deletedTask = {
        ...existingTask,
        is_deleted: true,
        updated_at: now,
        sync_status: 'pending'
      };

      await this.db.run(syncQueueQuery, [
        uuidv4(),
        id,
        'delete',
        JSON.stringify(deletedTask),
        now.toISOString()
      ]);

      return true;
    } catch (error) {
      const e = error as Error;
      console.error('Error deleting task:', e);
      throw new Error(`Failed to delete task: ${e.message}`);
    }
  }

  async getTask(id: string): Promise<Task | null> {
    try {
      // 1. Query database for task by id
      const query = `
        SELECT * FROM tasks
        WHERE id = ? AND is_deleted = 0
      `;

      // 2. Return null if not found or is_deleted is true
      const result = await this.db.get(query, [id]);
      if (!result) {
        return null;
      }

      // Convert SQLite data types to proper JavaScript types
      const typedResult = result as Record<string, unknown>;
      return {
        id: typedResult.id as string,
        title: typedResult.title as string,
        description: typedResult.description as string,
        completed: Boolean(typedResult.completed),
        is_deleted: Boolean(typedResult.is_deleted),
        created_at: new Date(typedResult.created_at as string),
        updated_at: new Date(typedResult.updated_at as string),
        sync_status: typedResult.sync_status as 'pending' | 'synced' | 'error' | undefined,
        server_id: typedResult.server_id as string | undefined,
        last_synced_at: typedResult.last_synced_at ? new Date(typedResult.last_synced_at as string) : undefined
      };
    } catch (error) {
      const e = error as Error;
      console.error('Error fetching task:', e);
      throw new Error(`Failed to fetch task: ${e.message}`);
    }
  }

  async getAllTasks(): Promise<Task[]> {
    try {
      // 1. Query database for all tasks where is_deleted = false
      const query = `
        SELECT * FROM tasks
        WHERE is_deleted = 0
        ORDER BY created_at DESC
      `;

      // 2. Return array of tasks
      const results = await this.db.all(query);
      return results.map(task => {
        const typedTask = task as Record<string, unknown>;
        return {
          id: typedTask.id as string,
          title: typedTask.title as string,
          description: typedTask.description as string,
          completed: Boolean(typedTask.completed),
          is_deleted: Boolean(typedTask.is_deleted),
          created_at: new Date(typedTask.created_at as string),
          updated_at: new Date(typedTask.updated_at as string),
          sync_status: typedTask.sync_status as 'pending' | 'synced' | 'error' | undefined,
          server_id: typedTask.server_id as string | undefined,
          last_synced_at: typedTask.last_synced_at ? new Date(typedTask.last_synced_at as string) : undefined
        };
      });
    } catch (error) {
      const e = error as Error;
      console.error('Error fetching all tasks:', e);
      throw new Error(`Failed to fetch tasks: ${e.message}`);
    }
  }

  async getTasksNeedingSync(): Promise<Task[]> {
    try {
      // Get all tasks where sync_status is 'pending' or 'error' and not deleted
      const query = `
        SELECT * FROM tasks
        WHERE sync_status IN ('pending', 'error')
        AND is_deleted = 0
        ORDER BY updated_at DESC
      `;

      // Return array of tasks needing sync
      const results = await this.db.all(query);
      return results.map(task => {
        const typedTask = task as Record<string, unknown>;
        return {
          id: typedTask.id,
          title: typedTask.title,
          description: typedTask.description,
          completed: Boolean(typedTask.completed),
          is_deleted: Boolean(typedTask.is_deleted),
          created_at: new Date(typedTask.created_at as string),
          updated_at: new Date(typedTask.updated_at as string),
          sync_status: typedTask.sync_status as 'pending' | 'synced' | 'error' | undefined,
          server_id: typedTask.server_id,
          last_synced_at: typedTask.last_synced_at ? new Date(typedTask.last_synced_at as string) : undefined
        } as Task;
      });
    } catch (error) {
      const e = error as Error;
      console.error('Error fetching tasks needing sync:', e);
      throw new Error(`Failed to fetch tasks needing sync: ${e.message}`);
    }
  }
}
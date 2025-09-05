import { Router, Request, Response } from 'express';
import { SyncService } from '../services/syncService';
import { TaskService } from '../services/taskService';
import { Database } from '../db/database';
import { BatchSyncRequest, BatchSyncResponse } from '../types';

export function createSyncRouter(db: Database): Router {
  const router = Router();
  const taskService = new TaskService(db);
  const syncService = new SyncService(db, taskService);

  // Trigger manual sync
  router.post('/sync', async (req: Request, res: Response) => {
    try {
      // 1. Check connectivity first
      const isOnline = await syncService.checkConnectivity();
      
      if (!isOnline) {
        return res.status(503).json({ 
          error: 'Server is currently offline', 
          timestamp: new Date().toISOString(), 
          path: req.path 
        });
      }
      
      // 2. Call syncService.sync()
      const syncResult = await syncService.sync();
      
      // 3. Return sync result
      return res.json(syncResult);
    } catch (error) {
      const e = error as Error;
      return res.status(500).json({ 
        error: `Sync failed: ${e.message}`, 
        timestamp: new Date().toISOString(), 
        path: req.path 
      });
    }
  });

  // Check sync status
  router.get('/status', async (req: Request, res: Response) => {
    try {
      // 1. Get pending sync count
      const pendingSyncQuery = `
        SELECT COUNT(*) as count FROM sync_queue
      `;
      const pendingResult = await db.get(pendingSyncQuery);
      const pendingSyncCount = pendingResult ? pendingResult.count : 0;
      
      // 2. Get last sync timestamp
      const lastSyncQuery = `
        SELECT MAX(last_synced_at) as last_sync FROM tasks
        WHERE sync_status = 'synced'
      `;
      const lastSyncResult = await db.get<{last_sync: string | null}>(lastSyncQuery);
      const lastSyncTimestamp = lastSyncResult && lastSyncResult.last_sync 
        ? new Date(lastSyncResult.last_sync as string) 
        : null;
      
      // 3. Check connectivity
      const isOnline = await syncService.checkConnectivity();
      
      // 4. Return status summary
      return res.json({
        pending_sync_count: pendingSyncCount,
        last_sync_timestamp: lastSyncTimestamp,
        is_online: isOnline,
        sync_queue_size: pendingSyncCount
      });
    } catch (error) {
      const e = error as Error;
      return res.status(500).json({ 
        error: `Failed to get sync status: ${e.message}`, 
        timestamp: new Date().toISOString(), 
        path: req.path 
      });
    }
  });

  // Batch sync endpoint (for server-side)
  router.post('/batch', async (req: Request, res: Response) => {
    try {
      // Validate request body
      const batchRequest = req.body as BatchSyncRequest;
      
      if (!batchRequest || !batchRequest.items || !Array.isArray(batchRequest.items)) {
        return res.status(400).json({ 
          error: 'Invalid batch request format', 
          timestamp: new Date().toISOString(), 
          path: req.path 
        });
      }
      
      // Process each item in the batch
      const processedItems = [];
      
      for (const item of batchRequest.items) {
        try {
          let result;
          
          // Process based on operation type
          switch (item.operation) {
            case 'create':
              // Create a new task on the server
              const serverTask = await taskService.createTask(item.data);
              result = {
                client_id: item.task_id,
                server_id: serverTask.id,
                status: 'success' as const,
                resolved_data: serverTask
              };
              break;
              
            case 'update':
              // Update an existing task
              if (item.data.id) {
                const updatedTask = await taskService.updateTask(item.data.id, item.data);
                result = {
                  client_id: item.task_id,
                  server_id: item.data.id,
                  status: updatedTask ? 'success' as const : 'error' as const,
                  resolved_data: updatedTask || undefined,
                  error: updatedTask ? undefined : 'Task not found'
                };
              } else {
                result = {
                  client_id: item.task_id,
                  server_id: '',
                  status: 'error' as const,
                  error: 'Missing task ID for update operation'
                };
              }
              break;
              
            case 'delete':
              // Delete a task
              if (item.data.id) {
                const success = await taskService.deleteTask(item.data.id);
                result = {
                  client_id: item.task_id,
                  server_id: item.data.id,
                  status: success ? 'success' as const : 'error' as const,
                  error: success ? undefined : 'Task not found'
                };
              } else {
                result = {
                  client_id: item.task_id,
                  server_id: '',
                  status: 'error' as const,
                  error: 'Missing task ID for delete operation'
                };
              }
              break;
              
            default:
              result = {
                client_id: item.task_id,
                server_id: '',
                status: 'error' as const,
                error: `Unknown operation: ${item.operation}`
              };
          }
          
          processedItems.push(result);
        } catch (error) {
          const e = error as Error;
          processedItems.push({
            client_id: item.task_id,
            server_id: '',
            status: 'error' as const,
            error: e.message
          });
        }
      }
      
      // Return batch response
      const response: BatchSyncResponse = {
        processed_items: processedItems as BatchSyncResponse['processed_items']
      };
      
      return res.json(response);
    } catch (error) {
      const e = error as Error;
      return res.status(500).json({ 
        error: `Batch processing failed: ${e.message}`, 
        timestamp: new Date().toISOString(), 
        path: req.path 
      });
    }
  });

  // Health check endpoint
  router.get('/health', async (_req: Request, res: Response) => {
    return res.json({ status: 'ok', timestamp: new Date() });
  });

  return router;
}
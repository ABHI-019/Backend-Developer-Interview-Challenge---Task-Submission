import axios from 'axios';
import { Task, SyncQueueItem, SyncResult, BatchSyncRequest, BatchSyncResponse } from '../types';
import { Database } from '../db/database';
import { TaskService } from './taskService';

export class SyncService {
  private apiUrl: string;
  
  constructor(
    private db: Database,
    private taskService: TaskService,
    apiUrl: string = process.env.API_BASE_URL || 'http://localhost:3000/api'
  ) {
    this.apiUrl = apiUrl;
  }

  async sync(): Promise<SyncResult> {
    let items: SyncQueueItem[] = [];
    
    try {
      // Check connectivity before starting sync
      if (!await this.checkConnectivity()) {
        throw new Error('No connection to server');
      }

      // 1. Get all items from sync queue
      const query = `
        SELECT * FROM sync_queue
        ORDER BY created_at ASC
      `;
      items = await this.db.all(query);

      if (items.length === 0) {
        return {
          success: true,
          synced_items: 0,
          failed_items: 0,
          errors: []
        };
      }

      // 2. Group items by batch (use SYNC_BATCH_SIZE from env)
      const BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE || '50');
      const batches: SyncQueueItem[][] = [];
      
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        batches.push(items.slice(i, i + BATCH_SIZE));
      }

      // Initialize result tracking
      let syncedItems = 0;
      let failedItems = 0;
      const errors: { task_id: string; operation: string; error: string; timestamp: Date }[] = [];

      // 3. Process each batch
      for (const batch of batches) {
        try {
          const batchResult = await this.processBatch(batch);
          
          // 4. Handle success/failure for each item
          for (const item of batchResult.processed_items) {
            // 5. Update sync status in database
            await this.updateSyncStatus(
              item.client_id,
              'synced',
              { server_id: item.server_id }
            );
            syncedItems++;
          }
        } catch (error) {
          const e = error as Error;
          failedItems += batch.length;
          
          // Handle errors for each item in failed batch
          for (const item of batch) {
            errors.push({
              task_id: item.task_id,
              operation: item.operation,
              error: e.message,
              timestamp: new Date()
            });
            await this.handleSyncError(item, e);
          }
        }
      }

      // 6. Return sync result summary
      return {
        success: failedItems === 0,
        synced_items: syncedItems,
        failed_items: failedItems,
        errors
      };
    } catch (error) {
      const e = error as Error;
      console.error('Sync failed:', e);
      return {
        success: false,
        synced_items: 0,
        failed_items: items?.length || 0,
        errors: [{
          task_id: 'SYNC_PROCESS',
          operation: 'sync',
          error: e.message,
          timestamp: new Date()
        }]
      };
    }
  }

  async addToSyncQueue(taskId: string, operation: 'create' | 'update' | 'delete', data: Partial<Task>): Promise<void> {
    try {
      // 1. Create sync queue item
      const syncItem: SyncQueueItem = {
        id: Math.random().toString(36).substring(7), // Simple ID generation
        task_id: taskId,
        operation: operation,
        data: data,
        created_at: new Date(),
        retry_count: 0
      };

      // 2. Store serialized task data
      const serializedData = JSON.stringify(data);

      // 3. Insert into sync_queue table
      const query = `
        INSERT INTO sync_queue (
          id, task_id, operation, data, created_at, retry_count
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      await this.db.run(query, [
        syncItem.id,
        syncItem.task_id,
        syncItem.operation,
        serializedData,
        syncItem.created_at.toISOString(),
        syncItem.retry_count
      ]);
    } catch (error) {
      const e = error as Error;
      console.error('Error adding to sync queue:', e);
      throw new Error(`Failed to add to sync queue: ${e.message}`);
    }
  }

  private async processBatch(items: SyncQueueItem[]): Promise<BatchSyncResponse> {
    try {
      // 1. Prepare batch request
      const batchRequest: BatchSyncRequest = {
        items,
        client_timestamp: new Date()
      };

      // 2. Send to server
      const response = await axios.post<BatchSyncResponse>(
        `${this.apiUrl}/batch`,
        batchRequest
      );

      // 3. Handle response
      const processedItems = response.data.processed_items;
      
      // 4. Apply conflict resolution if needed
      for (const processedItem of processedItems) {
        const localTask = await this.taskService.getTask(processedItem.client_id);
        
        if (localTask && processedItem.resolved_data) {
          // Handle potential conflicts
          const resolvedTask = await this.resolveConflict(
            localTask,
            processedItem.resolved_data as Task
          );

          // Update local task with resolved data
          await this.updateSyncStatus(
            processedItem.client_id,
            'synced',
            {
              server_id: processedItem.server_id,
              ...resolvedTask
            }
          );
        }
      }

      return response.data;
    } catch (error) {
      const e = error as Error;
      console.error('Error processing batch:', e);
      
      // Handle individual item errors
      for (const item of items) {
        await this.handleSyncError(item, e);
      }
      
      throw new Error(`Failed to process batch: ${e.message}`);
    }
  }

  private async resolveConflict(localTask: Task, serverTask: Task): Promise<Task> {
    try {
      // 1. Compare updated_at timestamps
      const localTimestamp = new Date(localTask.updated_at).getTime();
      const serverTimestamp = new Date(serverTask.updated_at).getTime();

      // 2. Return the more recent version (last-write-wins)
      const winningTask = localTimestamp > serverTimestamp ? localTask : serverTask;

      // 3. Log conflict resolution decision
      console.log(`Conflict resolved for task ${localTask.id}:`, {
        strategy: 'last-write-wins',
        winner: localTimestamp > serverTimestamp ? 'local' : 'server',
        localTimestamp: new Date(localTimestamp).toISOString(),
        serverTimestamp: new Date(serverTimestamp).toISOString()
      });

      return {
        ...winningTask,
        sync_status: 'synced',
        last_synced_at: new Date()
      };
    } catch (error) {
      const e = error as Error;
      console.error('Error resolving conflict:', e);
      throw new Error(`Failed to resolve conflict: ${e.message}`);
    }
  }

  private async updateSyncStatus(taskId: string, status: 'synced' | 'error', serverData?: Partial<Task>): Promise<void> {
    try {
      // 1. Update sync_status field and 3. Update last_synced_at timestamp
      const query = `
        UPDATE tasks
        SET sync_status = ?,
            last_synced_at = ?
            ${serverData?.server_id ? ', server_id = ?' : ''}
        WHERE id = ?
      `;

      const now = new Date().toISOString();
      const params = serverData?.server_id
        ? [status, now, serverData.server_id, taskId]
        : [status, now, taskId];

      await this.db.run(query, params);

      // 4. Remove from sync queue if successful
      if (status === 'synced') {
        const deleteQuery = `
          DELETE FROM sync_queue
          WHERE task_id = ?
        `;
        await this.db.run(deleteQuery, [taskId]);
      }

      // Log the sync status update
      console.log(`Updated sync status for task ${taskId}:`, {
        status,
        timestamp: now,
        server_id: serverData?.server_id
      });
    } catch (error) {
      const e = error as Error;
      console.error('Error updating sync status:', e);
      throw new Error(`Failed to update sync status: ${e.message}`);
    }
  }

  private async handleSyncError(item: SyncQueueItem, error: Error): Promise<void> {
    const MAX_RETRIES = 3; // As per requirements

    try {
      // 1. Increment retry count
      const newRetryCount = item.retry_count + 1;

      // 2. Store error message
      const query = `
        UPDATE sync_queue 
        SET retry_count = ?,
            error_message = ?
        WHERE id = ?
      `;

      await this.db.run(query, [
        newRetryCount,
        error.message,
        item.id
      ]);

      // 3. If retry count exceeds limit, mark as permanent failure
      if (newRetryCount >= MAX_RETRIES) {
        await this.updateSyncStatus(
          item.task_id,
          'error',
          { sync_status: 'error' }
        );

        // Log permanent failure
        console.error(`Sync permanently failed for task ${item.task_id} after ${MAX_RETRIES} attempts:`, error);
      }
    } catch (e) {
      const err = e as Error;
      console.error('Error handling sync error:', err);
      throw new Error(`Failed to handle sync error: ${err.message}`);
    }
  }

  async checkConnectivity(): Promise<boolean> {
    // TODO: Check if server is reachable
    // 1. Make a simple health check request
    // 2. Return true if successful, false otherwise
    try {
      await axios.get(`${this.apiUrl}/health`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}
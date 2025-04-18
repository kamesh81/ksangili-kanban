import { useState } from 'react';
import { Task, TaskStatus, TaskPriority, KanbanColumn } from '@/types/kanban';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

// Helper function to map tasks from Supabase
export const mapTaskFromSupabase = (task: any): Task => {
  return {
    id: task.id.toString(),
    title: task.title,
    description: task.description,
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority,
    createdAt: new Date(task.created_at),
    owner: task.owner || null,
    dueDate: task.due_date ? new Date(task.due_date) : new Date(Date.now() + 86400000), // Default to tomorrow if not set
  };
};

// Helper function to sort tasks by due date in ascending order
const sortTasksByDueDate = (tasks: Task[]): Task[] => {
  return [...tasks].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
};

export const useKanbanTasks = (userId: string | undefined, boardId: string | undefined) => {
  const [columns, setColumns] = useState<KanbanColumn[]>([
    { id: 'backlog', title: 'Backlog', tasks: [] },
    { id: 'todo', title: 'To Do', tasks: [] },
    { id: 'in-progress', title: 'In Progress', tasks: [] },
    { id: 'done', title: 'Done', tasks: [] },
  ]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    if (!userId) {
      console.log('No user found, skipping task fetch');
      setColumns([
        { id: 'backlog', title: 'Backlog', tasks: [] },
        { id: 'todo', title: 'To Do', tasks: [] },
        { id: 'in-progress', title: 'In Progress', tasks: [] },
        { id: 'done', title: 'Done', tasks: [] },
      ]);
      return;
    }

    setLoading(true);
    try {
      console.log('Fetching tasks for user:', userId, 'board:', boardId || 'all boards');
      
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId);
      
      // If we have a board ID, filter by it
      if (boardId) {
        query = query.eq('board_id', boardId);
      }
      
      const { data, error } = await query;

      if (error) throw error;

      console.log('Tasks fetched:', data?.length || 0);
      
      // Group tasks by status and sort by due date
      const backlogTasks = sortTasksByDueDate(
        data?.filter(task => task.status === 'backlog')
          .map(mapTaskFromSupabase) || []
      );
      
      const todoTasks = sortTasksByDueDate(
        data?.filter(task => task.status === 'todo')
          .map(mapTaskFromSupabase) || []
      );
      
      const inProgressTasks = sortTasksByDueDate(
        data?.filter(task => task.status === 'in-progress')
          .map(mapTaskFromSupabase) || []
      );
      
      const doneTasks = sortTasksByDueDate(
        data?.filter(task => task.status === 'done')
          .map(mapTaskFromSupabase) || []
      );
      
      setColumns([
        { id: 'backlog', title: 'Backlog', tasks: backlogTasks },
        { id: 'todo', title: 'To Do', tasks: todoTasks },
        { id: 'in-progress', title: 'In Progress', tasks: inProgressTasks },
        { id: 'done', title: 'Done', tasks: doneTasks },
      ]);
    } catch (error: any) {
      console.error('Error fetching tasks:', error.message);
      toast({
        title: "Error fetching tasks",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (title: string, description: string, status: TaskStatus, priority: TaskPriority, dueDate: Date, owner: string | null) => {
    if (!userId) {
      console.error('Cannot add task: No user logged in.');
      toast({
        title: "Authentication required",
        description: "You must be logged in to add tasks",
        variant: "destructive"
      });
      return;
    }

    try {
      const taskData = {
        title,
        description,
        status,
        priority,
        created_at: new Date().toISOString(),
        due_date: dueDate.toISOString(),
        owner: owner || null,
        user_id: userId,
        board_id: boardId || null
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();

      if (error) throw error;
      
      if (data) {
        const newTask = mapTaskFromSupabase(data);
        
        setColumns(prevColumns => {
          const updatedColumns = prevColumns.map(column => {
            if (column.id === status) {
              return { ...column, tasks: [...column.tasks, newTask] };
            } else {
              return column;
            }
          });
          return updatedColumns;
        });
      }
    } catch (error: any) {
      console.error('Error adding task:', error.message);
      toast({
        title: "Error adding task",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const updateTaskStatus = async (id: string, newStatus: TaskStatus) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', parseInt(id));

      if (error) throw error;

      setColumns(prevColumns => {
        const updatedColumns = prevColumns.map(column => ({
          ...column,
          tasks: column.tasks.filter(task => task.id !== id),
        })).map(column => {
          if (column.id === newStatus) {
            const taskToUpdate = prevColumns
              .flatMap(col => col.tasks)
              .find(task => task.id === id);
            
            if (taskToUpdate) {
              return { ...column, tasks: [...column.tasks, { ...taskToUpdate, status: newStatus }] };
            }
          }
          return column;
        });
        return updatedColumns;
      });
    } catch (error: any) {
      console.error('Error updating task status:', error.message);
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const updateTaskDetails = async (id: string, title: string, description: string, priority: TaskPriority, dueDate: Date, owner: string | null) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          title, 
          description, 
          priority, 
          due_date: dueDate.toISOString(),
          owner 
        })
        .eq('id', parseInt(id));
  
      if (error) throw error;
  
      setColumns(prevColumns => {
        const updatedColumns = prevColumns.map(column => {
          const updatedTasks = column.tasks.map(task => {
            if (task.id === id) {
              return { ...task, title, description, priority, dueDate, owner };
            }
            return task;
          });
          
          // Resort tasks by due date after updating
          return { 
            ...column, 
            tasks: sortTasksByDueDate(updatedTasks)
          };
        });
        return updatedColumns;
      });
    } catch (error: any) {
      console.error('Error updating task details:', error.message);
      toast({
        title: "Error updating task details",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteTask = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', parseInt(id));

      if (error) throw error;

      setColumns(prevColumns => {
        const updatedColumns = prevColumns.map(column => ({
          ...column,
          tasks: column.tasks.filter(task => task.id !== id),
        }));
        return updatedColumns;
      });
    } catch (error: any) {
      console.error('Error deleting task:', error.message);
      toast({
        title: "Error deleting task",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Enhanced moveTask function to support targeted indexes
  const moveTask = async (id: string, newStatus: TaskStatus, targetIndex?: number) => {
    try {
      // Find the task in current columns
      let movedTask: Task | undefined;
      let sourceColumn: string | undefined;
      
      // First, update the task in the database
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', parseInt(id));

      if (error) throw error;

      // Then update the local state
      setColumns(prevColumns => {
        // Find the task that's being moved and its source column
        prevColumns.forEach(column => {
          const taskIndex = column.tasks.findIndex(task => task.id === id);
          if (taskIndex !== -1) {
            movedTask = { ...column.tasks[taskIndex], status: newStatus };
            sourceColumn = column.id;
          }
        });

        if (!movedTask) {
          console.error('Task not found for moving:', id);
          return prevColumns;
        }

        // Create new columns with the task removed from its source
        const columnsWithoutTask = prevColumns.map(column => ({
          ...column,
          tasks: column.tasks.filter(task => task.id !== id)
        }));

        // Add the task to the target column at the specified index
        return columnsWithoutTask.map(column => {
          if (column.id === newStatus) {
            const newTasks = [...column.tasks];
            
            // Insert at specific position if provided, otherwise add to the end
            if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= newTasks.length) {
              newTasks.splice(targetIndex, 0, movedTask!);
            } else {
              newTasks.push(movedTask!);
            }
            
            return { ...column, tasks: newTasks };
          }
          return column;
        });
      });

    } catch (error: any) {
      console.error('Error moving task:', error.message);
      toast({
        title: "Error moving task",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return {
    columns,
    loading,
    fetchTasks,
    addTask,
    updateTaskStatus,
    updateTaskDetails,
    deleteTask,
    moveTask,
  };
};

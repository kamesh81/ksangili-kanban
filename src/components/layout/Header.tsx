
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderPlus, Plus, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { HeaderMenu } from './HeaderMenu';

export function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [boards, setBoards] = useState<any[]>([]);
  const [sharedBoards, setSharedBoards] = useState<any[]>([]);
  const [showAllBoards, setShowAllBoards] = useState(false);

  // Fetch user's boards when dropdown opens
  const handleDropdownOpen = async (open: boolean) => {
    if (open && user) {
      setIsLoading(true);
      try {
        // Fetch boards owned by the user
        const { data: ownedBoards, error: ownedError } = await supabase
          .from('boards')
          .select('id, name')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(5);

        if (ownedError) throw ownedError;
        
        // Fetch boards shared with the user (where user is a member but not owner)
        const { data: memberBoards, error: memberError } = await supabase
          .from('board_members')
          .select('board_id, boards:board_id(id, name)')
          .eq('user_id', user.id)
          .neq('role', 'owner')
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (memberError) throw memberError;

        // Format shared boards data
        const formattedSharedBoards = memberBoards?.map((item: any) => ({
          id: item.boards.id,
          name: item.boards.name,
        })) || [];

        setBoards(ownedBoards || []);
        setSharedBoards(formattedSharedBoards);
      } catch (error) {
        console.error('Error fetching boards:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your boards',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const createNewBoard = async () => {
    if (!user) {
      // If user is not authenticated, redirect to auth page
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create a board.',
      });
      navigate('/auth');
      return;
    }
    
    try {
      setIsCreatingBoard(true);
      const newBoard = {
        user_id: user.id,
        name: 'New Board',
        description: 'Click to edit this board',
      };
      
      console.log('Creating new board with user_id:', user.id);
      
      const { data, error } = await supabase
        .from('boards')
        .insert(newBoard)
        .select()
        .single();
      
      if (error) {
        console.error('Supabase error creating board:', error);
        throw error;
      }
      
      toast({
        title: 'Board created',
        description: 'Your new board has been created successfully.',
      });
      
      // Navigate to the new board
      if (data) {
        console.log('Board created successfully:', data);
        navigate(`/board/${data.id}`);
      }
    } catch (error: any) {
      console.error('Error creating board:', error);
      toast({
        title: 'Error creating board',
        description: `Unable to create a new board: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingBoard(false);
    }
  };

  return (
    <header className="border-b bg-white z-10">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="text-lg font-bold text-primary">
          Kanban Board
        </Link>

        {user && (
          <div className="flex items-center gap-2 z-20">
            <DropdownMenu onOpenChange={handleDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <FolderPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">My Boards</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 z-50 bg-white">
                <DropdownMenuLabel>My Boards</DropdownMenuLabel>
                {isLoading ? (
                  <div className="py-2 px-2 text-center">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                  </div>
                ) : (
                  <>
                    {boards.length > 0 ? (
                      <DropdownMenuGroup>
                        {boards.slice(0, showAllBoards ? undefined : 5).map(board => (
                          <DropdownMenuItem key={board.id} asChild>
                            <Link to={`/board/${board.id}`} className="cursor-pointer w-full">
                              {board.name}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                        {boards.length > 5 && !showAllBoards && (
                          <DropdownMenuItem onClick={() => setShowAllBoards(true)}>
                            Show all boards...
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuGroup>
                    ) : (
                      <div className="py-2 px-2 text-sm text-gray-500">No personal boards</div>
                    )}

                    {sharedBoards.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Shared with me</DropdownMenuLabel>
                        <DropdownMenuGroup>
                          {sharedBoards.map(board => (
                            <DropdownMenuItem key={board.id} asChild>
                              <Link to={`/board/${board.id}`} className="cursor-pointer w-full">
                                {board.name}
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      </>
                    )}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={createNewBoard} disabled={isCreatingBoard}>
                  <Plus className="mr-2 h-4 w-4" />
                  {isCreatingBoard ? 'Creating...' : 'New Board'}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="w-full">
                    <Settings className="mr-2 h-4 w-4" />
                    Manage All Boards
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <HeaderMenu />
          </div>
        )}
      </div>
    </header>
  );
}

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { GroundingChunk } from '../services/geminiService';

interface FavoritesContextType {
  favorites: GroundingChunk[];
  isFavorite: (id: string | undefined) => boolean;
  toggleFavorite: (chunk: GroundingChunk) => void;
  isLoading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setIsAuthModalOpen } = useAuth();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<GroundingChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load favorites when user changes
  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }

    setIsLoading(true);
    try {
      const storageKey = `vidalocal_favorites_${user.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setFavorites(JSON.parse(saved));
      } else {
        setFavorites([]);
      }
    } catch (err) {
      console.error('[Favorites] Failed to load favorites from localStorage:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const isFavorite = useCallback((id: string | undefined) => {
    if (!id) return false;
    return favorites.some(fav => fav.maps?.id === id || fav.maps?.short_id === id);
  }, [favorites]);

  const toggleFavorite = useCallback((chunk: GroundingChunk) => {
    if (!user) {
      // Prompt user to log in if they try to save a favorite
      toast.warning('Você precisa estar conectado para salvar favoritos!');
      setIsAuthModalOpen(true);
      return;
    }

    const mapsData = chunk.maps;
    if (!mapsData) return;

    const targetId = mapsData.id || mapsData.short_id;
    if (!targetId) return;

    setFavorites((prev) => {
      const isAlreadyFav = prev.some(fav => fav.maps?.id === targetId || fav.maps?.short_id === targetId);
      let updated: GroundingChunk[];

      if (isAlreadyFav) {
        updated = prev.filter(fav => fav.maps?.id !== targetId && fav.maps?.short_id !== targetId);
        toast.info(`"${mapsData.title}" removido dos favoritos.`);
      } else {
        updated = [...prev, chunk];
        toast.success(`"${mapsData.title}" salvo nos favoritos! ❤️`);
      }

      // Sync with localStorage
      try {
        const storageKey = `vidalocal_favorites_${user.id}`;
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (err) {
        console.error('[Favorites] Failed to sync favorites to localStorage:', err);
      }

      return updated;
    });
  }, [user, toast, setIsAuthModalOpen]);

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, isLoading }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

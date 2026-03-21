import React, { useState, useRef } from 'react';
import { Camera, Search, Upload, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SearchHeroProps {
  onSearch: (query: string, image?: string) => void;
  isSearching: boolean;
}

export const SearchHero: React.FC<SearchHeroProps> = ({ onSearch, isSearching }) => {
  const [query, setQuery] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() || image) {
      onSearch(query, image || undefined);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-20 text-center">
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="serif text-5xl md:text-7xl font-light mb-8 tracking-tight text-ink"
      >
        The Curator
      </motion.h1>
      <motion.p 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-muted uppercase tracking-widest text-xs mb-12"
      >
        Global Antique Aggregator & Visual Search
      </motion.p>

      <form onSubmit={handleSubmit} className="relative group">
        <div className="relative flex items-center bg-white border border-border-custom rounded-full p-2 shadow-sm focus-within:shadow-md transition-shadow">
          <div className="pl-6 pr-4">
            <Search className="w-5 h-5 text-muted/40" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe the piece you seek..."
            className="flex-1 bg-transparent border-none outline-none py-4 text-lg placeholder:text-muted/20 text-ink"
          />
          
          <div className="flex items-center gap-2 pr-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-full hover:bg-paper transition-colors text-muted"
              title="Upload Image"
            >
              <Camera className="w-5 h-5" />
            </button>
            <button
              type="submit"
              disabled={isSearching}
              className="bg-ink text-paper px-8 py-3 rounded-full font-medium hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        <AnimatePresence>
          {image && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute -bottom-32 left-1/2 -translate-x-1/2 bg-white p-2 rounded-xl shadow-xl border border-border-custom"
            >
              <div className="relative w-24 h-24 rounded-lg overflow-hidden">
                <img src={image} alt="Upload preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute top-1 right-1 bg-ink/80 text-white p-1 rounded-full hover:bg-ink"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
};

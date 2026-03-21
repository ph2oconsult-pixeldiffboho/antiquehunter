import React from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { Bell, ExternalLink, Info } from 'lucide-react';

interface ResultsViewProps {
  results: string;
  groundingChunks: any[];
  onSetAlert: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ results, groundingChunks, onSetAlert }) => {
  return (
    <div className="max-w-4xl mx-auto px-6 pb-20">
      <div className="flex justify-between items-center mb-12 border-b border-border-custom pb-6">
        <h2 className="serif text-3xl font-light text-ink">Curator's Findings</h2>
        <button
          onClick={onSetAlert}
          className="flex items-center gap-2 px-6 py-3 rounded-full border border-border-custom hover:bg-ink hover:text-paper transition-all group"
        >
          <Bell className="w-4 h-4 group-hover:animate-bounce" />
          <span className="text-sm font-medium">Set Alert</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="prose prose-ink max-w-none prose-headings:serif prose-headings:font-light prose-p:leading-relaxed prose-p:text-ink/80"
          >
            <ReactMarkdown>{results}</ReactMarkdown>
          </motion.div>
        </div>

        <div className="space-y-8">
          {groundingChunks.length > 0 && (
            <div className="bg-white p-8 rounded-3xl border border-border-custom shadow-sm">
              <div className="flex items-center gap-2 mb-6 text-muted">
                <Info className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-widest font-semibold">Verified Sources</span>
              </div>
              <div className="space-y-4">
                {groundingChunks.map((chunk, i) => (
                  <a
                    key={i}
                    href={chunk.web?.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group p-4 rounded-2xl hover:bg-paper transition-colors border border-transparent hover:border-border-custom"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium line-clamp-2 group-hover:text-gold transition-colors">
                          {chunk.web?.title}
                        </p>
                        <p className="text-[10px] text-muted mt-1 truncate">
                          {new URL(chunk.web?.uri).hostname}
                        </p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-muted/40 group-hover:text-ink transition-colors" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gold/5 p-8 rounded-3xl border border-gold/10">
            <h3 className="serif text-xl mb-4 text-ink">Can't find it?</h3>
            <p className="text-sm text-muted leading-relaxed mb-6">
              Our global network of curators and auction houses is constantly updating. Set an alert and we'll notify you the moment it appears.
            </p>
            <button
              onClick={onSetAlert}
              className="w-full py-4 bg-gold text-ink rounded-full font-medium hover:opacity-90 transition-colors shadow-lg shadow-gold/20"
            >
              Set Global Alert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

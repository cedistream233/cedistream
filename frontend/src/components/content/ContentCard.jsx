import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, ShoppingCart, Music2 } from "lucide-react";
import { motion } from "framer-motion";

export default function ContentCard({ item, type, onAddToCart, onViewDetails }) {
  const image = type === "album" ? item.cover_image : item.thumbnail;
  const title = item.title;
  const creator = type === "album" ? item.artist : item.creator;
  const price = item.price;

  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="group relative overflow-hidden bg-slate-900/50 border-purple-900/20 hover:border-purple-500/50 backdrop-blur-sm transition-all duration-300">
        <CardContent className="p-0">
          <div className="relative aspect-square overflow-hidden">
            {image ? (
              <img
                src={image}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center">
                {type === "album" ? (
                  <Music2 className="w-16 h-16 text-purple-300" />
                ) : (
                  <Play className="w-16 h-16 text-purple-300" />
                )}
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                <Button
                  onClick={onViewDetails}
                  className="flex-1 bg-white/90 text-black hover:bg-white"
                >
                  View Details
                </Button>
                <Button
                  onClick={onAddToCart}
                  size="icon"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <ShoppingCart className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4">
            <h3 className="font-semibold text-white truncate mb-1">{title}</h3>
            <p className="text-sm text-gray-400 truncate mb-3">{creator}</p>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-yellow-400">
                GH₵ {price?.toFixed(2)}
              </span>
              {type === "album" && item.songs?.length > 0 && (
                <span className="text-xs text-gray-500">
                  {item.songs.length} tracks
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
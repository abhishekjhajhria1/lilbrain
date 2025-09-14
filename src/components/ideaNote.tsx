"use client";

import React, { useState, useRef, useEffect } from "react";
import Draggable, { DraggableEvent, DraggableData } from "react-draggable";
import { doc, deleteDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";

// An array of available color options
const COLORS = ["yellow", "blue", "green", "pink", "purple"];

// The TypeScript type for an Idea object
export type Idea = {
  id: string;
  text: string;
  authorName: string;
  authorPhotoURL: string; // CORRECTED: This field is 'authorPhotoURL' in Firestore
  position: { x: number; y: number };
  createdAt: Timestamp;
  color?: string; // Color is optional
};

// The type for the props our component accepts
type IdeaNoteProps = {
  idea: Idea;
  roomId: string;
};
// have to look here later 
const useDebounceEffect = (effect: () => void, deps: React.DependencyList, delay:number ) => {
  const callbackRef = useRef(effect);

  useEffect(() => {
    callbackRef.current = effect;
  }, [effect]);

  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    const handler = setTimeout(() => callbackRef.current(), delay);
    return () => clearTimeout(handler);
  }, [depsKey, delay]);
};

export default function IdeaNote({ idea, roomId }: IdeaNoteProps) {
  // State for managing editing mode
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(idea.text);

  const nodeRef = useRef(null);

  // A direct reference to this idea's document in Firestore
  const ideaDocRef = doc(db, "rooms", roomId, "ideas", idea.id);

  const [internalPosition, setInternalPosition] = useState(idea.position);

  const handleWritePosition = (pos: {x: number, y: number})=>{
    updateDoc(ideaDocRef, {position: pos}).catch(console.error);
  };

  useDebounceEffect(
    () => {
      handleWritePosition(internalPosition);
    },[internalPosition],500
  )

  const handleDrag = (e: DraggableEvent, data: DraggableData) =>{
    setInternalPosition({x: data.x, y: data.y});
  }
  // Function to update the note's color in Firestore
  const handleChangeColor = async (newColor: string) => {
    try {
      await updateDoc(ideaDocRef, { color: newColor });
    } catch (error) {
      console.error("Error updating color:", error);
    }
  };

  // An object to map color names to Tailwind CSS classes
  const colorClasses = {
    yellow: "bg-yellow-300 text-yellow-800",
    blue: "bg-blue-300 text-blue-800",
    green: "bg-green-300 text-green-800",
    pink: "bg-pink-300 text-pink-800",
    purple: "bg-purple-300 text-purple-800",
  };
  const noteColor = idea.color || "yellow"; // Default to yellow if no color is set
  const handleBgClass = colorClasses[noteColor as keyof typeof colorClasses];

  // Function to save edited text
  const handleSave = async () => {
    if (editText.trim() === "") {
      handleDelete(); // Delete the note if the text is empty
      return;
    }
    try {
      await updateDoc(ideaDocRef, { text: editText });
      setIsEditing(false); // Exit editing mode
    } catch (error) {
      console.error("error updating idea", error);
    }
  };

  // Handlers for editing events
  const handleBlur = () => handleSave();
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  // Function to delete the note
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this idea?")) return;
    try {
      await deleteDoc(ideaDocRef);
    } catch (error) {
      console.error("error deleting idea", error);
    }
  };


  // Function to format the Firestore timestamp
  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return "Just now";
    return timestamp.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      position={internalPosition}
      onDrag={handleDrag}
      handle=".handle"
    >
      {/* UPDATED: Added 'group' for hover effects and cleaned up styling */}
      <div ref={nodeRef} className="group  absolute bg-white border rounded-lg shadow-sm w-56">
        
        {/* UPDATED: The handle now uses the dynamic background color class */}
        <div className={`handle p-2 rounded-t-lg relative cursor-grab ${handleBgClass}`}>
          <p className="text-xs font-semibold ">{formatDate(idea.createdAt)}</p>
          <button
            onClick={handleDelete}
            className="absolute top-1 right-1 hover:text-red-600 p-1 rounded-full"
            title="Delete idea"
          >
            &#x2715;
          </button>
        </div>

        {/* The main content area that triggers editing on double click */}
        <div className="p-4" onDoubleClick={() => setIsEditing(true)}>
          {isEditing ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full h-24 p-1 bg-yellow-100 border-yellow-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
              autoFocus
            />
          ) : (
            <p className="font-medium text-gray-800 break-words">{idea.text}</p>
          )}

          {/* The author information section */}
          <div className="flex items-center gap-2 mt-3 pt-2 border-t">
            <Image
              src={idea.authorPhotoURL} // Using the corrected property name
              alt={idea.authorName}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full"
            />
            <p className="text-xs text-gray-500">{idea.authorName}</p>
          </div>
        </div>

        {/* NEW: Color Palette UI - appears on hover */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleChangeColor(color)}
              className={`w-5 h-5 rounded-full border-2 ${
                color === noteColor ? "border-black" : "border-white"
              } bg-${color}-300`}
              title={`Change to ${color}`}
            />
          ))}
        </div>
      </div>
    </Draggable>
  );
}
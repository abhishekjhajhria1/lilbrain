"use client";

import React, { useState } from "react";
import Draggable, { DraggableEvent, DraggableData } from "react-draggable";
import { doc, deleteDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";

export type Idea = {
  id: string;
  text: string;
  authorName: string;
  authorProfileURL: string;
  position: { x: number; y: number };
  createdAt: Timestamp;
};

type IdeaNoteProps = {
  idea: Idea;
  roomId: string;
};

export default function IdeaNote({ idea, roomId }: IdeaNoteProps) {

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(idea.text);

  const ideaDocRef = doc(db, "rooms", roomId, "ideas", idea.id);

  const handleSave = async () => {
    if (editText.trim() === "") {
      handleDelete();
      return;
    }
    try {
      await updateDoc(ideaDocRef, { text: editText });
      setIsEditing(false);
    } catch (error) {
      console.error("error updating idea", error);
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  }



  const handleDelete = async () => {
    if (!window.confirm("are you sure?")) return;
    try {
      const ideaDocRef = doc(db, "rooms", roomId, "ideas", idea.id);
      await deleteDoc(ideaDocRef);
    } catch (error) {
      console.error("error deleting idea", error);
    }
  };

  const handleStop = (e: DraggableEvent, data: DraggableData) => {
    const ideaDocRef = doc(db, "rooms", roomId, "ideas", idea.id);
    updateDoc(ideaDocRef, { position: { x: data.x, y: data.y } }).catch(console.error);
  };


  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return "Just now";
    // Convert Firestore timestamp to a readable date
    return new Date(timestamp.seconds * 1000).toLocaleDateString("en-US", {
      month: 'short', day: 'numeric'
    });
  };

  return (
    <Draggable
      position={idea.position}
      onStop={handleStop}
      bounds="parent"
      handle=".handle"
    >
      <div className="absolute opacity-50 hover:opacity-100 transition-opacity cursor-grab rounded0-lg shadow-emerald-50">
        <div className="handle p-2 bg-white border rounded-t-lg relative">
          <p className="text-xs font-semibold ">
            {formatDate(idea.createdAt)}
          </p>
          <button
            onClick={handleDelete}
            className="absolute top-1 right-1 rounded-full"
            title="Delete idea"
          >
            &#x2715;
          </button>

        </div>
        <div className="p-4" onDoubleClick={() => setIsEditing(true)}>
          {isEditing ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full h-24 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
              autoFocus />
          ) : (

            <p className="font-medium text-gray-800">{idea.text}</p>)}





          <div className="flex items-center gap-2 mt-3 pt-2 border-t">
            <Image
              src={idea.authorProfileURL}
              alt={idea.authorName}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full"
            />
            <p className="text-xs text-gray-500">{idea.authorName}</p>
          </div>
        </div>
      </div>
    </Draggable>
  )
}

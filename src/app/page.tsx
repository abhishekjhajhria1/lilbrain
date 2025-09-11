"use client";

import React, { useState, useRef } from "react";
import Draggable, { DraggableEvent, DraggableData } from "react-draggable";
import { doc, deleteDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";

const COLORS = ["yellow", "blue", "green", "pink", "purple"];

export type Idea = {
  id: string;
  text: string;
  authorName: string;
  authorPhotoURL: string;
  position: { x: number; y: number };
  createdAt: Timestamp;
  color?: string;
};

type IdeaNoteProps = {
  idea: Idea;
  roomId: string;
};

export default function IdeaNote({ idea, roomId }: IdeaNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(idea.text);
  const nodeRef = useRef(null);

  const ideaDocRef = doc(db, "rooms", roomId, "ideas", idea.id);

  const handleChangeColor = async (newColor: string) => {
    try {
      await updateDoc(ideaDocRef, { color: newColor });
    } catch (error) {
      console.error("Error updating color:", error);
    }
  };

  const colorClasses = {
    yellow: "bg-yellow-300 text-yellow-800",
    blue: "bg-blue-300 text-blue-800",
    green: "bg-green-300 text-green-800",
    pink: "bg-pink-300 text-pink-800",
    purple: "bg-purple-300 text-purple-800",
  };
  const noteColor = idea.color || "yellow";
  const handleBgClass = colorClasses[noteColor as keyof typeof colorClasses];

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

  const handleBlur = () => handleSave();
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this idea?")) return;
    try {
      await deleteDoc(ideaDocRef);
    } catch (error) {
      console.error("error deleting idea", error);
    }
  };

  const handleStop = (e: DraggableEvent, data: DraggableData) => {
    updateDoc(ideaDocRef, { position: { x: data.x, y: data.y } }).catch(
      console.error
    );
  };

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
      position={idea.position}
      onStop={handleStop}
      bounds="parent"
      handle=".handle"
    >
      <div
        ref={nodeRef}
        className="group absolute bg-white border rounded-lg shadow-sm w-56"
      >
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

          <div className="flex items-center gap-2 mt-3 pt-2 border-t">
            {/* CORRECTED: Changed 'idea.authorProfileURL' to 'idea.authorPhotoURL' */}
            <Image
              src={idea.authorPhotoURL}
              alt={idea.authorName}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full"
            />
            <p className="text-xs text-gray-500">{idea.authorName}</p>
          </div>
        </div>

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
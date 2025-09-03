"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Draggable from "react-draggable";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";


interface RoomData {
  name: string;
}
interface Idea {
  id: string;
  text: string;
  authorName: string;
  position: { x: number; y: number };
}

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [user] = useAuthState(auth);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);

  const [newIdeaText, setNewIdeaText] = useState("");

  useEffect(() => {
    // ... (useEffect hook to fetch room and ideas data remains the same)
    const roomDocRef = doc(db, "rooms", roomId);
    getDoc(roomDocRef).then((docSnap) => {
      if (docSnap.exists()) setRoom(docSnap.data() as RoomData);
    });
    const ideasCollectionRef = collection(db, "rooms", roomId, "ideas");
    const q = query(ideasCollectionRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ideasData: Idea[] = [];
      snapshot.forEach((doc) => {
        ideasData.push({ id: doc.id, ...doc.data() } as Idea);
      });
      setIdeas(ideasData);
    });
    return () => unsubscribe();
  }, [roomId]);

  const handleAddIdea = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newIdeaText.trim() === "" || !user) return;

    try {
      await addDoc(collection(db, "rooms", roomId, "Ideas"), {
        text: newIdeaText,
        authorName: user.displayName,
        createdAt: serverTimestamp(),
        position: { x: 100, y: 100 },
      });

      setNewIdeaText("");
    } catch (error) {
      console.error("error adding ideas:", error);
    }
  };

  return (
    <>
      <main className=" overflow-hidden">
        <div className="fixed top-4 left-4 z-10 bg-white p-3 rounded-lg shadow-md">
          <h1 className="font-bold text-lg">{room?.name || "Loading..."}</h1>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            &larr; Back to Rooms
          </Link>
          {/* Placeholder for the user's picture */}
        </div>

        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-10">
          <form
            onSubmit={handleAddIdea}
            className="flex gap-2 opacity-40 rounded-lg"
          >
            <input
              type="text"
              value={newIdeaText}
              onChange={(e) => setNewIdeaText(e.target.value)}
              placeholder="new idea"
              disabled={!user}
              className="border p-2 rounded-lg"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-amber-500"
              disabled={!user}
            >
              Add
            </button>
          </form>
        </div>
        <div className="relative w-screen h-screen bg-gray-50">
          {ideas.map((idea) => (
            <Draggable key={idea.id} position={idea.position} bounds="parent">
              <div className="absolute p-4 bg-yellow-200 rounded shadow-md w-48 cursor-move">
                <p className="font-medium">{idea.text}</p>
                <p className="text-sm text-gray-600 mt-2">
                  - {idea.authorName}
                </p>
              </div>
            </Draggable>
          ))}
        </div>
      </main>
    </>
  );
}

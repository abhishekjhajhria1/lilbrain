"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { User } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  TransformWrapper,
  TransformComponent,
  useTransformContext,
} from "react-zoom-pan-pinch";
import IdeaNote, { Idea } from "@/components/ideaNote";

interface RoomData {
  name: string;
}

// Sub-component for the Add Idea form
const AddIdeaForm = ({
  roomId,
  user,
}: {
  roomId: string;
  user: User | null;
}) => {
  const [newIdeaText, setNewIdeaText] = useState("");
  // Get the transform context to access transformation methods
  const { transformState } = useTransformContext();

  const handleAddIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newIdeaText.trim() === "" || !user) return;

    // Convert screen center to a point on the zoomable/pannable canvas
    const centerOfScreenX = window.innerWidth / 2;
    const centerOfScreenY = window.innerHeight / 2;
    // Use the transform state to convert screen coordinates to component coordinates
    const newPosition = {
      x: (centerOfScreenX - transformState.positionX) / transformState.scale,
      y: (centerOfScreenY - transformState.positionY) / transformState.scale
    };

    try {
      await addDoc(collection(db, "rooms", roomId, "ideas"), {
        text: newIdeaText,
        authorName: user.displayName,
        authorPhotoURL: user.photoURL,
        createdAt: serverTimestamp(),
        position: { x: newPosition.x, y: newPosition.y },
        color: "yellow",
      });
      setNewIdeaText("");
    } catch (error) {
      console.error("Error adding idea:", error);
    }
  };

  return (
    <form
      onSubmit={handleAddIdea}
      className="flex gap-2 bg-white p-2 rounded-lg shadow-md"
    >
      <input
        type="text"
        value={newIdeaText}
        onChange={(e) => setNewIdeaText(e.target.value)}
        placeholder="Add an idea"
        className="border p-2 rounded"
        disabled={!user}
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
        disabled={!user}
      >
        Add
      </button>
    </form>
  );
};

const NOTE_WIDTH = 224;
const NOTE_HEIGHT = 150;
const PADDING = 200;

// Main page component
export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [user, loading] = useAuthState(auth);
  const [room, setRoom] = useState<RoomData | null>(null);

  const [canvasBounds, setCanvasBounds] = useState({ width: 2000, height: 2000, x:0, y:0 });

  const [ideas, setIdeas] = useState<Idea[]>([]);

  useEffect(() => {
    if (!roomId) return;

    const roomDocRef = doc(db, "rooms", roomId);
    getDoc(roomDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        setRoom(docSnap.data() as RoomData);
      }
    });

    const ideasQuery = query(collection(db, "rooms", roomId, "ideas"));
    const unsubscribe = onSnapshot(ideasQuery, (snapshot) => {
      const ideasData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Idea)
      );
      setIdeas(ideasData);
    });

    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    if (ideas.length === 0) {
      setCanvasBounds({ width: window.innerWidth, height: window.innerHeight, x:0, y:0});
      return;
    }

    const bounds = ideas.reduce(
      (acc, idea) => ({
        minX: Math.min(acc.minX, idea.position.x),
        minY: Math.min(acc.minY, idea.position.y),
        maxX: Math.max(acc.maxX, idea.position.x),
        maxY: Math.max(acc.maxY, idea.position.y),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity}
    );
    const contentWidth = bounds.maxX + NOTE_WIDTH + PADDING;
    const contentHeight = bounds.maxY + NOTE_HEIGHT + PADDING;

    setCanvasBounds({ 
      width: contentWidth + PADDING * 2,
      height: contentHeight + PADDING * 2,
      x: -bounds.minX + PADDING,
      y: -bounds.minY + PADDING,
    });
  }, [ideas]);

  if (loading) {
    return (
      <main className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main>
      <TransformWrapper>
        <>
          {/* Top-Left Floating Menu */}
          <div className="fixed top-4 left-4 z-10 bg-white p-3 rounded-lg shadow-md flex items-center gap-4">
            <div>
              <h1 className="font-bold text-lg">{room?.name}</h1>
              <Link href="/" className="text-sm text-blue-600 hover:underline">
                &larr; Back to lobby
              </Link>
            </div>
            {user && (
              <Image
                src={user.photoURL!}
                alt={user.displayName!}
                width={40}
                height={40}
                className="rounded-full w-10 h-10"
              />
            )}
          </div>

          {/* Top-Center Toolbar */}
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-10">
            <AddIdeaForm roomId={roomId} user={user ?? null} />
          </div>

          {/* The main canvas */}
          <TransformComponent
            wrapperStyle={{ width: "100vw", height: "100vh" }}
            contentStyle={{
              width: `${canvasBounds.width}px`,
              height: `${canvasBounds.height}px`,
              backgroundColor: "#f9fafb",
            }}
          >
            <div 
            className="relative w-full h-full"
            style={{ transform: `translate(${canvasBounds.x}px, ${canvasBounds.y}px)` }}
            >
              {ideas.map((idea) => (
                <IdeaNote key={idea.id} idea={idea} roomId={roomId} />
              ))}
            </div>
          </TransformComponent>
        </>
      </TransformWrapper>
    </main>
  );
}

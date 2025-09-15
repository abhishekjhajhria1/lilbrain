"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db, auth, rtdb } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { User } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  onSnapshot,
  addDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, onValue, set, onDisconnect } from "firebase/database";
import {
  TransformWrapper,
  TransformComponent,
  useTransformContext,
} from "react-zoom-pan-pinch";
import IdeaNote, { Idea } from "@/components/ideaNote";
import toast from "react-hot-toast";
import SkeletonNote from "@/components/skeletonNote";

// --- Type Definitions ---
interface RoomData {
  name: string;
}
interface Cursor {
  x: number;
  y: number;
  displayName: string;
  photoURL: string;
}
type Cursors = Record<string, Cursor>;

// --- UI Sub-Components ---

const Toolbar = ({ roomId, user }: { roomId: string; user: User | null }) => {
  const [newIdeaText, setNewIdeaText] = useState("");
  // Use transform state to convert screen coordinates to content coordinates
  const { transformState } = useTransformContext() as unknown as {
    transformState: { positionX: number; positionY: number; scale: number };
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success("Room link copied to clipboard!");
    });
  };

  const handleAddIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newIdeaText.trim() === "" || !user) return;

    const centerOfScreenX = window.innerWidth / 2;
    const centerOfScreenY = window.innerHeight / 2;
    const newPosition = {
      x: (centerOfScreenX - transformState.positionX) / transformState.scale,
      y: (centerOfScreenY - transformState.positionY) / transformState.scale,
    };

    try {
      await addDoc(collection(db, "rooms", roomId, "ideas"), {
        text: newIdeaText,
        authorName: user.displayName,
        authorPhotoURL: user.photoURL,
        createdAt: serverTimestamp(),
        position: { x: newPosition.x, y: newPosition.y },
        color: "yellow",
        width: 224,
        height: 150,
      });
      setNewIdeaText("");
    } catch (error) {
      console.error("Error adding idea:", error);
      toast.error("Failed to add idea.");
    }
  };

  const handleDiagramClick = () => {
    toast("Diagrams coming soon!");
  };

  return (
    <div className="flex items-center gap-4 bg-white p-2 rounded-lg shadow-md">
      <form onSubmit={handleAddIdea} className="flex gap-2">
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
      <div className="w-px h-8 bg-gray-200" />
      <button
        onClick={handleShare}
        className="text-sm font-semibold text-blue-600 hover:bg-gray-100 p-2 rounded-md"
      >
        Share
      </button>
      <div className="w-px h-8 bg-gray-200" />
      <button
        onClick={handleDiagramClick}
        className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50"
        title="Add Diagram (Coming Soon)"
        disabled={!user}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l-1-1m5-5l-1-1m-6 0h.01M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      </button>
    </div>
  );
};

// --- Constants for Canvas Calculation ---
const NOTE_WIDTH = 224;
const NOTE_HEIGHT = 150;
const PADDING = 200;

// --- Main Page Component ---
export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [user, loading] = useAuthState(auth);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [cursors, setCursors] = useState<Cursors>({});
  const [canvasBounds, setCanvasBounds] = useState({
    width: 2000,
    height: 2000,
    x: 0,
    y: 0,
  });

  // Effect for Firestore data (room info, ideas)
  useEffect(() => {
    if (!roomId) return;
    const roomDocRef = doc(db, "rooms", roomId);
    getDoc(roomDocRef).then((docSnap) => {
      if (docSnap.exists()) setRoom(docSnap.data() as RoomData);
    });
    const ideasQuery = query(collection(db, "rooms", roomId, "ideas"));
    const unsubscribe = onSnapshot(ideasQuery, (snapshot) => {
      const ideasData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Idea)
      );
      setIdeas(ideasData);
      setInitialLoad(false);
    });
    return () => unsubscribe();
  }, [roomId]);

  // Effect for auto-joining room members
  useEffect(() => {
    if (!user || !roomId) return;
    const memberRef = doc(db, "rooms", roomId, "members", user.uid);
    getDoc(memberRef).then((docSnap) => {
      if (!docSnap.exists()) {
        setDoc(memberRef, {
          role: "member",
          uid: user.uid,
          joinedAt: serverTimestamp(),
        });
      }
    });
  }, [user, roomId]);

  // Effect for calculating dynamic canvas size
  useEffect(() => {
    if (ideas.length === 0) {
      setCanvasBounds({
        width: window.innerWidth,
        height: window.innerHeight,
        x: 0,
        y: 0,
      });
      return;
    }
    const bounds = ideas.reduce(
      (acc, idea) => ({
        minX: Math.min(acc.minX, idea.position.x),
        minY: Math.min(acc.minY, idea.position.y),
        maxX: Math.max(acc.maxX, idea.position.x),
        maxY: Math.max(acc.maxY, idea.position.y),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );
    const contentWidth = bounds.maxX - bounds.minX + NOTE_WIDTH;
    const contentHeight = bounds.maxY - bounds.minY + NOTE_HEIGHT;
    setCanvasBounds({
      width: contentWidth + PADDING * 2,
      height: contentHeight + PADDING * 2,
      x: -bounds.minX + PADDING,
      y: -bounds.minY + PADDING,
    });
  }, [ideas]);

  // Effect for Realtime Database cursors
  useEffect(() => {
    if (!user || !roomId) return;
    const myCursorRef = ref(rtdb, `cursors/${roomId}/${user.uid}`);
    const roomCursorsRef = ref(rtdb, `cursors/${roomId}`);
    const handleMouseMove = (event: MouseEvent) => {
      set(myCursorRef, {
        x: event.clientX,
        y: event.clientY,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    const unsubscribe = onValue(roomCursorsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCursors(data);
      } else {
        setCursors({});
      }
    });
    onDisconnect(myCursorRef).remove();
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      set(myCursorRef, null);
      unsubscribe();
    };
  }, [user, roomId]);

  if (loading) {
    return (
      <main className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="cursor-none">
      <TransformWrapper>
        <>
          {/* Top-Left Floating Menu */}
          <div className="fixed top-4 left-4 z-10 bg-white p-3 rounded-lg shadow-md flex items-center gap-4">
            <div>
              <h1 className="font-bold text-lg">{room?.name}</h1>
              <Link
                href="/"
                className="text-sm text-blue-600 hover:underline"
              >
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
            <Toolbar roomId={roomId} user={user ?? null} />
          </div>

          {/* "Who's Here" Avatar List */}
          <div className="fixed bottom-4 right-4 z-10 flex items-center">
            {Object.entries(cursors).map(([uid, cursor]) => (
              <Image
                key={uid}
                src={cursor.photoURL}
                alt={cursor.displayName}
                width={40}
                height={40}
                className="rounded-full border-2 border-white -ml-3"
                title={cursor.displayName}
              />
            ))}
          </div>

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
              style={{
                transform: `translate(${canvasBounds.x}px, ${canvasBounds.y}px)`,
              }}
            >
              {initialLoad ? (
                <div className="p-4 flex gap-4">
                  <SkeletonNote />
                  <SkeletonNote />
                  <SkeletonNote />
                </div>
              ) : (
                ideas.map((idea) => (
                  <IdeaNote key={idea.id} idea={idea} roomId={roomId} />
                ))
              )}
              {/* Render Live Cursors */}
              {Object.entries(cursors).map(([uid, cursor]) => (
                <div
                  key={uid}
                  className="absolute pointer-events-none transition-transform duration-75 ease-out"
                  style={{
                    left: 0,
                    top: 0,
                    transform: `translate(${cursor.x}px, ${cursor.y}px)`,
                    zIndex: 9999,
                  }}
                >
                  <div className="relative">
                    <svg
                      className="w-6 h-6 -ml-1 -mt-1 text-blue-500"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                    </svg>
                    <div className="absolute top-5 left-5 bg-white rounded-full p-1 shadow-md flex items-center gap-2">
                      <Image
                        src={cursor.photoURL}
                        alt={cursor.displayName}
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-full"
                      />
                      <span className="pr-2 text-sm">
                        {cursor.displayName}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TransformComponent>
        </>
      </TransformWrapper>
    </main>
  );
}
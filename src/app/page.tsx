"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  query,
  collectionGroup,
  where,
  getDoc,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  deleteDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";

// --- Type Definitions ---
interface Room {
  id: string;
  name: string;
  ownerId: string;
}

// --- UI Components ---

const LoginPage = ({ onSignIn }: { onSignIn: () => void }) => (
  <div className="text-center pt-20">
    <h1 className="text-4xl font-bold text-gray-800 mb-2">
      Welcome to Lil Brain
    </h1>
    <p className="text-gray-600 mb-6">Your collaborative idea board.</p>
    <button
      onClick={onSignIn}
      className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
    >
      Sign In with Google
    </button>
  </div>
);

const Dashboard = ({ user, onSignOut }: { user: User; onSignOut: () => void }) => {
  const [newRoomName, setNewRoomName] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const router = useRouter();

  // Effect to fetch rooms the user is a member of
  useEffect(() => {
    const q = query(collectionGroup(db, "members"), where("uid", "==", user.uid));
    const unsubscribe = onSnapshot(q, async (membersSnapshot: QuerySnapshot) => {
      const roomPromises = membersSnapshot.docs.map(
        async (memberDoc: DocumentData) => {
          const roomRef = memberDoc.ref.parent.parent;
          if (roomRef) {
            const roomSnap = await getDoc(roomRef);
            if (roomSnap.exists()) {
              return { id: roomSnap.id, ...roomSnap.data()! } as Room;
            }
          }
          return null;
        }
      );
      const userRooms = (await Promise.all(roomPromises)).filter(
        (room): room is Room => room !== null
      );
      setRooms(userRooms);
    });
    return () => unsubscribe();
  }, [user.uid]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim() === "" || !user) return;

    const newRoomRef = doc(collection(db, "rooms"));
    const memberRef = doc(db, "rooms", newRoomRef.id, "members", user.uid);
    const batch = writeBatch(db);

    batch.set(newRoomRef, {
      name: newRoomName,
      createdAt: serverTimestamp(),
      ownerId: user.uid,
    });
    batch.set(memberRef, {
      role: "owner",
      uid: user.uid,
    });
    await batch.commit();
    setNewRoomName("");
    router.push(`/room/${newRoomRef.id}`);
  };
  
  const handleDeleteRoom = async (roomId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this room? This cannot be undone.")) {
      return;
    }
    try {
      const roomDocRef = doc(db, "rooms", roomId);
      await deleteDoc(roomDocRef);
      // Note: In a production app, you'd use a Cloud Function to delete subcollections.
    } catch (error) {
      console.error("Error deleting room:", error);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome, {user.displayName}
        </h1>
        <button
          onClick={onSignOut}
          className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition"
        >
          Sign Out
        </button>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <h2 className="text-xl font-semibold mb-3 text-gray-700">
          Create a New Room
        </h2>
        <form onSubmit={handleCreateRoom} className="flex gap-2">
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Enter room name"
            className="flex-grow border p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            className="px-5 py-2 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600 transition"
          >
            Create
          </button>
        </form>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Your Rooms</h2>
        {rooms.length > 0 ? (
          <ul className="space-y-2">
            {rooms.map((room) => (
              <li key={room.id} className="flex items-center justify-between p-4 rounded-md bg-gray-50 border group">
                <Link
                  href={`/room/${room.id}`}
                  className="font-medium text-blue-700 hover:underline"
                >
                  {room.name}
                </Link>
                
                {user.uid === room.ownerId && (
                  <button
                    onClick={() => handleDeleteRoom(room.id)}
                    className="px-3 py-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full hover:bg-red-200 transition opacity-0 group-hover:opacity-100"
                    title="Delete Room"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">
            You have not joined any rooms yet. Create one to get started!
          </p>
        )}
      </div>
    </div>
  );
};


// --- Main Page Component ---
export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as {code: string}).code !== "auth/cancelled-popup-request") {
        console.error("Error signing in with Google", error);
      }
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut(auth);
  }, []);

  if (loading) {
    return (
      <main className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {user ? (
          <Dashboard user={user} onSignOut={handleSignOut} />
        ) : (
          <LoginPage onSignIn={handleSignIn} />
        )}
      </div>
    </main>
  );
}
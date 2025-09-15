"use client";

import { useState, useEffect } from "react";
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
} from "firebase/firestore";
import type { User } from "firebase/auth";

// The data structure for a Room
interface Room {
  id: string;
  name: string;
  ownerId: string;
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [newRoomName, setNewRoomName] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const router = useRouter();

  // Effect to manage user authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Effect to fetch rooms the user is a member of
  useEffect(() => {
    if (!user) {
      setRooms([]);
      return;
    }

    // A collection group query to find all rooms a user is a member of
    const q = query(collectionGroup(db, "members"), where("uid", "==", user.uid));

    const unsubscribe = onSnapshot(q, async (membersSnapshot: QuerySnapshot) => {
      const roomPromises = membersSnapshot.docs.map(
        async (memberDoc: DocumentData) => {
          const roomRef = memberDoc.ref.parent.parent; // Get the parent room document
          if (roomRef) {
            const roomSnap = await getDoc(roomRef);
            if (roomSnap.exists()) {
              return { id: roomSnap.id, ...roomSnap.data()! } as Room;
            }
          }
          return null;
        }
      );

      // Wait for all room data to be fetched and filter out any nulls
      const userRooms = (await Promise.all(roomPromises)).filter(
        (room): room is Room => room !== null
      );
      setRooms(userRooms);
    });

    return () => unsubscribe();
  }, [user]);

  // Handler for creating a new room using a batched write
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim() === "" || !user) return;

    const newRoomRef = doc(collection(db, "rooms"));
    const memberRef = doc(db, "rooms", newRoomRef.id, "members", user.uid);
    const batch = writeBatch(db);

    // Write 1: Create the room document
    batch.set(newRoomRef, {
      name: newRoomName,
      createdAt: serverTimestamp(),
      ownerId: user.uid,
    });

    // Write 2: Create the member document with the crucial 'uid' field
    batch.set(memberRef, {
      role: "owner",
      uid: user.uid,
    });

    try {
      await batch.commit();
      setNewRoomName("");
      router.push(`/room/${newRoomRef.id}`);
    } catch (error) {
      console.error("Error creating room:", error);
    }
  };

  // Handler for Google Sign-In
  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code !== "auth/cancelled-popup-request") {
        console.error("Error signing in with Google", error);
      }
    }
  };

  // Handler for Sign-Out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

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
          <div>
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold text-gray-800">
                Welcome, {user.displayName}
              </h1>
              <button
                onClick={handleSignOut}
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
              <h2 className="text-xl font-semibold mb-4 text-gray-700">
                Your Rooms
              </h2>
              {rooms.length > 0 ? (
                <ul className="space-y-2">
                  {rooms.map((room) => (
                    <li key={room.id}>
                      <Link
                        href={`/room/${room.id}`}
                        className="block p-4 rounded-md bg-gray-50 hover:bg-blue-100 hover:text-blue-800 border font-medium transition"
                      >
                        {room.name}
                      </Link>
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
        ) : (
          <div className="text-center pt-20">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Welcome to Lil Brain
            </h1>
            <p className="text-gray-600 mb-6">
              Your collaborative idea board.
            </p>
            <button
              onClick={handleSignIn}
              className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
            >
              Sign In with Google
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
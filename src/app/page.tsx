"use client";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import type { User } from "firebase/auth";
import { collection, addDoc, query, onSnapshot } from "firebase/firestore";

interface Room {
  id: string;
  name: string;
  createdby: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState("");

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("error signin with google ", error);
    }
  };

  const handleSignout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("error signing out ", error);
    }
  };
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent page reload on form submit
    if (!user || newRoomName.trim() === "") return;

    try {
      // Add a new document to the "rooms" collection
      await addDoc(collection(db, "rooms"), {
        name: newRoomName,
        createdBy: user.uid, // Store the user's ID
      });
      setNewRoomName(""); // Clear the input field
    } catch (error) {
      console.error("Error creating room:", error);
    }
  };

  useEffect(() => {
    if (user) {
      const q = query(collection(db, "rooms"));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const roomsData: Room[] = [];
        querySnapshot.forEach((doc) => {
          roomsData.push({ id: doc.id, ...doc.data() } as Room);
        });
        setRooms(roomsData);
      });
      // Cleanup subscription on unmount
      return () => unsubscribe();
    }
  }, [user]);

  return (
    <>
      <main className="bg-blue-500">
        {user ? (
          <div>
            <div>
              <h1>welcome , {user.displayName || "user"}</h1>
              <p>email: {user.email}</p>
              <button onClick={handleSignout}>signOut</button>
            </div>

            <form>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="enter new room name"
              />
              <button type="submit" onClick={handleCreateRoom}>
                create Room
              </button>
            </form>
            <div>
              <h1>your rooms</h1>
              <ul>
                {rooms.map((room) => (
                  <li key={room.id}>
                    <Link
                      href={`/room/${room.id}`}
                    >{room.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div>
            <h1>Lil brain Board</h1>
            <p>Please signin yo continue</p>
            <button onClick={handleSignIn}>signin with google</button>
          </div>
        )}
      </main>
    </>
  );
}

"use client"

import React, { useState, useEffect } from "react";
import { signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { User } from "firebase/auth";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider)
    } catch (error){
      console.error("error signin with google ", error)
    }
  };

  const handleSignout = async () => {
    try {
      await signOut(auth);
    } catch(error){
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

  return (
    <>
    <main className="bg-blue-500">
      {user ? (
        <div>
          <h1>
            welcome , {user.displayName || "user"}
          </h1>
          <p>email: {user.email}</p>
          <button onClick={handleSignout}>
            signOut
          </button>
        </div>
      ):(
        <div>
          <h1>Lil brain Board</h1>
          <p>Please signin yo continue</p>
          <button onClick={handleSignIn}  >
            signin with google
          </button>
        </div>
      )}
    </main>
    </>
  );
}
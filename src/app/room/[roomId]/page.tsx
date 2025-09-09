"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  onSnapshot,
  // updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import IdeaNote, { Idea } from "@/components/ideaNote";
interface RoomData {
  name: string;
}


export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [user, loading] = useAuthState(auth);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);

  const [newIdeaText, setNewIdeaText] = useState("");

  useEffect(() => {
    if (!roomId) return;

    const roomDocRef = doc(db, "rooms", roomId);
    getDoc(roomDocRef).then((docSnap) => {
      if (docSnap.exists()){
        setRoom(docSnap.data() as RoomData);
      }
    });

    const ideasQuery = query(collection(db, "rooms", roomId, "ideas"));
    const unsubscribe = onSnapshot(ideasQuery, (snapshot) => {
      const ideasData = snapshot.docs.map((doc)=>({id: doc.id, ...doc.data()} as Idea));
      setIdeas(ideasData);
    })
    return () => unsubscribe();
  }, [roomId]);

  const handleAddIdea = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newIdeaText.trim() === "" || !user) return;

    try {
      await addDoc(collection(db, "rooms", roomId, "Ideas"), {
        text: newIdeaText,
        authorName: user.displayName,
        authorPhotoURL: user.photoURL,
        createdAt: serverTimestamp(),
        position: { x: 100, y: 100 },
      });

      setNewIdeaText("");
    } catch (error) {
      console.error("error adding ideas:", error);
    }
  };

  if (loading){
    return(
      <main className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </main>
    )
  }
  return (
    <main className=" overflow-hidden">
      <div className="fixed top-4 left-4 z-10 bg-white p-3 rounded-lg shadow-md flex items-center gap-4">
        <div>
          <h1 className="font-bold text-lg">
            {room?.name}
          </h1>
          <Link  href="/" className="text-sm text-blue-600 ">
             Back to lobby
          </Link>

        </div>
        {user && (
          <Image 
           src={user.photoURL!}
            alt={user.displayName!}
            width={40}
            height={40}
            className="rounded-full w-10 h-10"
            title={user.displayName!}
          />
        )}
      </div>

      <div className="fixed top-4 left-1/2 -translate-x-0.5 z-10">
        <form 
         onSubmit={handleAddIdea}
        >
          <input
            type="text"
            value={newIdeaText}
            className="flex gap-2 bg-white p-2 rounded-lg shadow-md"
          />
          <button 
            type="submit"
            disabled={!user}
          >
            add
          </button>
        </form>
      </div>

      <div>
        {ideas.map((idea)=>(
          <IdeaNote key={idea.id} idea={idea} roomId={roomId}/>
        ))}
      </div>
    </main>
  );
}

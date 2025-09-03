"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import Link from "next/link";
import Draggable from "react-draggable";

import { doc, getDoc, collection, query, onSnapshot } from "firebase/firestore";

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
    const [room, setRoom] = useState<RoomData | null>(null);
    const [ideas, setIdeas] = useState<Idea[]>([]);

    useEffect(() => {
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

    return (
        <main className="overflow-hidden">
            <div className="fixed top-4 left-4 rounded-lg opacity-80">
                <h1>{room?.name || "loading..."}</h1>
                <Link href="/" >back to rooms</Link>
            </div>
            <br />
            <div className="fixed top-4 left-1/2 right-10 opacity-50">
                <p className="text-sm text-gray-500">[Toolbar Will Go Here]</p>
            </div>
            <br />
            <div className="relative w-screen h-screen ">
                {ideas.map((idea) => (
                    <Draggable key={idea.id} position={idea.position} bounds="parent">
                        <div className="absolute p-4 bg-yellow-200 rounded shadow-md w-48 cursor-move">
                            <p className="font-medium">{idea.text}</p>
                            <p className="text-sm text-gray-600 mt-2">- {idea.authorName}</p>
                        </div>
                    </Draggable>
                ))}
            </div>
        </main>
    );
}

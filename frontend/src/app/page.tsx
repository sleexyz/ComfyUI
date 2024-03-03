"use client";

import { WebsocketDemo } from "@/components/WebsocketDemo";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between mt-10">
      <div className="w-full max-w-[600px]">
        <WebsocketDemo />
      </div>
    </main>
  );
}